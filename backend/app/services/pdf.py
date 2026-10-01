from __future__ import annotations

import io
from typing import TYPE_CHECKING, Literal

from fpdf import FPDF

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.invoice import Invoice, InvoiceLine
    from app.models.tenant import TenantProfile

_M = 15      # left/right margin mm
_W = 210     # A4 width mm
_CW = [85, 18, 31, 31]  # column widths for lines table
_SLIP_Y = 192.0          # QR slip top y mm (297-105)

Lang = Literal["en", "fr"]

# QR slip wording follows the SIX Swiss Payment Standards for each language.
_LABELS: dict[Lang, dict[str, str]] = {
    "en": {
        "invoice": "Invoice", "phone": "Phone: {phone}",
        "date": "Date:", "due": "Due:", "bill_to": "Bill to:",
        "description": "Description", "qty": "Qty", "unit_price": "Unit price",
        "total": "Total", "subtotal": "Subtotal", "discount": "Discount", "vat": "VAT",
        "twint_title": "Pay with TWINT", "twint_send": "Send CHF {amount} to {phone}",
        "twint_message": ", message: {number}", "paid_on": "Paid on {date}",
        "receipt": "Receipt", "payment_part": "Payment part",
        "payable_to": "Account / Payable to", "payable_by": "Payable by",
        "acceptance_point": "Acceptance point", "additional_info": "Additional information",
        "currency": "Currency", "amount": "Amount",
    },
    "fr": {
        "invoice": "Facture", "phone": "Tél. : {phone}",
        "date": "Date :", "due": "Échéance :", "bill_to": "Facturé à :",
        "description": "Désignation", "qty": "Qté", "unit_price": "Prix unit.",
        "total": "Total", "subtotal": "Sous-total", "discount": "Rabais", "vat": "TVA",
        "twint_title": "Payer avec TWINT", "twint_send": "Envoyez CHF {amount} au {phone}",
        "twint_message": ", message : {number}", "paid_on": "Acquittée le {date}",
        "receipt": "Récépissé", "payment_part": "Section paiement",
        "payable_to": "Compte / Payable à", "payable_by": "Payable par",
        "acceptance_point": "Point de dépôt", "additional_info": "Informations supplémentaires",
        "currency": "Monnaie", "amount": "Montant",
    },
}


def generate_invoice_pdf(
    invoice: Invoice,
    lines: list[InvoiceLine],
    customer: Customer,
    profile: TenantProfile,
    lang: Lang = "en",
) -> bytes:
    t = _LABELS[lang]
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()

    y = _header(pdf, profile, invoice, t)
    y = _customer_block(pdf, customer, y, t)
    y = _lines_table(pdf, lines, y, t)
    y = _totals_block(pdf, invoice, lines, y, t)
    # A paid invoice serves as a receipt: no payment means, so it is not paid twice.
    if invoice.paid_at is None:
        if profile.twint_phone:
            _twint_block(pdf, invoice, lines, profile.twint_phone, y, t)
        if profile.iban:
            _qr_slip(pdf, invoice, lines, customer, profile, t)

    return bytes(pdf.output())


# ---- sections ---------------------------------------------------------------

def _header(pdf: FPDF, profile: TenantProfile, invoice: Invoice, t: dict[str, str]) -> float:
    pdf.set_xy(_M, 15)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(80, 7, profile.company_name)
    pdf.set_xy(115, 15)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(80, 7, t["invoice"], align="R")

    pdf.set_font("Helvetica", "", 9)
    y_left = 24.0
    lines = [profile.address_line1, f"{profile.postal_code} {profile.city}"]
    if profile.phone:
        lines.append(t["phone"].format(phone=_local_phone(profile.phone)))
    for text in lines:
        if text.strip():
            pdf.set_xy(_M, y_left)
            pdf.cell(80, 5, text)
            y_left += 5

    y_right = 24.0
    if invoice.invoice_number:
        pdf.set_xy(115, y_right)
        pdf.cell(80, 5, f"N° {invoice.invoice_number}", align="R")
        y_right += 5
    if invoice.issue_date:
        pdf.set_xy(115, y_right)
        pdf.cell(80, 5, f"{t['date']} {invoice.issue_date.strftime('%d.%m.%Y')}", align="R")
        y_right += 5
    if invoice.due_date:
        pdf.set_xy(115, y_right)
        pdf.cell(80, 5, f"{t['due']} {invoice.due_date.strftime('%d.%m.%Y')}", align="R")
        y_right += 5

    return max(y_left, y_right) + 5


def _customer_block(pdf: FPDF, customer: Customer, y: float, t: dict[str, str]) -> float:
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(80, 5, t["bill_to"])
    y += 5
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(80, 5, f"{customer.first_name} {customer.last_name}")
    y += 5
    pdf.set_font("Helvetica", "", 9)
    for text in [
        customer.address_line1,
        customer.address_line2 or "",
        f"{customer.postal_code} {customer.city}",
    ]:
        if text.strip():
            pdf.set_xy(_M, y)
            pdf.cell(80, 5, text)
            y += 5
    return y + 5


def _lines_table(pdf: FPDF, lines: list[InvoiceLine], y: float, t: dict[str, str]) -> float:
    pdf.set_fill_color(235, 235, 235)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(_M, y)
    headers = [t["description"], t["qty"], t["unit_price"], t["total"]]
    for i, (w, h) in enumerate(zip(_CW, headers, strict=True)):
        pdf.cell(w, 6, h, border="B", fill=True, align="L" if i == 0 else "R")
    y += 6

    pdf.set_font("Helvetica", "", 9)
    for ln in lines:
        total = ln.quantity * float(ln.unit_price_snapshot)
        cells = [
            ln.description_snapshot,
            str(ln.quantity),
            _chf(float(ln.unit_price_snapshot)),
            _chf(total),
        ]
        pdf.set_xy(_M, y)
        for w, text in zip(_CW, cells, strict=True):
            pdf.cell(w, 5, text, align="L" if text == cells[0] else "R")
        y += 5
    return y + 3


def _totals_block(
    pdf: FPDF, invoice: Invoice, lines: list[InvoiceLine], y: float, t: dict[str, str]
) -> float:
    subtotal = sum(ln.quantity * float(ln.unit_price_snapshot) for ln in lines)
    disc_pct = float(invoice.discount_percent)
    disc_amt = subtotal * disc_pct / 100

    vat_groups: dict[str, float] = {}
    for ln in lines:
        if ln.vat_rate_snapshot is not None:
            rate = float(ln.vat_rate_snapshot)
            base = ln.quantity * float(ln.unit_price_snapshot) * (1 - disc_pct / 100)
            key = f"{t['vat']} {rate * 100:.1f} %"
            vat_groups[key] = vat_groups.get(key, 0) + base * rate
    vat_total = sum(vat_groups.values())
    grand_total = subtotal - disc_amt + vat_total

    x_lbl = _M + _CW[0] + _CW[1]
    w_lbl, w_amt = _CW[2], _CW[3]

    rows: list[tuple[str, float, bool]] = [(t["subtotal"], subtotal, False)]
    if disc_amt:
        rows.append((f"{t['discount']} ({disc_pct:.1f} %)", -disc_amt, False))
    rows.extend((k, v, False) for k, v in vat_groups.items())
    rows.append(("TOTAL CHF", grand_total, True))

    for label, amount, bold in rows:
        pdf.set_xy(x_lbl, y)
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.cell(w_lbl, 5, label, align="R")
        pdf.cell(w_amt, 5, _chf(amount), align="R")
        if bold:
            pdf.set_draw_color(0, 0, 0)
            pdf.line(x_lbl, y, x_lbl + w_lbl + w_amt, y)
        y += 5

    if invoice.paid_at:
        y += 2
        pdf.set_xy(x_lbl, y)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(
            w_lbl + w_amt, 5,
            t["paid_on"].format(date=invoice.paid_at.strftime("%d.%m.%Y")), align="R",
        )
        y += 5

    if invoice.notes:
        y += 5
        pdf.set_xy(_M, y)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(_W - 2 * _M, 5, invoice.notes)
        y = pdf.get_y()
    return y + 5


def _twint_block(
    pdf: FPDF,
    invoice: Invoice,
    lines: list[InvoiceLine],
    phone: str,
    y: float,
    t: dict[str, str],
) -> None:
    local = _local_phone(phone)
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(80, 5, t["twint_title"])
    pdf.set_xy(_M, y + 5)
    pdf.set_font("Helvetica", "", 9)
    text = t["twint_send"].format(amount=_chf(_amount_due(invoice, lines)), phone=local)
    if invoice.invoice_number:
        text += t["twint_message"].format(number=invoice.invoice_number)
    pdf.cell(_W - 2 * _M, 5, text)


def _local_phone(phone: str) -> str:
    """+41791234567 -> 079 123 45 67, the form Swiss customers dial; others stay E.164."""
    if phone.startswith("+41") and len(phone) == 12:
        return f"0{phone[3:5]} {phone[5:8]} {phone[8:10]} {phone[10:]}"
    return phone


# ---- payment ----------------------------------------------------------------

def _chf(amount: float, sep: str = "'") -> str:
    """1234.5 -> 1'234.50, the Swiss convention; the QR slip mandates a space."""
    return f"{amount:,.2f}".replace(",", sep)


def _amount_due(invoice: Invoice, lines: list[InvoiceLine]) -> float:
    subtotal = sum(ln.quantity * float(ln.unit_price_snapshot) for ln in lines)
    disc_pct = float(invoice.discount_percent)
    vat = sum(
        ln.quantity * float(ln.unit_price_snapshot)
        * (1 - disc_pct / 100) * float(ln.vat_rate_snapshot)
        for ln in lines
        if ln.vat_rate_snapshot is not None
    )
    return subtotal * (1 - disc_pct / 100) + vat


# ---- Swiss QR payment slip --------------------------------------------------

def _qr_slip(
    pdf: FPDF,
    invoice: Invoice,
    lines: list[InvoiceLine],
    customer: Customer,
    profile: TenantProfile,
    t: dict[str, str],
) -> None:
    amount = _amount_due(invoice, lines)

    # Separator line
    pdf.set_draw_color(0, 0, 0)
    pdf.set_dash_pattern(dash=2, gap=2)
    pdf.line(0, _SLIP_Y, _W, _SLIP_Y)
    pdf.set_dash_pattern()

    # Vertical separator between receipt (62mm) and payment section
    pdf.set_dash_pattern(dash=2, gap=2)
    pdf.line(62, _SLIP_Y, 62, 297)
    pdf.set_dash_pattern()

    # --- Receipt section (left 62mm) ---
    _slip_title(pdf, _M - 5, _SLIP_Y + 4, t["receipt"], 8)
    _slip_section(pdf, _M - 5, _SLIP_Y + 10, t["payable_to"], profile)
    _slip_amount(pdf, _M - 5, _SLIP_Y + 55, amount, t)
    _slip_section(pdf, _M - 5, _SLIP_Y + 70, t["payable_by"], customer)
    pdf.set_xy(_M - 5, _SLIP_Y + 90)
    pdf.set_font("Helvetica", "B", 6)
    pdf.cell(47, 4, t["acceptance_point"], align="R")

    # --- Payment section (right 148mm starting at x=62) ---
    px = 67  # 62 + 5 margin
    _slip_title(pdf, px, _SLIP_Y + 4, t["payment_part"], 11)

    # QR code
    qr_x, qr_y = 67.0, _SLIP_Y + 17
    _draw_qr_code(pdf, invoice, profile, customer, amount, qr_x, qr_y)

    # Currency + amount below QR code
    _slip_amount(pdf, px, qr_y + 50, amount, t)

    # Creditor info right column
    rx = 120.0
    _slip_section(pdf, rx, _SLIP_Y + 10, t["payable_to"], profile)
    _slip_section(pdf, rx, _SLIP_Y + 48, t["payable_by"], customer)
    if invoice.invoice_number:
        pdf.set_xy(rx, _SLIP_Y + 75)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(80, 4, t["additional_info"])
        pdf.set_xy(rx, _SLIP_Y + 79)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(80, 4, invoice.invoice_number or "")


def _slip_title(pdf: FPDF, x: float, y: float, title: str, size: int) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", size)
    pdf.cell(50, 5, title)


def _slip_section(
    pdf: FPDF, x: float, y: float, label: str, entity: object
) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(50, 4, label)
    y += 4

    from app.models.tenant import TenantProfile as _TP
    is_profile = isinstance(entity, _TP)

    pdf.set_font("Helvetica", "", 8)
    if is_profile:
        tp: TenantProfile = entity  # type: ignore[assignment]
        for text in [
            tp.iban or "",
            tp.company_name,
            tp.address_line1,
            f"{tp.postal_code} {tp.city}",
        ]:
            if text.strip():
                pdf.set_xy(x, y)
                pdf.cell(55, 4, text)
                y += 4
    else:
        c: Customer = entity  # type: ignore[assignment]
        for text in [
            f"{c.first_name} {c.last_name}",
            c.address_line1,
            c.address_line2 or "",
            f"{c.postal_code} {c.city}",
        ]:
            if text.strip():
                pdf.set_xy(x, y)
                pdf.cell(55, 4, text)
                y += 4


def _slip_amount(pdf: FPDF, x: float, y: float, amount: float, t: dict[str, str]) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(15, 4, t["currency"])
    pdf.cell(25, 4, t["amount"])
    pdf.set_xy(x, y + 4)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(15, 5, "CHF")
    pdf.cell(25, 5, _chf(amount, " "))


def _draw_qr_code(
    pdf: FPDF,
    invoice: Invoice,
    profile: TenantProfile,
    customer: Customer,
    amount: float,
    x: float,
    y: float,
) -> None:
    import qrcode
    import qrcode.constants

    data = _build_qr_payload(invoice, profile, customer, amount)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=0,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    pdf.image(buf, x=x, y=y, w=46, h=46)

    # Swiss cross (centered on QR code)
    cx = x + 23
    cy = y + 23
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(cx - 3.5, cy - 3.5, 7, 7, "F")
    pdf.set_fill_color(220, 0, 0)
    pdf.rect(cx - 3.1, cy - 1.2, 6.2, 2.4, "F")
    pdf.rect(cx - 1.2, cy - 3.1, 2.4, 6.2, "F")


def _build_qr_payload(
    invoice: Invoice,
    profile: TenantProfile,
    customer: Customer,
    amount: float,
) -> str:
    debtor_postal = f"{customer.postal_code} {customer.city}".strip()
    # A combined ("K") address has a single 70-character street line.
    debtor_street = ", ".join(
        part for part in (customer.address_line1, customer.address_line2) if part
    )[:70]
    fields = [
        "SPC", "0200", "1",
        profile.iban or "",
        "K",
        profile.company_name, profile.address_line1,
        f"{profile.postal_code} {profile.city}", "", "", "CH",
        "", "", "", "", "", "", "",
        f"{amount:.2f}", "CHF",
        "K",
        f"{customer.first_name} {customer.last_name}",
        debtor_street, debtor_postal, "", "", "CH",
        "NON", "",
        invoice.invoice_number or "",
        "EPD", "", "", "",
    ]
    return "\r\n".join(fields)
