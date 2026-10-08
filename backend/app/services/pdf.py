from __future__ import annotations

import io
import re
from decimal import Decimal
from typing import TYPE_CHECKING, Literal

from fpdf import FPDF

from app.services.customers import full_name
from app.services.invoices import invoice_amounts, invoice_total

if TYPE_CHECKING:
    from datetime import date

    from app.models.customer import Customer
    from app.models.invoice import Invoice, InvoiceLine, InvoiceReminder
    from app.models.tenant import TenantProfile

_M = 15  # left/right margin mm
_W = 210  # A4 width mm
_CW = [85, 18, 31, 31]  # column widths for lines table
_SLIP_Y = 192.0  # QR slip top y mm (297-105)

Lang = Literal["en", "fr"]

# QR slip wording follows the SIX Swiss Payment Standards for each language.
_LABELS: dict[Lang, dict[str, str]] = {
    "en": {
        "invoice": "Invoice",
        "phone": "Phone: {phone}",
        "vat_number": "VAT no.: {number}",
        "date": "Date:",
        "due": "Due:",
        "bill_to": "Bill to:",
        "description": "Description",
        "offered": "{description} (free)",
        "qty": "Qty",
        "unit_price": "Unit price",
        "total": "Total",
        "subtotal": "Subtotal",
        "discount": "Discount",
        "vat": "VAT",
        "twint_title": "Pay with TWINT",
        "twint_send": "Send CHF {amount} to {phone}",
        "twint_message": ", message: {number}",
        "paid_on": "Paid on {date}",
        "paid_on_cash": "Paid in cash on {date}",
        "paid_on_twint": "Paid by TWINT on {date}",
        "paid_on_iban": "Paid by bank transfer on {date}",
        "receipt": "Receipt",
        "payment_part": "Payment part",
        "payable_to": "Account / Payable to",
        "payable_by": "Payable by",
        "payable_by_blank": "Payable by (name/address)",
        "acceptance_point": "Acceptance point",
        "additional_info": "Additional information",
        "currency": "Currency",
        "amount": "Amount",
        "reminder_1": "Reminder",
        "reminder_n": "Reminder no. {n}",
        "reminder_date": "Reminder:",
        "reminder_due": "Pay by:",
        "reminder_text": (
            "Unless we are mistaken, the invoice below, due on {due}, has not been paid yet. "
            "Please pay the amount due by {deadline}. If your payment has crossed this "
            "reminder, please disregard it."
        ),
    },
    "fr": {
        "invoice": "Facture",
        "phone": "Tél. : {phone}",
        "vat_number": "N° TVA : {number}",
        "date": "Date :",
        "due": "Échéance :",
        "bill_to": "Facturé à :",
        "description": "Désignation",
        "offered": "{description} (offert)",
        "qty": "Qté",
        "unit_price": "Prix unit.",
        "total": "Total",
        "subtotal": "Sous-total",
        "discount": "Rabais",
        "vat": "TVA",
        "twint_title": "Payer avec TWINT",
        "twint_send": "Envoyez CHF {amount} au {phone}",
        "twint_message": ", message : {number}",
        "paid_on": "Acquittée le {date}",
        "paid_on_cash": "Acquittée en espèces le {date}",
        "paid_on_twint": "Acquittée par TWINT le {date}",
        "paid_on_iban": "Acquittée par virement le {date}",
        "receipt": "Récépissé",
        "payment_part": "Section paiement",
        "payable_to": "Compte / Payable à",
        "payable_by": "Payable par",
        "payable_by_blank": "Payable par (nom/adresse)",
        "acceptance_point": "Point de dépôt",
        "additional_info": "Informations supplémentaires",
        "currency": "Monnaie",
        "amount": "Montant",
        "reminder_1": "Rappel",
        "reminder_n": "{n}e rappel",
        "reminder_date": "Rappel :",
        "reminder_due": "À payer d'ici :",
        "reminder_text": (
            "Sauf erreur de notre part, la facture ci-dessous, échue le {due}, n'a pas encore "
            "été réglée. Nous vous remercions de verser le montant dû d'ici le {deadline}. "
            "Si votre paiement a croisé ce rappel, veuillez ne pas en tenir compte."
        ),
    },
}


def generate_invoice_pdf(
    invoice: Invoice,
    customer: Customer,
    profile: TenantProfile,
    lang: Lang = "fr",
    reminder: InvoiceReminder | None = None,
) -> bytes:
    """The invoice, or with ``reminder`` the payment reminder for it: same lines and QR-bill."""
    t = _LABELS[lang]
    lines = invoice.lines
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()

    y = _header(pdf, profile, invoice, reminder, t)
    y = _customer_block(pdf, customer, y, t)
    if reminder is not None and invoice.due_date is not None:
        y = _reminder_text(pdf, invoice.due_date, reminder.due_on, y, t)
    y = _lines_table(pdf, lines, y, t)
    y = _totals_block(pdf, invoice, y, t)
    # A paid invoice serves as a receipt: no payment means, so it is not paid twice.
    if invoice.paid_at is None:
        if profile.twint_phone:
            _twint_block(pdf, invoice, profile.twint_phone, y, t)
        if profile.iban:
            _qr_slip(pdf, invoice, customer, profile, t)

    return bytes(pdf.output())


# ---- sections ---------------------------------------------------------------


def _header(
    pdf: FPDF,
    profile: TenantProfile,
    invoice: Invoice,
    reminder: InvoiceReminder | None,
    t: dict[str, str],
) -> float:
    if reminder is None:
        title = t["invoice"]
    elif reminder.number == 1:
        title = t["reminder_1"]
    else:
        title = t["reminder_n"].format(n=reminder.number)
    pdf.set_xy(_M, 15)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(80, 7, profile.company_name)
    pdf.set_xy(115, 15)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(80, 7, title, align="R")

    pdf.set_font("Helvetica", "", 9)
    y_left = 24.0
    lines = _creditor_lines(profile)[1:]  # the name is the title above
    if profile.phone:
        lines.append(t["phone"].format(phone=_local_phone(profile.phone)))
    # Only for a VAT-registered business, which must print it.
    if profile.vat_number:
        lines.append(t["vat_number"].format(number=profile.vat_number))
    for text in lines:
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
    # Once paid, the invoice is a receipt: a due date would read as still owed.
    if invoice.due_date and invoice.paid_at is None:
        pdf.set_xy(115, y_right)
        pdf.cell(80, 5, f"{t['due']} {invoice.due_date.strftime('%d.%m.%Y')}", align="R")
        y_right += 5
    if reminder is not None:
        pdf.set_font("Helvetica", "B", 9)
        for label, day in [
            (t["reminder_date"], reminder.sent_on),
            (t["reminder_due"], reminder.due_on),
        ]:
            pdf.set_xy(115, y_right)
            pdf.cell(80, 5, f"{label} {day.strftime('%d.%m.%Y')}", align="R")
            y_right += 5
        pdf.set_font("Helvetica", "", 9)

    return max(y_left, y_right) + 5


def _reminder_text(pdf: FPDF, due: date, deadline: date, y: float, t: dict[str, str]) -> float:
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "", 9)
    text = t["reminder_text"].format(
        due=due.strftime("%d.%m.%Y"), deadline=deadline.strftime("%d.%m.%Y")
    )
    pdf.multi_cell(_W - 2 * _M, 5, text)
    return pdf.get_y() + 5


def _customer_block(pdf: FPDF, customer: Customer, y: float, t: dict[str, str]) -> float:
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(80, 5, t["bill_to"])
    y += 5
    name, *address = _debtor_lines(customer)
    pdf.set_xy(_M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(80, 5, name)
    y += 5
    pdf.set_font("Helvetica", "", 9)
    for text in address:
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
        price = Decimal(ln.unit_price_snapshot)
        description = ln.description_snapshot
        cells = [
            t["offered"].format(description=description) if ln.offered else description,
            str(ln.quantity),
            _chf(price),
            _chf(ln.quantity * price),
        ]
        pdf.set_xy(_M, y)
        for w, text in zip(_CW, cells, strict=True):
            pdf.cell(w, 5, text, align="L" if text == cells[0] else "R")
        y += 5
    return y + 3


def _totals_block(pdf: FPDF, invoice: Invoice, y: float, t: dict[str, str]) -> float:
    amounts = invoice_amounts(invoice)
    percent = float(invoice.discount_percent)

    x_lbl = _M + _CW[0] + _CW[1]
    w_lbl, w_amt = _CW[2], _CW[3]

    rows: list[tuple[str, Decimal, bool]] = [(t["subtotal"], amounts.subtotal, False)]
    if amounts.discount:
        rows.append((f"{t['discount']} ({percent:.1f} %)", -amounts.discount, False))
    rows.extend((f"{t['vat']} {rate * 100:.1f} %", vat, False) for rate, vat in amounts.vat.items())
    rows.append(("TOTAL CHF", amounts.total, True))

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
        method = invoice.payment_method
        paid_on = t[f"paid_on_{method.value}"] if method else t["paid_on"]
        pdf.cell(
            w_lbl + w_amt,
            5,
            paid_on.format(date=invoice.paid_at.strftime("%d.%m.%Y")),
            align="R",
        )
        y += 5
    # Never the notes: they are internal (a paper reference, a reminder to self).
    return y + 5


def _twint_block(
    pdf: FPDF,
    invoice: Invoice,
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
    text = t["twint_send"].format(amount=_chf(invoice_total(invoice)), phone=local)
    if invoice.invoice_number:
        text += t["twint_message"].format(number=invoice.invoice_number)
    pdf.cell(_W - 2 * _M, 5, text)


def _local_phone(phone: str) -> str:
    """+41791234567 -> 079 123 45 67, the form Swiss customers dial; others stay E.164."""
    if phone.startswith("+41") and len(phone) == 12:
        return f"0{phone[3:5]} {phone[5:8]} {phone[8:10]} {phone[10:]}"
    return phone


# ---- payment ----------------------------------------------------------------


def _chf(amount: Decimal, sep: str = "'") -> str:
    """1234.5 -> 1'234.50, the Swiss convention; the QR slip mandates a space."""
    return f"{amount:,.2f}".replace(",", sep)


# ---- Swiss QR payment slip --------------------------------------------------
# Layout of the Swiss Implementation Guidelines for the QR-bill (v2.3, chapter 3):
# a 62 mm receipt, then the payment part, 5 mm margins; font sizes in points.

_RECEIPT_W = 62.0
_PAYMENT_X = _RECEIPT_W + 5
_INFO_X = _PAYMENT_X + 46 + 5  # right of the QR code
_PT = 25.4 / 72  # one point, in mm


def _qr_slip(
    pdf: FPDF,
    invoice: Invoice,
    customer: Customer,
    profile: TenantProfile,
    t: dict[str, str],
) -> None:
    amount = invoice_total(invoice)
    iban = " ".join(_chunks((profile.iban or "").replace(" ", ""), 4))
    creditor = [
        iban,
        *_slip_party(
            profile.company_name,
            profile.address_line1,
            profile.postal_code,
            profile.city,
            profile.country,
        ),
    ]
    debtor = (
        _slip_party(
            full_name(customer),
            customer.address_line1,
            customer.postal_code,
            customer.city,
            customer.country,
        )
        if _has_address(customer.postal_code, customer.city)
        else None
    )
    _cut_lines(pdf)

    # Receipt: headings 6 pt, values 8 pt; no additional information.
    x, width = 5.0, _RECEIPT_W - 10
    _slip_title(pdf, x, t["receipt"])
    y = _slip_field(pdf, x, _SLIP_Y + 12, width, t["payable_to"], creditor, 6)
    _slip_payer(pdf, x, y, width, t, debtor, 6, box=(52, 20))
    _slip_amount(pdf, x, amount, t, 6)
    pdf.set_xy(x, _SLIP_Y + 82)
    pdf.set_font("Helvetica", "B", 6)
    pdf.cell(width, 4, t["acceptance_point"], align="R")

    # Payment part: headings 8 pt, values 10 pt.
    _slip_title(pdf, _PAYMENT_X, t["payment_part"])
    _draw_qr_code(pdf, invoice, profile, customer, amount, _PAYMENT_X, _SLIP_Y + 17)
    _slip_amount(pdf, _PAYMENT_X, amount, t, 8)
    x, width = _INFO_X, _W - 5 - _INFO_X
    y = _slip_field(pdf, x, _SLIP_Y + 5, width, t["payable_to"], creditor, 8)
    if invoice.invoice_number:
        y = _slip_field(pdf, x, y, width, t["additional_info"], [invoice.invoice_number], 8)
    _slip_payer(pdf, x, y, width, t, debtor, 8, box=(65, 25))


def _chunks(text: str, size: int) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)]


def _has_address(postal_code: str, city: str) -> bool:
    """A structured address needs both; without them the payer is left blank."""
    return bool(postal_code and city)


def _slip_party(name: str, line1: str, postal_code: str, city: str, country: str) -> list[str]:
    """As the QR code carries it: no address complement (c/o, PO box), which
    belongs on the invoice; a country code before the postal code when abroad."""
    prefix = "" if country == "CH" else f"{country}-"
    return [text for text in (name, line1, f"{prefix}{postal_code} {city}") if text.strip()]


def _cut_lines(pdf: FPDF) -> None:
    """Dashed lines around the receipt and payment part, with the scissors a PDF
    slip must show for whoever prints it."""
    pdf.set_draw_color(0, 0, 0)
    pdf.set_dash_pattern(dash=2, gap=2)
    pdf.line(0, _SLIP_Y, _W, _SLIP_Y)
    pdf.line(_RECEIPT_W, _SLIP_Y, _RECEIPT_W, 297)
    pdf.set_dash_pattern()
    pdf.set_font("ZapfDingbats", "", 10)
    scissors = "\x22"
    pdf.text(8, _SLIP_Y + 1.3, scissors)
    with pdf.rotation(-90, _RECEIPT_W, _SLIP_Y + 10):
        pdf.text(_RECEIPT_W - 1.6, _SLIP_Y + 10 + 1.3, scissors)


def _slip_title(pdf: FPDF, x: float, title: str) -> None:
    pdf.set_xy(x, _SLIP_Y + 5)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(50, 5, title)


def _slip_field(
    pdf: FPDF, x: float, y: float, width: float, heading: str, values: list[str], size: int
) -> float:
    """A heading over its values (2 pt larger), then a blank line; returns the next y."""
    line = (size + 3) * _PT
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", size)
    pdf.cell(width, line, heading)
    y += line
    pdf.set_font("Helvetica", "", size + 2)
    for value in values:
        pdf.set_xy(x, y)
        pdf.multi_cell(width, line, value)
        y = pdf.get_y()
    return y + line


def _slip_payer(
    pdf: FPDF,
    x: float,
    y: float,
    width: float,
    t: dict[str, str],
    debtor: list[str] | None,
    size: int,
    box: tuple[float, float],
) -> None:
    if debtor is not None:
        _slip_field(pdf, x, y, width, t["payable_by"], debtor, size)
        return
    # No payer in the QR code: a field to fill in by hand.
    line = (size + 3) * _PT
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", size)
    pdf.cell(width, line, t["payable_by_blank"])
    _corner_marks(pdf, x + pdf.c_margin, y + line + 1, *box)


def _corner_marks(pdf: FPDF, x: float, y: float, width: float, height: float) -> None:
    """The black corners (0.75 pt) of a blank field."""
    previous = pdf.line_width
    pdf.set_line_width(0.75 * _PT)
    for cx, dx in ((x, 3), (x + width, -3)):
        for cy, dy in ((y, 2), (y + height, -2)):
            pdf.line(cx, cy, cx + dx, cy)
            pdf.line(cx, cy, cx, cy + dy)
    pdf.set_line_width(previous)


def _slip_amount(pdf: FPDF, x: float, amount: Decimal, t: dict[str, str], size: int) -> None:
    line = (size + 3) * _PT
    currency = 2 * size  # mm, wide enough for "Currency" / "Monnaie"
    pdf.set_xy(x, _SLIP_Y + 68)
    pdf.set_font("Helvetica", "B", size)
    pdf.cell(currency, line, t["currency"])
    pdf.cell(30, line, t["amount"])
    pdf.set_xy(x, _SLIP_Y + 68 + line)
    pdf.set_font("Helvetica", "", size + 2)
    pdf.cell(currency, line, "CHF")
    pdf.cell(30, line, _chf(amount, " "))


_PO_BOX = re.compile(r"(case postale|cp|postfach|casella postale|po box)\b", re.IGNORECASE)


def _party_lines(
    name: str, line1: str, line2: str | None, postal_code: str, city: str
) -> list[str]:
    """Name, then the address as Swiss Post orders it, blank lines dropped: a
    contact person or c/o ("Par Mme Dupuis") above the street, a PO box below."""
    street = [line1, line2] if line2 and _PO_BOX.match(line2) else [line2, line1]
    return [text for text in (name, *street, f"{postal_code} {city}".strip()) if text]


def _creditor_lines(profile: TenantProfile) -> list[str]:
    return _party_lines(
        profile.company_name,
        profile.address_line1,
        profile.address_line2,
        profile.postal_code,
        profile.city,
    )


def _debtor_lines(customer: Customer) -> list[str]:
    return _party_lines(
        full_name(customer),
        customer.address_line1,
        customer.address_line2,
        customer.postal_code,
        customer.city,
    )


def _draw_qr_code(
    pdf: FPDF,
    invoice: Invoice,
    profile: TenantProfile,
    customer: Customer,
    amount: Decimal,
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
    _swiss_cross(pdf, x + 23, y + 23)


def _swiss_cross(pdf: FPDF, cx: float, cy: float) -> None:
    """The 7 mm Swiss cross: a white cross on a black square, in a white frame."""
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(cx - 3.65, cy - 3.65, 7.3, 7.3, "F")
    pdf.set_fill_color(0, 0, 0)
    pdf.rect(cx - 3.4, cy - 3.4, 6.8, 6.8, "F")
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(cx - 2.03, cy - 0.61, 4.06, 1.22, "F")
    pdf.rect(cx - 0.61, cy - 2.03, 1.22, 4.06, "F")


# "Rte de la Forêt 13", "Rue du Lac 2bis", "Chemin 4 A", "Av. 12-14"; or "13, rue du Lac".
_NUMBER_LAST = re.compile(
    r"(?P<street>.*?),?\s+(?P<number>\d+(?:\s?[a-z]{1,3})?(?:\s?[-/]\s?\d+[a-z]?)?)",
    re.IGNORECASE,
)
_NUMBER_FIRST = re.compile(
    r"(?P<number>\d+[a-z]?),?\s+(?P<street>\D.*)",
    re.IGNORECASE,
)


def _street_and_number(line: str) -> tuple[str, str]:
    """A structured address keeps the house number out of the street."""
    line = line.strip()
    match = _NUMBER_LAST.fullmatch(line) or _NUMBER_FIRST.fullmatch(line)
    if match is None or not match["street"]:
        return line, ""
    return match["street"], match["number"]


def _structured_address(
    name: str, line1: str, postal_code: str, city: str, country: str
) -> list[str]:
    """The 7 fields of a structured ("S") address, the only type QR-bills accept
    since November 2025. Without postal code and town, the party is left blank."""
    if not _has_address(postal_code, city):
        return [""] * 7
    street, number = _street_and_number(line1)
    return ["S", name[:70], street[:70], number[:16], postal_code[:16], city[:35], country]


def _build_qr_payload(
    invoice: Invoice,
    profile: TenantProfile,
    customer: Customer,
    amount: Decimal,
) -> str:
    fields = [
        "SPC",
        "0200",
        "1",
        profile.iban or "",
        *_structured_address(
            profile.company_name,
            profile.address_line1,
            profile.postal_code,
            profile.city,
            profile.country,
        ),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        f"{amount:.2f}",
        "CHF",
        *_structured_address(
            full_name(customer),
            customer.address_line1,
            customer.postal_code,
            customer.city,
            customer.country,
        ),
        "NON",
        "",
        invoice.invoice_number or "",
        # The optional billing information and alternative procedures are left out.
        "EPD",
    ]
    return "\r\n".join(fields)
