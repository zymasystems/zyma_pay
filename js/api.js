
(() => {
    const config = window.ZYMA_PAY_CONFIG || {};
    const baseUrl = String(config.API_BASE_URL || "").replace(/\/+$/, "");

    class ApiError extends Error {
        constructor(message, status = 0, payload = null) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.payload = payload;
        }
    }

    function isEnabled() {
        return Boolean(config.API_ENABLED && baseUrl);
    }

    function buildUrl(path) {
        if (/^https?:\/\//i.test(path)) return path;
        return `${baseUrl}/${String(path).replace(/^\/+/, "")}`;
    }

    async function request(path, options = {}) {
        if (!isEnabled()) {
            throw new ApiError("The Zyma Pay API integration is disabled.");
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            Number(config.REQUEST_TIMEOUT_MS || 15000)
        );

        const headers = new Headers(options.headers || {});
        if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        headers.set("Accept", "application/json");
        const method = String(options.method || "GET").toUpperCase();
        if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !headers.has("X-Zyma-Requested-With")) {
            headers.set("X-Zyma-Requested-With", "ZymaPay");
        }

        try {
            const response = await fetch(buildUrl(path), {
                ...options,
                headers,
                credentials: "include",
                signal: controller.signal
            });

            const contentType = response.headers.get("content-type") || "";
            const payload = contentType.includes("application/json")
                ? await response.json().catch(() => null)
                : await response.text().catch(() => "");

            if (!response.ok) {
                const message =
                    payload?.message ||
                    payload?.error ||
                    payload?.title ||
                    (typeof payload === "string" && payload) ||
                    `Request failed with status ${response.status}.`;
                if (response.status === 401) {
                    window.dispatchEvent(new CustomEvent("zyma:unauthorized"));
                }
                throw new ApiError(message, response.status, payload);
            }

            return payload;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new ApiError("The request timed out. Please try again.");
            }
            if (error instanceof ApiError) throw error;
            throw new ApiError("Unable to reach the Zyma Pay backend.", 0, error);
        } finally {
            clearTimeout(timeout);
        }
    }

    async function get(path) { return request(path, { method: "GET" }); }
    async function postJson(path, body) { return request(path, { method: "POST", body: JSON.stringify(body) }); }
    async function patchJson(path, body) { return request(path, { method: "PATCH", body: JSON.stringify(body) }); }
    async function deleteRequest(path) { return request(path, { method: "DELETE" }); }

    async function login(email, password) {
        return postJson("/auth/login", { email, password });
    }

    async function logout() {
        return postJson("/auth/logout", {});
    }

    async function getCurrentUser() {
        return get("/auth/me");
    }

    async function listPayments(params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") query.set(key, value);
        });
        return get(`/payments${query.toString() ? `?${query}` : ""}`);
    }

    async function createPayment(payment) {
        return postJson("/payments", payment);
    }

    async function uploadPaymentDocument(id, file, type) {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("type", type);
        return request(`/payments/${encodeURIComponent(id)}/documents`, {
            method: "POST",
            body: formData
        });
    }

    async function createPaymentDraft(formData) {
        return request("/payments/drafts", { method: "POST", body: formData });
    }

    async function updatePaymentStatus(id, status) {
        if (status !== "paid") {
            throw new ApiError("Payments can only be confirmed from Awaiting Reflection to Paid.", 400);
        }
        return postJson(`/payments/${encodeURIComponent(id)}/confirm`, { note: null });
    }

    async function sendPaymentEmail(id) {
        return postJson(`/payments/${encodeURIComponent(id)}/send-email`, {});
    }

    async function listInvoices(params = {}) {
        const query = new URLSearchParams(params);
        return get(`/invoices${query.toString() ? `?${query}` : ""}`);
    }

    async function createInvoice(invoice) {
        return postJson("/invoices", invoice);
    }

    async function updateInvoice(id, invoice) {
        return patchJson(`/invoices/${encodeURIComponent(id)}`, invoice);
    }

    async function deleteInvoice(id) {
        return deleteRequest(`/invoices/${encodeURIComponent(id)}`);
    }

    async function listReceipts(params = {}) {
        const query = new URLSearchParams(params);
        return get(`/sales-receipts${query.toString() ? `?${query}` : ""}`);
    }

    async function createReceipt(receipt) {
        return postJson("/sales-receipts", receipt);
    }

    async function deleteReceipt(id) {
        return deleteRequest(`/sales-receipts/${encodeURIComponent(id)}`);
    }

    async function listEmailTemplates(params = {}) {
        const query = new URLSearchParams(params);
        return get(`/email-templates${query.toString() ? `?${query}` : ""}`);
    }

    async function createEmailTemplate(template) {
        return postJson("/email-templates", template);
    }

    async function updateEmailTemplate(id, template) {
        return patchJson(`/email-templates/${encodeURIComponent(id)}`, template);
    }

    async function listActivity(params = {}) {
        const query = new URLSearchParams(params);
        return get(`/activity${query.toString() ? `?${query}` : ""}`);
    }

    async function getSettings() {
        return get("/settings");
    }

    async function updateSettings(settings) {
        return patchJson("/settings", settings);
    }

    async function listPaymentMethods() {
        return get("/settings/payment-methods");
    }

    async function createPaymentMethod(method) {
        return postJson("/settings/payment-methods", method);
    }

    async function listStaff(params = {}) {
        const query = new URLSearchParams(params);
        return get(`/staff${query.toString() ? `?${query}` : ""}`);
    }

    async function inviteStaff(staff) {
        return postJson("/staff/invitations", staff);
    }

    async function updateStaffRole(id, role) {
        return patchJson(`/staff/${encodeURIComponent(id)}/role`, { role });
    }

    async function updateStaffStatus(id, status) {
        return patchJson(`/staff/${encodeURIComponent(id)}/status`, { status });
    }

    async function health() {
        const apiRoot = baseUrl.replace(/\/api\/?$/i, "");
        return request(`${apiRoot}/health`, { method: "GET" });
    }

    window.zymaApi = {
        ApiError, isEnabled, request, get, postJson, patchJson, deleteRequest,
        login, logout, getCurrentUser, listPayments, createPayment,
        uploadPaymentDocument, createPaymentDraft, updatePaymentStatus, sendPaymentEmail, listInvoices, createInvoice,
        updateInvoice, deleteInvoice, listReceipts, createReceipt, deleteReceipt,
        listEmailTemplates, createEmailTemplate, updateEmailTemplate, listActivity,
        getSettings, updateSettings, listPaymentMethods, createPaymentMethod, listStaff,
        inviteStaff, updateStaffRole, updateStaffStatus, health
    };
})();
