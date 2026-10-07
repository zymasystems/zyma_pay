/**
 * Zyma Pay frontend runtime configuration.
 *
 * This file is intentionally public because the frontend is hosted on GitHub Pages.
 * Never put passwords, API keys, database credentials or Zoho credentials here.
 */
window.ZYMA_PAY_CONFIG = Object.freeze({
    API_BASE_URL: "https://pay.zyma.co.za/api",

    // Keep false while the ASP.NET Core API is being built.
    // Change to true once https://pay.zyma.co.za/api/health is live.
    API_ENABLED: true,

    REQUEST_TIMEOUT_MS: 15000,

    // The API uses an HttpOnly authentication cookie.
    // The browser sends it with same-site HTTPS requests via credentials: include.
    AUTH_MODE: "cookie"
});
