# Zyma Pay Frontend

Frontend for the Zyma Systems payment operations application.

## Production architecture

- Frontend: `https://payments.zyma.co.za`
- API: `https://pay.zyma.co.za`
- Frontend hosting: GitHub Pages
- API hosting: VPS / ASP.NET Core
- Email service: Zoho Mail via the API
- Database and document storage: backend only

The GitHub Pages application must never contain database credentials, Zoho credentials, private keys, or other secrets.

## Frontend configuration

Edit `js/config.js`:

```js
API_BASE_URL: "https://pay.zyma.co.za/api",
API_ENABLED: false
```

Keep `API_ENABLED: false` while the backend is still being built.

When the backend is live and `/api/health` responds successfully, change it to:

```js
API_ENABLED: true
```

No build step is required. GitHub Pages serves the files directly.

## Authentication

The frontend is prepared for cookie-based authentication:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

The API should issue a `Secure` + `HttpOnly` authentication cookie from `pay.zyma.co.za`.

The frontend deliberately does **not** store passwords or bearer tokens in `localStorage`.

## Payment API contract

### List payments

`GET /api/payments?pageSize=100`

Recommended response:

```json
{
  "items": [],
  "totalCount": 0,
  "awaitingReflectionCount": 0,
  "paidCount": 0,
  "receivedThisMonth": 0.00
}
```

### Create payment

`POST /api/payments`

The frontend sends `multipart/form-data` with:

- `clientName`
- `clientEmail`
- `invoiceNumber`
- `receiptNumber`
- `amount`
- `paymentType`
- `paymentDate`
- `status`
- `proofOfPayment` — optional file
- `invoice` — optional file
- `salesReceipt` — optional file

The backend should validate file type and size before storing documents.

### Save payment draft

`POST /api/payments/drafts`

Same fields as a payment, except the backend should persist it as a draft and must not send a client email.

### Change payment status

`PATCH /api/payments/{id}/status`

```json
{
  "status": "awaiting_reflection"
}
```

or:

```json
{
  "status": "paid"
}
```

The backend should create an audit record for every status change, including the staff user and timestamp.

### Send payment email

`POST /api/payments/{id}/send-email`

The backend is responsible for sending the client email from:

`payments@zyma.co.za`

The frontend should never contain Zoho SMTP credentials.

## Supporting APIs prepared in `js/api.js`

Invoices:

- `GET /api/invoices`
- `POST /api/invoices`
- `PATCH /api/invoices/{id}`
- `DELETE /api/invoices/{id}`

Invoice records should persist and return `amount` as the final amount due, `subtotal` as the pre-discount amount, `discountPercent`, `discountAmount`, and `vatAmount`. Calculate VAT on the subtotal after discount. The frontend stores the original billable line items in `itemsJson`.

Sales receipts:

- `GET /api/sales-receipts`
- `POST /api/sales-receipts`
- `DELETE /api/sales-receipts/{id}`

Invoice and sales receipt numbers share one increasing sequence, starting at `INV-1101` / `SR-1101`. The next suffix is one greater than the highest number across both record types, so an existing `SR-1102` means the next invoice and receipt are `INV-1103` and `SR-1103`.

System:

- `GET /api/health`

## CORS

The ASP.NET Core API must allow the exact frontend origin:

`https://payments.zyma.co.za`

Credentials must be enabled because authentication uses an HttpOnly cookie.

Do not use `AllowAnyOrigin()` together with credentialed requests.

## GitHub Pages deployment

1. Create or open the GitHub repository for this frontend.
2. Push the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select the production branch, normally `main`, and `/ (root)`.
6. Set the custom domain to:

   `payments.zyma.co.za`

7. GitHub will show the DNS record it expects. Use the exact CNAME target shown by GitHub.
8. Wait for HTTPS certificate provisioning.
9. Open:

   `https://payments.zyma.co.za`

The included `CNAME` file already contains the intended custom domain.

## DNS

The API and frontend are intentionally separate:

```text
payments.zyma.co.za  → GitHub Pages
pay.zyma.co.za       → VPS / Nginx / ASP.NET Core
```

Do not point `payments.zyma.co.za` at the VPS.

## Backend readiness checklist

Before switching `API_ENABLED` to `true`:

- [ ] `https://pay.zyma.co.za/api/health` works
- [ ] HTTPS certificate is valid
- [ ] CORS allows `https://payments.zyma.co.za`
- [ ] Login endpoint works
- [ ] HttpOnly authentication cookie is configured
- [ ] `GET /api/auth/me` works
- [ ] `GET /api/payments` works
- [ ] `POST /api/payments` accepts multipart uploads
- [ ] Payment status changes create audit entries
- [ ] Document storage is private
- [ ] Zoho credentials exist only on the backend
- [ ] `POST /api/payments/{id}/send-email` sends from `payments@zyma.co.za`
- [ ] Backend validates authorization for every protected endpoint

## Public repository safety

This repository is intended to be public. It must contain only frontend code and non-sensitive configuration. Do not commit client records, payment records, uploaded documents, passwords, API tokens, database credentials, private certificates, SMTP credentials, or production exports.

## Current prototype behaviour

With `API_ENABLED: false`, the existing browser prototype remains usable. Payment drafts/statuses and the existing invoice/sales-receipt prototype continue using their current browser-based behaviour.

Once API mode is enabled, the main payment workflow switches to the backend for:

- staff profile
- payment listing
- payment creation
- document upload
- payment status changes
- payment drafts

The frontend is therefore ready to move from prototype storage to the VPS API without changing the public GitHub Pages domain.


## System pages and Super Admin model

The frontend now includes dedicated pages for:

- `templates.html` — email template management
- `activity.html` — audit/activity log
- `settings.html` — organisation, payment-method and payment-rule configuration
- `staff-access.html` — staff invitations, roles and access management

The public GitHub Pages frontend contains no staff records, client records, payment records, credentials, email credentials or template bodies. These pages are empty until the API supplies data.

### Roles

The backend should support these roles:

1. `super_admin` — full system administration, staff management, roles, system configuration and operational access.
2. `administrator` — operational administration without Super Admin-only account/bootstrap controls.
3. `finance` — payment, invoice, receipt, document and payment-communication operations.
4. `staff` — operational access granted by an administrator.
5. `viewer` — read-only access.

The first Super Admin should be created by a secure backend bootstrap process or server-side setup procedure. Do **not** create a default Super Admin username/password in the GitHub repository. After bootstrap, the Super Admin can invite relevant staff and assign roles.

### Additional API contract

- `GET /api/email-templates`
- `POST /api/email-templates`
- `PATCH /api/email-templates/{id}`
- `GET /api/activity`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/settings/payment-methods`
- `POST /api/settings/payment-methods`
- `GET /api/staff`
- `POST /api/staff/invitations`
- `PATCH /api/staff/{id}/role`
- `PATCH /api/staff/{id}/status`

All Super Admin restrictions must be enforced server-side. Hiding controls in the frontend is only a usability measure and is not an authorization boundary.

### CORS

The API should allow the production frontend origin exactly:

`https://payments.zyma.co.za`

Do not use `AllowAnyOrigin()` with credentialed authentication. The API should return the appropriate credentialed CORS headers for this single frontend origin.
