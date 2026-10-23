# Zyma Pay Financial Insights

The dashboard now includes frontend support for:

- Revenue by client, grouped by current month, current quarter, current year, or all time.
- Outstanding issued invoice balances, net of confirmed payments matched by invoice number.
- Cash-flow estimates for 7, 30, or 90 days, separating overdue, due-within-horizon, and invoices without due dates.
- Invoice-to-payment matching summaries and unmatched payment reference detection.
- CSV exports for financial records and outstanding invoice balances.
- A clearly marked planned payment-reminder area for a future n8n integration. It does not send reminders or claim automation is active.

## Data and accounting notes

- Revenue figures include only payments with status `Paid`.
- Awaiting-reflection and cancelled payments do not reduce outstanding invoice balances.
- Draft and cancelled invoices are excluded from outstanding balances and forecasts.
- Forecasts are estimates from remaining issued-invoice balances and due dates; they are not guaranteed receipts.
- Matching is currently based on the invoice number on a confirmed payment. Production matching should use stable invoice/payment IDs from the backend when those relationships are exposed by the API.
- CSV exports are generated in the browser from the records currently loaded by the frontend. They are not a substitute for a formal accounting ledger or tax report.
