from __future__ import annotations

import io
from typing import TYPE_CHECKING

from fpdf import FPDF

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.invoice import Invoice, InvoiceLine
    from app.models.tenant import TenantProfile

_M = 15      # left/right margin mm
_W = 210     # A4 width mm
_CW = [85, 18, 31, 31]  # column widths for lines table
_SLIP_Y = 192.0          # QR slip top y mm (297-105)


def generate_invoice_pdf(
    invoice: Invoice,
    lines: list[InvoiceLine],
    customer: Customer,
    profile: TenantProfile,
) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()

    y = _header(pdf, profile, invoice)
    y = _customer_block(pdf, customer, y)
    y = _lines_table(pdf, lines, y)
    _totals_block(pdf, invoice, lines, y)
    if profile.iban:
        _qr_slip(pdf, invoice, lines, customer, profile)

    return bytes(pdf.output())


# ---- sections ---------------------------------------------------------------

def _header(pdf: FPDF, profile: TenantProfile, invoice: Invoice) -> float:
    pdf.set_xy(_M, 15)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(80, 7, profile.company_name)
    pdf.set_xy(115, 15)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(80, 7, "Invoice", align="R")

    pdf.set_font("Helvetica", "", 9)
    y_left = 24.0
    for text in [profile.address_line1, f"{profile.postal_code} {profile.city}"]:
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
        pdf.cell(80, 5, f"Date: {invoice.issue_date.strftime('%d.%m.%Y')}", align="R")
        y_right += 5
    if invoice.due_date:
        pdf.set_xy(115, y_right)
        pdf.cell(80, 5, f"Due: {invoice.due_date.strftime('%d.%m.%Y')}", align="R")
        y_right += 5

    return max(y_left, y_right) + 5


def _customer_block(pdf: FPDF, customer: Customer, y: float) -> float:
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(80, 5, "Bill to:")
    y += 5
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(80, 5, f"{customer.first_name} {customer.last_name}")
    y += 5
    pdf.set_font("Helvetica", "", 9)
    for text in [customer.address_line1, f"{customer.postal_code} {customer.city}"]:
        if text.strip():
            pdf.set_xy(_M, y)
            pdf.cell(80, 5, text)
            y += 5
    return y + 5


def _lines_table(pdf: FPDF, lines: list[InvoiceLine], y: float) -> float:
    pdf.set_fill_color(235, 235, 235)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(_M, y)
    for w, h in zip(_CW, ["Description", "Qty", "Unit price", "Total"], strict=True):
        align = "L" if h == "Description" else "R"
        pdf.cell(w, 6, h, border="B", fill=True, align=align)
    y += 6

    pdf.set_font("Helvetica", "", 9)
    for ln in lines:
        total = ln.quantity * float(ln.unit_price_snapshot)
        cells = [
            ln.description_snapshot,
            str(ln.quantity),
            f"{float(ln.unit_price_snapshot):.2f}",
            f"{total:.2f}",
        ]
        pdf.set_xy(_M, y)
        for w, text in zip(_CW, cells, strict=True):
            pdf.cell(w, 5, text, align="L" if text == cells[0] else "R")
        y += 5
    return y + 3


def _totals_block(pdf: FPDF, invoice: Invoice, lines: list[InvoiceLine], y: float) -> None:
    subtotal = sum(ln.quantity * float(ln.unit_price_snapshot) for ln in lines)
    disc_pct = float(invoice.discount_percent)
    disc_amt = subtotal * disc_pct / 100

    vat_groups: dict[str, float] = {}
    for ln in lines:
        if ln.vat_rate_snapshot is not None:
            rate = float(ln.vat_rate_snapshot)
            base = ln.quantity * float(ln.unit_price_snapshot) * (1 - disc_pct / 100)
            key = f"VAT {rate * 100:.1f} %"
            vat_groups[key] = vat_groups.get(key, 0) + base * rate
    vat_total = sum(vat_groups.values())
    grand_total = subtotal - disc_amt + vat_total

    x_lbl = _M + _CW[0] + _CW[1]
    w_lbl, w_amt = _CW[2], _CW[3]

    rows: list[tuple[str, float, bool]] = [("Subtotal", subtotal, False)]
    if disc_amt:
        rows.append((f"Discount ({disc_pct:.1f} %)", -disc_amt, False))
    rows.extend((k, v, False) for k, v in vat_groups.items())
    rows.append(("TOTAL CHF", grand_total, True))

    for label, amount, bold in rows:
        pdf.set_xy(x_lbl, y)
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.cell(w_lbl, 5, label, align="R")
        pdf.cell(w_amt, 5, f"{amount:,.2f}", align="R")
        if bold:
            pdf.set_draw_color(0, 0, 0)
            pdf.line(x_lbl, y, x_lbl + w_lbl + w_amt, y)
        y += 5

    if invoice.notes:
        y += 5
        pdf.set_xy(_M, y)
        pdf.set_font("Helvetica", "I", 9)
        pdf.multi_cell(_W - 2 * _M, 5, invoice.notes)


# ---- Swiss QR payment slip --------------------------------------------------

def _qr_slip(
    pdf: FPDF,
    invoice: Invoice,
    lines: list[InvoiceLine],
    customer: Customer,
    profile: TenantProfile,
) -> None:
    subtotal = sum(ln.quantity * float(ln.unit_price_snapshot) for ln in lines)
    disc_pct = float(invoice.discount_percent)
    vat = sum(
        ln.quantity * float(ln.unit_price_snapshot)
        * (1 - disc_pct / 100) * float(ln.vat_rate_snapshot)
        for ln in lines
        if ln.vat_rate_snapshot is not None
    )
    amount = subtotal * (1 - disc_pct / 100) + vat

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
    _slip_title(pdf, _M - 5, _SLIP_Y + 4, "Receipt")
    _slip_section(pdf, _M - 5, _SLIP_Y + 10, "Account / Payable to", profile)
    _slip_amount(pdf, _M - 5, _SLIP_Y + 55, amount)
    _slip_section(pdf, _M - 5, _SLIP_Y + 70, "Payable by", customer)
    pdf.set_xy(_M - 5, _SLIP_Y + 90)
    pdf.set_font("Helvetica", "B", 6)
    pdf.cell(47, 4, "Acceptance point", align="R")

    # --- Payment section (right 148mm starting at x=62) ---
    px = 67  # 62 + 5 margin
    _slip_title(pdf, px, _SLIP_Y + 4, "Payment part")

    # QR code
    qr_x, qr_y = 67.0, _SLIP_Y + 17
    _draw_qr_code(pdf, invoice, profile, customer, amount, qr_x, qr_y)

    # Currency + amount below QR code
    _slip_amount(pdf, px, qr_y + 50, amount)

    # Creditor info right column
    rx = 120.0
    _slip_section(pdf, rx, _SLIP_Y + 10, "Account / Payable to", profile)
    _slip_section(pdf, rx, _SLIP_Y + 48, "Payable by", customer)
    if invoice.invoice_number:
        pdf.set_xy(rx, _SLIP_Y + 75)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(80, 4, "Reference / additional info")
        pdf.set_xy(rx, _SLIP_Y + 79)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(80, 4, invoice.invoice_number or "")


def _slip_title(pdf: FPDF, x: float, y: float, title: str) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 11 if title == "Payment part" else 8)
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
            f"{c.postal_code} {c.city}",
        ]:
            if text.strip():
                pdf.set_xy(x, y)
                pdf.cell(55, 4, text)
                y += 4


def _slip_amount(pdf: FPDF, x: float, y: float, amount: float) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(15, 4, "Currency")
    pdf.cell(25, 4, "Amount")
    pdf.set_xy(x, y + 4)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(15, 5, "CHF")
    pdf.cell(25, 5, f"{amount:,.2f}")


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

    debtor_postal = f"{customer.postal_code} {customer.city}".strip()
    data = "\r\n".join([
        "SPC", "0200", "1",
        profile.iban or "",
        "K",
        profile.company_name, profile.address_line1,
        f"{profile.postal_code} {profile.city}", "", "", "CH",
        f"{amount:.2f}", "CHF",
        "K",
        f"{customer.first_name} {customer.last_name}",
        customer.address_line1, debtor_postal, "", "", "CH",
        "NON", "",
        invoice.invoice_number or "",
        "EPD",
    ])

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
