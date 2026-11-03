# Zyma Pay Financial Insights

The dashboard now includes frontend support for:

- Financial KPI cards for total confirmed cash recorded, outstanding issued-invoice balances, the leading client's share of confirmed payments this month, and collection rate against issued invoice value.
- Explicit "Not tracked" states for monthly recurring revenue, operating expenses, and net operating profit until subscription and expense data are available.
- A six-month confirmed-cash histogram, a client revenue contribution bar chart, and a cash-versus-receivables pie chart, alongside the existing revenue trend line and payment-status donut charts.
- Revenue by client, grouped by current month, current quarter, current year, or all time.
- Outstanding issued invoice balances, net of confirmed payments matched by invoice number.
- Cash-flow estimates for 7, 30, or 90 days, separating overdue, due-within-horizon, and invoices without due dates.
- Invoice-to-payment matching summaries and unmatched payment reference detection.
- CSV exports for financial records and outstanding invoice balances.
- A clearly marked planned payment-reminder area for a future n8n integration. It does not send reminders or claim automation is active.

## Data and accounting notes

- Revenue figures include only payments with status `Paid`.
- Total cash collected sums confirmed payments currently loaded by the dashboard. The leading-client contribution is that client's share of confirmed payment value for the current calendar month.
- Collection rate is confirmed payments matched by invoice number divided by total issued invoice value, with each invoice's collected amount capped at its invoice value. It is an all-time rate over the invoice and payment records currently loaded.
- The monthly histogram includes the current month and the preceding five calendar months. The client bar chart follows the selected client revenue period and groups clients beyond the top five as "Other clients". The pie chart compares all loaded confirmed payments with open balances on issued invoices; it is a position comparison, not a forecast or a reconciliation of those two independently sourced totals.
- Monthly recurring revenue, operating expenses, and net operating profit are not calculated because the current data sources do not contain subscription or expense records.
- Awaiting-reflection and cancelled payments do not reduce outstanding invoice balances.
- Draft and cancelled invoices are excluded from outstanding balances and forecasts.
- Forecasts are estimates from remaining issued-invoice balances and due dates; they are not guaranteed receipts.
- Matching is currently based on the invoice number on a confirmed payment. Production matching should use stable invoice/payment IDs from the backend when those relationships are exposed by the API.
- CSV exports are generated in the browser from the records currently loaded by the frontend. They are not a substitute for a formal accounting ledger or tax report.
