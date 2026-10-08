# Usage workflows

This document describes the seller's real working situations and how the app
supports them. For each workflow:

- **Steps**: what the seller does;
- **In the app**: the current path, screen by screen;
- **Gaps**: what slows the workflow down or blocks it today.

Every form (invoice, customer, article, stock withdrawal) opens on a page of
its own: full screen on mobile, buttons pinned at the bottom, and the phone's
back button cancels. Only confirmations (payment, reminder, deletion) stay
dialogs.

The labels quoted below are those of the English interface; the French one
works the same way.

Vocabulary:

| Business term | In the app |
|---|---|
| Pre-order | **Draft** invoice |
| Confirm the order | **Issue** the invoice (number given, stock taken) |
| Receipt | PDF of a **paid** invoice: "Paid … on …", without due date or QR-bill |
| Reference number | **Invoice number** (`2610051`: date YYMMDD + number of the day, digits only): the TWINT message and the QR-bill's additional information |

---

## 1. Take a pre-order (by phone, on mobile)

The customer calls; the seller enters the order on their phone, then prepares
it at the shop.

**Steps**

1. Answer the call.
2. Open the app.
3. Look up the customer.
4. Create the customer if they do not exist yet.
5. Add a pre-order with the articles asked for.
6. Go back to the shop.
7. Prepare the order, then confirm it.
8. The customer comes to pick it up.

**In the app**

- 3–4. Menu → *Customers* → search by name, email or **phone number**, written
  any way (`079 123 45 67`, `+41791234567`, or only its end). In every list, the
  search starts from 3 characters, or at once with Enter. Otherwise *New
  customer* → *Save & create invoice*: the customer is created and the new
  invoice opens straight away. For a company, its name goes in *Last name or
  company*, without a first name; a contact person ("Par Mme …") goes in
  *Address line 2*.
- 5. Customer page → *New invoice* → *Add an article…*: each article picked
  (with the mouse, or the keyboard with the arrows and Enter) is added to the
  invoice, or raises its quantity if it is already there; *+ Free-text line* for
  a line outside the stock → *Save draft*.
- 7. *Invoices* → *Draft* tab → *Edit* → adjust the quantities → *Issue & Print*,
  or *Pay & Print* if the customer pays cash on pickup.

**Gaps**

- The phone search only finds the customers whose number is entered on their
  record.

## 2. Serve a customer at the shop

**Steps**

1. Open the app.
2. Add the articles the customer chose.
3. Prepare the goods.
4. Confirm the order and print:
   - the **receipt** if the customer pays at once;
   - the **invoice** (with QR-bill) otherwise.
5. If the customer paid, print a paper copy for the accounts.
6. The customer leaves with the goods.

**In the app**

- 2. *Customers* → customer page → *New invoice* → *Add an article…*, one article
  after the other.
- 4. Choose the payment method:
  - *Cash* → *Pay & Print*: the invoice is issued, marked paid today, and the
    receipt downloads;
  - *TWINT* or *Bank transfer (IBAN)* → *Issue & Print*: the invoice downloads.
- 5. Print the PDF a second time.

**Gaps**

- An invoice needs a **customer**: a walk-in customer means creating a record,
  or using a generic "Counter customer" record to create once.
- In the form, *Pay & Print* only exists for cash: a customer who pays on the
  spot with **TWINT** goes through *Issue & Print*, then *Pay* → *Pay & Print* in
  the list.

## 3. Receive a TWINT payment

**Steps**

1. Open the app.
2. Look up the customer, or the invoice by its reference number (the TWINT
   message).
3. Confirm the payment, adjust the date if needed, print a copy for the
   accounts.

**In the app**

- 2. *Invoices* → search (number, customer or article) → *Issued* tab.
- 3. *Pay* on the row → *Record the payment* dialog: date (today by default, not
  in the future) and payment method (the one planned on the invoice, to correct
  if needed) → *Pay & Print* downloads the receipt for the accounts. The same
  dialog opens from the customer page.

**Gaps**

None.

## 4. Receive an e-banking payment

**Steps**

1. Open the app.
2. Look up the invoice by its reference number (the transfer's message).
3. Confirm the payment, adjust the date if needed, print a copy for the
   accounts.

**In the app**

Same path as a TWINT payment. The QR-bill has no structured reference (`NON`):
the invoice number is in its *additional information*, which the bank copies
into the transfer's message.

**Gaps**

- No automatic matching (import of a camt.054 bank statement): each payment is
  confirmed by hand.

## 5. Quarterly check

**Steps**

1. Open the app.
2. Go to *Articles*.
3. Choose the period (year, quarter).
4. Note, for each article, the sales, the stock and the withdrawals of the
   period.

**In the app**

*Articles* → *Sales*: year → quarter. The *Sold* and *Withdrawn* columns follow
the period chosen; *Stock* is the **current** stock.

*Export CSV* downloads all the active articles of the period chosen, whatever
the search (`articles-2025-Q2.csv`): price, the article's own VAT (empty when it
follows the company's rate), stock, sold and withdrawn. With *Show archived*, it
exports the archived articles (`articles-archived-2025-Q2.csv`).

**Gaps**

- The stock shown is today's, not the one at the **end of the period**: a check
  done late does not give the right figure.

## 6. Add an article

**Steps**

1. Open the app.
2. Go to *Articles*.
3. Add the article with its initial stock.

**In the app**

*Articles* → *New article* → name, price, VAT, stock quantity.

**Gaps**

None.

## 7. Inventory (stock check)

**Steps**

1. Count the stock of each article.
2. Open the app.
3. Find each article and correct its stock.

**In the app**

*Articles* → *Inventory*: the *Stock* column becomes a field per article. Enter
the quantity counted; it replaces the stock when leaving the field (Tab, Enter),
and a ✓ marks the articles already counted. The mode is disabled on the list of
archived articles.

On purpose, the correction leaves no trace: only the new stock counts.

**Gaps**

None.

## 8. Send reminders

**Steps**

1. Go to the dashboard.
2. Find the overdue invoices.
3. Print the reminders.

**In the app**

*Dashboard* → *Overdue invoices* card (oldest first, with the days late and the
reminders already sent) → bell *Create a reminder* → *Create & print*.

- The reminder is **recorded** (1st, 2nd…) with its date and a new deadline: the
  reminder's date + the *Reminder deadline* of the settings (10 days by
  default).
- Its PDF repeats the invoice, titled "Reminder" or "Reminder no. 2", with the
  reminder's date, the new deadline, a short text and the same QR-bill.
- Only the bell creates a reminder: the PDF icon next to it, or the list of
  reminders in the invoice's details, prints it again without creating a new
  one.
- The same bell is on the overdue invoices of the invoice list and of the
  customer page.

**Gaps**

None.

## 9. Record a stock withdrawal

Articles leave the stock without being invoiced: tasting, a lot given away, a
broken bottle.

**Steps**

1. Open the app.
2. Note the article, the quantity and the reason.

**In the app**

*Stock withdrawals* → *New withdrawal* → article, searched by typing part of its
name as in an invoice (its stock is shown; ✕ to pick another), date, quantity,
reason (*Tasting*, *Promotion / gift*, *Loss / breakage*, *Other*) and a note.
The stock goes down at once; the withdrawal shows in the *Withdrawn* column of
the articles, over the period chosen.

A withdrawal cannot be edited: after a mistake, delete it (the stock comes back)
and enter it again.

The articles offered on an invoice show here too, as *Promotion / gift*, with a
link to their invoice: those are not deleted here, but by cancelling the
invoice (workflow 12).

**Gaps**

None.

## 10. Set up the company

At the first sign-in, the company profile is empty.

**Steps**

1. Enter the address, the IBAN and, if needed, the TWINT number, the VAT and the
   deadlines.

**In the app**

*Settings*: while the address or the IBAN is missing, a banner says so
(*Complete it*) and no invoice can be issued. The default VAT rate applies to
the articles without a rate of their own; empty, the company is not
VAT-registered. The TWINT number adds a "Pay with TWINT" block to the PDF.

**Gaps**

None.

## 11. Cancel an invoice

**Steps**

1. Find the invoice.
2. Cancel it.

**In the app**

*Invoices* (or the customer page) → *Cancel invoice* icon on the row, at once,
without confirmation:

- an **issued** invoice stays in the list, cancelled, with its number; its
  articles go back into the stock;
- a cancelled **draft** can then be deleted (*Delete the cancelled draft*): it
  had no number. An issued invoice is never deleted.

**Gaps**

None.

## 12. Invoice a business customer (café)

A café orders by quantity: it gets a price, and part of the order is given away
(one bottle per case of 12, for example).

**Steps**

1. Add the articles ordered.
2. Adapt the articles' price for the quantity deal.
3. Give away part of the order.
4. Confirm the order: the articles given away leave the stock as a promotion,
   not as a sale.

**In the app**

- 1. *Customers* → customer page → *New invoice* → the articles, one after the
  other.
- 2. The price of each line is edited in the editor (comma or point); it only
  holds for this invoice: the article's price does not change.
- 3. On the article's line, the gift icon (*Offer for free*) adds right below it
  a *Free* line of the same article, at 1, and stays pressed; another click (*No
  longer offer*) removes it. The quantity offered is entered on the *Free* line;
  its price (0.00) and VAT (none) cannot be edited. The ✕ of a free line only
  removes the gift; that of the article sold also removes its free lines. The
  PDF prints it on a line of its own, "Pinot Noir (free)" ("(offert)" in
  French), at 0.00: the total leaves it out.
- To change the order of the lines, drag a line by its handle (on the left); its
  free lines right below it follow: the gift stays under its article, on the
  invoice as on the PDF. With the keyboard, the ↑ ↓ arrows on the handle do the
  same.
- 4. On issue, the articles given away leave the stock with the others, but do
  not count as *Sold*: they become a *Promotion / gift* stock withdrawal, dated
  that day, with a link to the invoice (the articles' *Withdrawn* column).

That withdrawal follows its invoice: it cannot be deleted from *Stock
withdrawals* (the *Invoice …* link replaces the delete button). Cancelling the
invoice removes it, and the stock comes back. A gift entered by mistake on an
issued invoice is corrected like any mistake: cancel the invoice and enter it
again.

**Gaps**

None.
