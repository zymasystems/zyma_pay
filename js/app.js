/* =========================================================
   ZYMA PAY
   Frontend Prototype
========================================================= */


/* =========================================================
   PAGE NAVIGATION
========================================================= */

const navItems = document.querySelectorAll("button.nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("pageTitle");


const pageNames = {
    dashboard: "Overview",
    payments: "Payments",
    "new-payment": "New Payment",
    templates: "Email Templates",
    activity: "Activity",
    settings: "Settings"
};


function updateDashboardDate() {
    const now = new Date();
    const day = document.getElementById("currentDateDay");
    const month = document.getElementById("currentDateMonth");
    const year = document.getElementById("currentDateYear");

    if (day) day.textContent = new Intl.DateTimeFormat("en-ZA", { day: "2-digit" }).format(now);
    if (month) month.textContent = new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(now).toUpperCase();
    if (year) year.textContent = new Intl.DateTimeFormat("en-ZA", { year: "numeric" }).format(now);
}

function updateDashboardGreeting(name = "") {
    const greeting = document.getElementById("dashboardGreeting");
    if (!greeting) return;

    const hour = new Date().getHours();
    const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    greeting.textContent = name ? `Good ${period}, ${name}.` : "Welcome to Zyma Pay.";
}

updateDashboardDate();
updateDashboardGreeting();


/* =========================================================
   BACKEND INTEGRATION
========================================================= */

function isApiModeEnabled() {
    return Boolean(
        window.ZYMA_PAY_CONFIG?.API_ENABLED &&
        window.zymaApi?.isEnabled()
    );
}

function toApiPaymentStatus(status) {
    // Backend PaymentStatus enum is numeric because ASP.NET JSON enum-string
    // conversion is not enabled: AwaitingReflection=0, Paid=1, Cancelled=2.
    return status === "paid" ? 1 : status === "cancelled" ? 2 : 0;
}

function toUiPaymentStatus(status) {
    // The API may return PaymentStatus as a numeric enum or as a string,
    // depending on serializer configuration. Normalize both forms.
    if (typeof status === "number") {
        if (status === 1) return "paid";
        if (status === 2) return "cancelled";
        return "awaiting";
    }

    const normalized = String(status ?? "").trim().toLowerCase();

    if (
        normalized === "1" ||
        normalized === "paid" ||
        normalized === "paymentconfirmed" ||
        normalized === "payment confirmed"
    ) {
        return "paid";
    }

    if (
        normalized === "2" ||
        normalized === "cancelled" ||
        normalized === "canceled"
    ) {
        return "cancelled";
    }

    return "awaiting";
}

function paymentValue(payment, camelName, snakeName, fallback = "") {
    return payment?.[camelName] ??
        payment?.[snakeName] ??
        fallback;
}

function normalizePayment(payment) {
    return {
        id: paymentValue(payment, "id", "id", ""),
        clientName: paymentValue(payment, "clientName", "client_name", "Unknown client"),
        clientEmail: paymentValue(payment, "clientEmail", "client_email", ""),
        invoiceNumber: paymentValue(payment, "invoiceNumber", "invoice_number", "—"),
        receiptNumber: paymentValue(payment, "receiptNumber", "receipt_number", "—"),
        amount: Number(paymentValue(payment, "amount", "amount", 0)) || 0,
        paymentType: paymentValue(
            payment,
            "paymentMethod",
            "payment_method",
            paymentValue(payment, "paymentType", "payment_type", "Other")
        ),
        paymentDate: paymentValue(payment, "paymentDate", "payment_date", ""),
        status: toUiPaymentStatus(paymentValue(payment, "status", "status", "awaiting")),
        createdAt: paymentValue(payment, "createdAt", "created_at", "")
    };
}

function getPaymentItems(response) {
    if (Array.isArray(response)) return response;
    return response?.items || response?.data || response?.payments || [];
}

function formatApiDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function initialsForClient(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase() || "?";
}

function createPaymentRow(payment, compact = false) {
    const row = document.createElement("div");
    row.className = compact
        ? "payment-row"
        : "payment-row searchable-row";

    row.dataset.invoice = payment.invoiceNumber;
    row.dataset.status = payment.status;
    if (payment.id) row.dataset.paymentId = payment.id;

    const clientCell = document.createElement("div");
    clientCell.className = "client-cell";

    const avatar = document.createElement("div");
    avatar.className = "client-avatar";
    avatar.textContent = initialsForClient(payment.clientName);

    const clientDetails = document.createElement("div");
    const clientName = document.createElement("strong");
    clientName.textContent = payment.clientName;
    const date = document.createElement("small");
    date.textContent = formatApiDate(payment.paymentDate || payment.createdAt);

    clientDetails.append(clientName, date);
    clientCell.append(avatar, clientDetails);

    const invoice = document.createElement("span");
    invoice.textContent = payment.invoiceNumber;

    const amount = document.createElement("strong");
    amount.textContent = formatCurrency(payment.amount);

    if (compact) {
        const status = document.createElement("span");
        status.className = `badge ${payment.status === "paid" ? "paid" : "pending"}`;
        status.textContent =
            payment.status === "paid"
                ? "Paid"
                : "Awaiting Reflection";
        row.append(clientCell, invoice, amount, status);
        return row;
    }

    const receipt = document.createElement("span");
    receipt.textContent = payment.receiptNumber || "—";

    const type = document.createElement("span");
    type.className = "payment-type";
    type.textContent = payment.paymentType;

    const status = document.createElement("select");
    status.className = "payment-status-control";
    status.dataset.status = payment.status;
    status.setAttribute(
        "aria-label",
        `Payment status for ${payment.invoiceNumber}`
    );

    [
        ["awaiting", "Awaiting Reflection"],
        ["paid", "Paid"]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = payment.status === value;
        status.append(option);
    });

    const actions = document.createElement("div");
    actions.className = "payment-row-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "invoice-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute(
        "aria-label",
        `Delete payment for ${payment.invoiceNumber}`
    );
    deleteButton.addEventListener("click", () => deletePaymentFromApi(payment));

    actions.append(status, deleteButton);
    row.append(clientCell, invoice, receipt, amount, type, actions);
    bindPaymentStatusControl(status);
    return row;
}

function updatePaymentMetrics(payments, summary = null) {
    const normalized = payments.map(normalizePayment);
    const total = summary?.totalCount ?? normalized.length;
    const awaiting = summary?.awaitingReflectionCount ??
        summary?.awaitingCount ??
        normalized.filter(payment => payment.status === "awaiting").length;
    const paid = summary?.paidCount ??
        normalized.filter(payment => payment.status === "paid").length;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const receivedThisMonth = summary?.receivedThisMonth ??
        normalized
            .filter(payment =>
                payment.status === "paid" &&
                String(payment.paymentDate || payment.createdAt).slice(0, 7) === monthKey
            )
            .reduce((sum, payment) => sum + payment.amount, 0);

    const totalElement = document.getElementById("metricTotalPayments");
    const awaitingElement = document.getElementById("metricAwaitingReflection");
    const paidElement = document.getElementById("metricPaymentsConfirmed");
    const amountElement = document.getElementById("metricReceivedThisMonth");

    if (totalElement) totalElement.textContent = String(total);
    if (awaitingElement) awaitingElement.textContent = String(awaiting);
    if (paidElement) paidElement.textContent = String(paid);
    if (amountElement) amountElement.textContent = formatCurrency(receivedThisMonth);
    renderPaymentCharts(normalized);
}

function formatCompactCurrency(value) {
    const amount = Number(value) || 0;
    if (amount >= 1000000) return `R${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}m`;
    if (amount >= 1000) return `R${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
    return `R${Math.round(amount)}`;
}

let latestChartPayments = [];

function renderPaymentCharts(payments) {
    latestChartPayments = Array.isArray(payments) ? payments : [];
    const line = document.getElementById("revenueLine");
    const area = document.getElementById("revenueArea");
    const pointsGroup = document.getElementById("revenuePoints");
    const labelsGroup = document.getElementById("revenueLabels");
    if (!line || !area || !pointsGroup || !labelsGroup) return;

    const confirmed = latestChartPayments.filter(payment => payment.status === "paid");
    const periodControl = document.getElementById("revenueChartPeriod");
    const monthlyMode = !periodControl || periodControl.value !== "quarterly";
    const buckets = new Map();

    confirmed.forEach(payment => {
        const rawDate = payment.paymentDate || payment.createdAt;
        const date = rawDate ? new Date(rawDate) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        const year = date.getFullYear();
        const month = date.getMonth();
        const quarter = Math.floor(month / 3) + 1;
        const key = monthlyMode ? `${year}-${String(month + 1).padStart(2, "0")}` : `${year}-Q${quarter}`;
        const label = monthlyMode
            ? new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(new Date(year, month, 1))
            : `Q${quarter} ${year}`;
        const bucket = buckets.get(key) || { key, label, value: 0, count: 0 };
        bucket.value += Number(payment.amount) || 0;
        bucket.count += 1;
        buckets.set(key, bucket);
    });

    const entries = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
    const periodTotal = entries.reduce((sum, item) => sum + item.value, 0);
    const periodCount = entries.reduce((sum, item) => sum + item.count, 0);
    const totalEl = document.getElementById("chartRevenueTotal");
    const caption = document.getElementById("chartRevenueCaption");
    const note = document.getElementById("revenueChartNote");
    const description = document.getElementById("revenueChartDescription");
    if (totalEl) totalEl.textContent = formatCurrency(periodTotal);
    if (caption) caption.textContent = `${periodCount} confirmed payment${periodCount === 1 ? "" : "s"} across ${entries.length} displayed ${monthlyMode ? "month" : "quarter"}${entries.length === 1 ? "" : "s"}`;
    if (description) description.textContent = monthlyMode
        ? "Total value of confirmed payments, grouped by calendar month."
        : "Total value of confirmed payments, grouped by calendar quarter (Q1–Q4).";
    if (note) note.textContent = entries.length
        ? `Each point represents the total confirmed payment value for one ${monthlyMode ? "calendar month" : "calendar quarter"}. Select a point to see its amount and number of payments. Only recorded payments are included; no historical values are estimated.`
        : `No confirmed payments are available for this ${monthlyMode ? "monthly" : "quarterly"} view yet. Once payments are confirmed, each point will show the total received in that period.`;

    const xStart = 48, xEnd = 616, yTop = 24, yBottom = 194;
    const max = Math.max(1, ...entries.map(item => item.value));
    const coords = entries.map((item, index) => ({
        x: entries.length === 1 ? (xStart + xEnd) / 2 : xStart + (xEnd - xStart) * index / (entries.length - 1),
        y: yBottom - (item.value / max) * (yBottom - yTop),
        key: item.key, label: item.label, value: item.value, count: item.count
    }));
    const linePath = coords.length ? coords.map((point, i) => `${i ? "L" : "M"}${point.x} ${point.y}`).join(" ") : `M${xStart} ${yBottom} L${xEnd} ${yBottom}`;
    line.setAttribute("d", linePath);
    area.setAttribute("d", coords.length ? `${linePath} L${coords[coords.length - 1].x} ${yBottom} L${coords[0].x} ${yBottom} Z` : `M${xStart} ${yBottom} L${xEnd} ${yBottom} Z`);
    pointsGroup.replaceChildren();
    labelsGroup.replaceChildren();

    const yLabels = document.getElementById("revenueYLabels");
    if (yLabels) {
        yLabels.replaceChildren();
        [1, 0.75, 0.5, 0.25, 0].forEach((fraction, index) => {
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", "40");
            label.setAttribute("y", String(yTop + (yBottom - yTop) * index / 4 + 3));
            label.setAttribute("text-anchor", "end");
            label.setAttribute("class", "chart-axis-label chart-y-axis-label");
            label.textContent = formatCompactCurrency(max * fraction);
            yLabels.append(label);
        });
    }

    const ns = "http://www.w3.org/2000/svg";
    const detailAmount = document.getElementById("revenuePointAmount");
    const detailPeriod = document.getElementById("revenuePointPeriod");
    const detail = document.getElementById("revenuePointDetail");
    const selectPoint = point => {
        if (detailAmount) detailAmount.textContent = formatCurrency(point.value);
        if (detailPeriod) detailPeriod.textContent = `${point.label} · ${point.count} confirmed payment${point.count === 1 ? "" : "s"} · Total received in this period`;
        if (detail) detail.classList.add("has-selection");
        pointsGroup.querySelectorAll(".chart-point").forEach(node => {
            const selected = node.getAttribute("data-key") === point.key;
            node.classList.toggle("is-selected", selected);
            node.setAttribute("aria-pressed", selected ? "true" : "false");
        });
    };

    coords.forEach(point => {
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", "5");
        circle.setAttribute("class", "chart-point");
        circle.setAttribute("tabindex", "0");
        circle.setAttribute("role", "button");
        circle.setAttribute("data-key", point.key);
        circle.setAttribute("aria-label", `${point.label}: ${formatCurrency(point.value)} from ${point.count} confirmed payment${point.count === 1 ? "" : "s"}`);
        circle.setAttribute("aria-pressed", "false");
        const title = document.createElementNS(ns, "title");
        title.textContent = `${point.label}: ${formatCurrency(point.value)} (${point.count} confirmed payment${point.count === 1 ? "" : "s"}). Select to view details.`;
        circle.append(title);
        circle.addEventListener("click", () => selectPoint(point));
        circle.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPoint(point);
            }
        });
        circle.addEventListener("focus", () => selectPoint(point));
        pointsGroup.append(circle);

        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", point.x);
        label.setAttribute("y", "220");
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("class", "chart-axis-label");
        label.textContent = monthlyMode ? point.label.split(" ")[0].slice(0, 3) : point.label.replace(" ", "");
        labelsGroup.append(label);
    });

    if (coords.length) {
        selectPoint(coords[coords.length - 1]);
    } else {
        if (detailAmount) detailAmount.textContent = "No period selected";
        if (detailPeriod) detailPeriod.textContent = "Confirmed payments will appear here when recorded.";
        if (detail) detail.classList.remove("has-selection");
    }

    const length = line.getTotalLength ? line.getTotalLength() : 700;
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    area.classList.remove("chart-area-animate");
    line.classList.remove("chart-line-animate");
    void line.getBoundingClientRect();
    area.classList.add("chart-area-animate");
    line.classList.add("chart-line-animate");

    const statuses = {
        paid: payments.filter(p => p.status === "paid").length,
        awaiting: payments.filter(p => p.status === "awaiting").length,
        cancelled: payments.filter(p => p.status === "cancelled").length
    };
    const count = payments.length;
    const circumference = 2 * Math.PI * 78;
    let offset = 0;
    [["statusPaidArc", statuses.paid], ["statusAwaitingArc", statuses.awaiting], ["statusCancelledArc", statuses.cancelled]].forEach(([id, value]) => {
        const arc = document.getElementById(id); if (!arc) return;
        const dash = count ? circumference * value / count : 0;
        arc.style.strokeDasharray = `${dash} ${circumference - dash}`;
        arc.style.strokeDashoffset = `${-offset}`;
        offset += dash;
        arc.classList.remove("donut-animate"); void arc.getBoundingClientRect(); arc.classList.add("donut-animate");
    });
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText("chartStatusTotal", count); setText("chartPaidCount", statuses.paid); setText("chartAwaitingCount", statuses.awaiting); setText("chartCancelledCount", statuses.cancelled);
    const statusNote = document.getElementById("statusChartNote");
    if (statusNote) statusNote.textContent = count ? `${Math.round(statuses.paid / count * 100)}% of recorded payments are confirmed.` : "Status distribution will appear when payment records load.";
}

const revenuePeriodControl = document.getElementById("revenueChartPeriod");
if (revenuePeriodControl) {
    revenuePeriodControl.addEventListener("change", () => renderPaymentCharts(latestChartPayments));
}

function renderPaymentsFromApi(response) {
    const rawPayments = getPaymentItems(response);
    const payments = rawPayments.map(normalizePayment);
    const recentContainer = document.getElementById("recentPaymentsRows");
    const paymentsContainer = document.getElementById("paymentsRows");

    if (recentContainer) {
        recentContainer
            .querySelectorAll(".payment-row")
            .forEach(row => row.remove());

        const recentEmpty = recentContainer.querySelector('[data-payment-empty="recent"]');
        if (recentEmpty) recentEmpty.hidden = payments.length > 0;

        payments
            .slice()
            .sort((a, b) =>
                String(b.paymentDate || b.createdAt)
                    .localeCompare(String(a.paymentDate || a.createdAt))
            )
            .slice(0, 5)
            .forEach(payment =>
                recentContainer.appendChild(createPaymentRow(payment, true))
            );
    }

    if (paymentsContainer) {
        paymentsContainer
            .querySelectorAll(".payment-row")
            .forEach(row => row.remove());

        const allEmpty = paymentsContainer.querySelector('[data-payment-empty="all"]');
        if (allEmpty) allEmpty.hidden = payments.length > 0;

        payments
            .forEach(payment =>
                paymentsContainer.appendChild(createPaymentRow(payment))
            );
    }

    updatePaymentMetrics(payments, Array.isArray(response) ? null : response);
    renderFinanceInsights(payments, latestFinanceInvoices);
    bindPaymentSearchEvents();
    filterPayments();
}

async function loadPaymentsFromApi() {
    if (!isApiModeEnabled()) return;

    try {
        const response = await window.zymaApi.listPayments({ pageSize: 100 });
        renderPaymentsFromApi(response);
    } catch (error) {
        console.error("Unable to load Zyma Pay payments.", error);
        showToast(
            "Backend Unavailable",
            error.message || "Payments could not be loaded from the API."
        );
    }
}


function normalizeDashboardInvoice(invoice) {
    const rawStatus = String(invoice?.status ?? "Draft").trim().toLowerCase().replace(/[_-]+/g, " ");
    const status = rawStatus === "unpaid" || rawStatus === "awaiting payment" ? "sent" : rawStatus;
    return {
        id: invoice?.id,
        number: invoice?.invoiceNumber ?? invoice?.number ?? "",
        client: invoice?.clientName ?? invoice?.client ?? "Unknown client",
        email: invoice?.clientEmail ?? invoice?.email ?? "",
        amount: Number(invoice?.amount ?? invoice?.total ?? invoice?.totalAmount ?? 0) || 0,
        dueDate: invoice?.dueDate ?? invoice?.due_date ?? "",
        issueDate: invoice?.invoiceDate ?? invoice?.issueDate ?? invoice?.createdAt ?? "",
        status
    };
}

function normalizeDashboardReceipt(receipt) {
    return {
        id: receipt?.id,
        number: receipt?.receiptNumber ?? receipt?.number ?? "",
        client: receipt?.clientName ?? receipt?.client ?? "",
        amount: Number(receipt?.amount ?? receipt?.total ?? 0) || 0,
        date: receipt?.receiptDate ?? receipt?.date ?? ""
    };
}

function renderReadyInvoices(invoices) {
    const container = document.getElementById("readyInvoicesRows");
    if (!container) return;
    container.replaceChildren();
    const ready = invoices
        .map(normalizeDashboardInvoice)
        .filter(invoice => invoice.status === "sent")
        .slice(0, 6);
    if (!ready.length) {
        const empty = document.createElement("div");
        empty.className = "billing-list-empty";
        empty.textContent = "No invoices are currently awaiting payment.";
        container.append(empty);
        return;
    }
    ready.forEach(invoice => {
        const row = document.createElement("div");
        row.className = "billing-action-row";
        const main = document.createElement("div");
        main.className = "billing-action-main";
        const name = document.createElement("strong");
        name.textContent = invoice.client;
        const ref = document.createElement("small");
        ref.textContent = `${invoice.number}${invoice.dueDate ? ` · Due ${formatApiDate(invoice.dueDate)}` : ""}`;
        main.append(name, ref);
        const amount = document.createElement("span");
        amount.className = "billing-action-amount";
        amount.textContent = formatCurrency(invoice.amount);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "billing-action-button";
        button.textContent = "Record Payment";
        button.addEventListener("click", () => openPaymentForInvoice(invoice));
        row.append(main, amount, button);
        container.append(row);
    });
}

function renderRecentReceipts(receipts) {
    const container = document.getElementById("recentReceiptsRows");
    if (!container) return;
    container.replaceChildren();
    const recent = receipts.map(normalizeDashboardReceipt).slice(0, 6);
    if (!recent.length) {
        const empty = document.createElement("div");
        empty.className = "billing-list-empty";
        empty.textContent = "No sales receipts yet.";
        container.append(empty);
        return;
    }
    recent.forEach(receipt => {
        const row = document.createElement("div");
        row.className = "billing-action-row";
        const main = document.createElement("div");
        main.className = "billing-action-main";
        const name = document.createElement("strong");
        name.textContent = receipt.client;
        const ref = document.createElement("small");
        ref.textContent = `${receipt.number}${receipt.date ? ` · ${formatApiDate(receipt.date)}` : ""}`;
        main.append(name, ref);
        const amount = document.createElement("span");
        amount.className = "billing-action-amount";
        amount.textContent = formatCurrency(receipt.amount);
        row.append(main, amount);
        container.append(row);
    });
}


async function migrateLegacyBillingData() {
    if (!isApiModeEnabled()) return;
    const migrationKey = "zymaBillingServerMigrationV1";
    if (localStorage.getItem(migrationKey) === "done") return;

    try {
        const [serverInvoicesRaw, serverReceiptsRaw] = await Promise.all([
            window.zymaApi.listInvoices(),
            window.zymaApi.listReceipts()
        ]);
        const serverInvoices = Array.isArray(serverInvoicesRaw) ? serverInvoicesRaw : serverInvoicesRaw?.items || [];
        const serverReceipts = Array.isArray(serverReceiptsRaw) ? serverReceiptsRaw : serverReceiptsRaw?.items || [];
        const invoiceNumbers = new Set(serverInvoices.map(x => x.invoiceNumber ?? x.number));
        const receiptNumbers = new Set(serverReceipts.map(x => x.receiptNumber ?? x.number));

        const legacyInvoices = JSON.parse(localStorage.getItem("zymaInvoices") || "[]");
        if (Array.isArray(legacyInvoices)) {
            for (const legacy of legacyInvoices) {
                const number = legacy.number || legacy.invoiceNumber;
                if (!number || invoiceNumbers.has(number)) continue;
                const status = String(legacy.status || "draft").toLowerCase();
                await window.zymaApi.createInvoice({
                    invoiceNumber: number,
                    clientName: legacy.client || legacy.clientName || "",
                    clientEmail: legacy.email || legacy.clientEmail || "",
                    amount: Number(legacy.total ?? legacy.amount ?? 0),
                    subtotal: Number(legacy.subtotal ?? legacy.total ?? legacy.amount ?? 0),
                    discountPercent: Number(legacy.discountPercent ?? 0),
                    discountAmount: Number(legacy.discountAmount ?? 0),
                    vatAmount: Number(legacy.vatAmount ?? 0),
                    billingAddress: legacy.billingAddress || null,
                    terms: legacy.terms || "Due on Receipt",
                    notes: legacy.notes || null,
                    itemsJson: JSON.stringify(legacy.items || []),
                    invoiceDate: legacy.issueDate || legacy.invoiceDate,
                    dueDate: legacy.dueDate || null,
                    status: status === "sent" ? "Sent" : "Draft"
                });
                invoiceNumbers.add(number);
            }
        }

        const legacyReceipts = JSON.parse(localStorage.getItem("zymaSalesReceipts") || "[]");
        if (Array.isArray(legacyReceipts)) {
            for (const legacy of legacyReceipts) {
                const number = legacy.number || legacy.receiptNumber;
                if (!number || receiptNumbers.has(number)) continue;
                await window.zymaApi.createReceipt({
                    receiptNumber: number,
                    clientName: legacy.client || legacy.clientName || "",
                    clientEmail: legacy.email || legacy.clientEmail || "",
                    reference: legacy.reference || null,
                    paymentMode: legacy.paymentMode || "Bank Transfer",
                    notes: legacy.notes || null,
                    itemsJson: JSON.stringify(legacy.items || []),
                    amount: Number(legacy.total ?? legacy.amount ?? 0),
                    receiptDate: legacy.date || legacy.receiptDate
                });
                receiptNumbers.add(number);
            }
        }

        localStorage.setItem(migrationKey, "done");
    } catch (error) {
        console.warn("Legacy billing migration was not completed.", error);
    }
}

let latestFinanceInvoices = [];
let latestFinanceReceipts = [];

async function loadBillingDashboard() {
    if (!isApiModeEnabled()) return;
    try {
        const [invoices, receipts] = await Promise.all([
            window.zymaApi.listInvoices(),
            window.zymaApi.listReceipts()
        ]);
        latestFinanceInvoices = (Array.isArray(invoices) ? invoices : invoices?.items || []).map(normalizeDashboardInvoice);
        latestFinanceReceipts = (Array.isArray(receipts) ? receipts : receipts?.items || []).map(normalizeDashboardReceipt);
        renderReadyInvoices(latestFinanceInvoices);
        renderRecentReceipts(latestFinanceReceipts);
        renderFinanceInsights(latestChartPayments, latestFinanceInvoices);
    } catch (error) {
        console.error("Unable to load billing dashboard data.", error);
    }
}

function financeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function financeDateOnly(value) {
    const date = financeDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function invoiceIsDraft(invoice) {
    return ["draft", "cancelled", "canceled", "void"].includes(invoice.status);
}

function invoiceIsSettled(invoice, matchedPaid) {
    return invoice.status === "paid" || invoice.status === "fully paid" || (invoice.amount > 0 && matchedPaid >= invoice.amount - 0.01);
}

function makeFinanceInvoiceRows(invoices, payments) {
    const paidByInvoice = new Map();
    const paymentCountByInvoice = new Map();
    payments.filter(payment => payment.status === "paid").forEach(payment => {
        const number = String(payment.invoiceNumber || "").trim().toLowerCase();
        if (!number || number === "—") return;
        paidByInvoice.set(number, (paidByInvoice.get(number) || 0) + (Number(payment.amount) || 0));
        paymentCountByInvoice.set(number, (paymentCountByInvoice.get(number) || 0) + 1);
    });
    return invoices.map(invoice => {
        const key = String(invoice.number || "").trim().toLowerCase();
        const matchedPaid = paidByInvoice.get(key) || 0;
        const settled = invoiceIsSettled(invoice, matchedPaid);
        const balance = settled ? 0 : Math.max(0, invoice.amount - matchedPaid);
        const due = financeDateOnly(invoice.dueDate);
        const today = financeDateOnly(new Date());
        const overdue = Boolean(balance > 0 && due && due < today);
        return { ...invoice, matchedPaid, matchedCount: paymentCountByInvoice.get(key) || 0, balance, overdue, due };
    });
}

function renderOutstandingPayments(invoiceRows) {
    const tbody = document.getElementById("outstandingPaymentsRows");
    const totalEl = document.getElementById("outstandingTotalAmount");
    const captionEl = document.getElementById("outstandingTotalCaption");
    const countEl = document.getElementById("outstandingInvoiceCount");
    if (!tbody) return;
    const outstanding = invoiceRows.filter(invoice => !invoiceIsDraft(invoice) && invoice.balance > 0.009)
        .sort((a, b) => Number(b.overdue) - Number(a.overdue) || ((a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity)));
    const total = outstanding.reduce((sum, invoice) => sum + invoice.balance, 0);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    if (captionEl) captionEl.textContent = outstanding.length ? `${outstanding.filter(x => x.overdue).length} overdue · ${outstanding.length} balance${outstanding.length === 1 ? "" : "s"}` : "No outstanding balances";
    if (countEl) countEl.textContent = `${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`;
    tbody.replaceChildren();
    if (!outstanding.length) {
        const row = document.createElement("tr"); const cell = document.createElement("td");
        cell.colSpan = 5; cell.className = "finance-empty"; cell.textContent = invoiceRows.length ? "No issued invoices have an outstanding balance." : "Invoice balances will appear when billing records load.";
        row.append(cell); tbody.append(row); return;
    }
    outstanding.slice(0, 8).forEach(invoice => {
        const row = document.createElement("tr");
        const clientCell = document.createElement("td"); const client = document.createElement("strong"); client.textContent = invoice.client;
        const ref = document.createElement("small"); ref.textContent = `${invoice.number || "No invoice number"} · ${invoice.matchedCount ? `${formatCurrency(invoice.matchedPaid)} matched` : "No confirmed payment matched"}`;
        clientCell.append(client, ref);
        const dueCell = document.createElement("td"); dueCell.textContent = invoice.dueDate ? formatApiDate(invoice.dueDate) : "Not set";
        const balanceCell = document.createElement("td"); balanceCell.className = "finance-balance"; balanceCell.textContent = formatCurrency(invoice.balance);
        const statusCell = document.createElement("td"); const badge = document.createElement("span");
        badge.className = `finance-status ${invoice.overdue ? "overdue" : invoice.matchedPaid > 0 ? "partial" : "unpaid"}`;
        badge.textContent = invoice.overdue ? "Overdue" : invoice.matchedPaid > 0 ? "Part-paid" : "Unpaid"; statusCell.append(badge);
        const actionCell = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "finance-table-action"; button.textContent = "Record payment";
        button.addEventListener("click", () => openPaymentForInvoice(invoice)); actionCell.append(button);
        row.append(clientCell, dueCell, balanceCell, statusCell, actionCell); tbody.append(row);
    });
}

function renderCashflow(invoiceRows) {
    const horizonControl = document.getElementById("cashflowHorizon");
    const days = Number(horizonControl?.value || 30);
    const today = financeDateOnly(new Date());
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + days);
    const open = invoiceRows.filter(invoice => !invoiceIsDraft(invoice) && invoice.balance > 0.009);
    const overdue = open.filter(invoice => invoice.overdue);
    const dueInHorizon = open.filter(invoice => invoice.due && invoice.due >= today && invoice.due <= horizon);
    const unscheduled = open.filter(invoice => !invoice.due);
    const expected = dueInHorizon.reduce((sum, x) => sum + x.balance, 0);
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText("cashflowForecastTotal", formatCurrency(expected));
    setText("cashflowForecastCaption", `Expected receipts due in the next ${days} days`);
    setText("cashflowOverdueTotal", formatCurrency(overdue.reduce((sum, x) => sum + x.balance, 0)));
    setText("cashflowDueTotal", formatCurrency(expected));
    setText("cashflowUnscheduledTotal", formatCurrency(unscheduled.reduce((sum, x) => sum + x.balance, 0)));
    const container = document.getElementById("cashflowForecastRows"); if (!container) return;
    container.replaceChildren();
    const list = [...dueInHorizon].sort((a,b) => a.due - b.due).slice(0, 5);
    if (!list.length) { const empty = document.createElement("p"); empty.className = "finance-empty"; empty.textContent = open.length ? `No outstanding invoices are due within ${days} days.` : "Issued invoice due dates will appear here."; container.append(empty); return; }
    list.forEach(invoice => { const row = document.createElement("div"); row.className = "forecast-row"; const main = document.createElement("div"); const title = document.createElement("strong"); title.textContent = invoice.client; const meta = document.createElement("small"); meta.textContent = `${invoice.number} · Due ${formatApiDate(invoice.dueDate)}`; main.append(title,meta); const amount = document.createElement("span"); amount.textContent = formatCurrency(invoice.balance); row.append(main,amount); container.append(row); });
}

function getClientRevenuePeriodRange(period) {
    const now = new Date(); const start = new Date(now.getFullYear(), 0, 1); let end = new Date(now.getFullYear() + 1, 0, 1);
    if (period === "monthly") { start.setFullYear(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
    if (period === "quarterly") { const qStart = Math.floor(now.getMonth() / 3) * 3; start.setFullYear(now.getFullYear(), qStart, 1); end = new Date(now.getFullYear(), qStart + 3, 1); }
    return { start, end };
}

function renderClientRevenue(payments) {
    const period = document.getElementById("clientRevenuePeriod")?.value || "monthly";
    const range = getClientRevenuePeriodRange(period);
    const confirmed = payments.filter(payment => {
        if (payment.status !== "paid") return false;
        if (period === "all") return true;
        const date = financeDate(payment.paymentDate || payment.createdAt);
        return date && date >= range.start && date < range.end;
    });
    const byClient = new Map();
    confirmed.forEach(payment => { const name = String(payment.clientName || "Unknown client").trim() || "Unknown client"; const item = byClient.get(name) || { name, amount: 0, count: 0 }; item.amount += Number(payment.amount) || 0; item.count += 1; byClient.set(name,item); });
    const rows = [...byClient.values()].sort((a,b) => b.amount-a.amount);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const totalEl = document.getElementById("clientRevenueTotal"); if (totalEl) totalEl.textContent = formatCurrency(total);
    const caption = document.getElementById("clientRevenueCaption"); if (caption) caption.textContent = `${confirmed.length} confirmed payment${confirmed.length === 1 ? "" : "s"} · ${period === "all" ? "all time" : period === "monthly" ? "this month" : period === "quarterly" ? "this quarter" : "this year"}`;
    const container = document.getElementById("clientRevenueRows"); if (!container) return; container.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "finance-empty"; empty.textContent = "No confirmed revenue for this period."; container.append(empty); return; }
    const max = Math.max(...rows.map(row => row.amount), 1);
    rows.slice(0,6).forEach(item => { const row = document.createElement("div"); row.className = "client-revenue-row"; const avatar = document.createElement("span"); avatar.className = "client-revenue-avatar"; avatar.textContent = initialsForClient(item.name); const main = document.createElement("div"); const name = document.createElement("strong"); name.textContent = item.name; const meta = document.createElement("small"); meta.textContent = `${item.count} confirmed payment${item.count === 1 ? "" : "s"}`; const meter = document.createElement("div"); meter.className = "client-revenue-meter"; const fill = document.createElement("span"); fill.style.width = `${Math.max(2, item.amount / max * 100)}%`; meter.append(fill); main.append(name,meta,meter); const amount = document.createElement("strong"); amount.textContent = formatCurrency(item.amount); row.append(avatar,main,amount); container.append(row); });
}

function renderInvoiceMatchingSummary(invoiceRows, payments) {
    const el = document.getElementById("invoiceMatchingSummary"); if (!el) return;
    const issued = invoiceRows.filter(invoice => !invoiceIsDraft(invoice));
    const paymentRefs = new Set(payments.filter(payment => payment.status === "paid" && payment.invoiceNumber && payment.invoiceNumber !== "—").map(payment => String(payment.invoiceNumber).trim().toLowerCase()));
    const matched = issued.filter(invoice => paymentRefs.has(String(invoice.number).trim().toLowerCase())).length;
    const unmatchedPayments = payments.filter(payment => payment.status === "paid" && payment.invoiceNumber && payment.invoiceNumber !== "—" && !issued.some(invoice => String(invoice.number).trim().toLowerCase() === String(payment.invoiceNumber).trim().toLowerCase())).length;
    el.textContent = `${matched} of ${issued.length} issued invoice${issued.length === 1 ? "" : "s"} have a confirmed payment reference. ${unmatchedPayments} confirmed payment${unmatchedPayments === 1 ? " has" : "s have"} a reference that does not match an issued invoice.`;
}

function renderFinanceInsights(payments, invoices) {
    const normalizedPayments = (Array.isArray(payments) ? payments : []).map(payment => payment?.clientName !== undefined ? payment : normalizePayment(payment));
    const normalizedInvoices = (Array.isArray(invoices) ? invoices : []).map(invoice => invoice?.number !== undefined ? invoice : normalizeDashboardInvoice(invoice));
    const invoiceRows = makeFinanceInvoiceRows(normalizedInvoices, normalizedPayments);
    renderOutstandingPayments(invoiceRows);
    renderCashflow(invoiceRows);
    renderClientRevenue(normalizedPayments);
    renderInvoiceMatchingSummary(invoiceRows, normalizedPayments);
}

function csvEscape(value) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function reportPeriodMatches(value, period) {
    if (period === "all") return true;
    const date = financeDate(value); if (!date) return false;
    const now = new Date();
    if (period === "monthly") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (period === "quarterly") return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth()/3) === Math.floor(now.getMonth()/3);
    return date.getFullYear() === now.getFullYear();
}

function exportFinancialReport() {
    const period = document.getElementById("financeExportPeriod")?.value || "monthly";
    const rows = [["Record type","Date","Client","Invoice number","Receipt number","Amount (ZAR)","Status","Payment type","Due date","Matched confirmed amount","Outstanding balance"]];
    latestChartPayments.filter(payment => reportPeriodMatches(payment.paymentDate || payment.createdAt, period)).forEach(payment => {
        const invoice = makeFinanceInvoiceRows(latestFinanceInvoices, latestChartPayments).find(item => String(item.number).toLowerCase() === String(payment.invoiceNumber).toLowerCase());
        rows.push(["Payment", payment.paymentDate || payment.createdAt, payment.clientName, payment.invoiceNumber, payment.receiptNumber, Number(payment.amount || 0).toFixed(2), payment.status, payment.paymentType, invoice?.dueDate || "", invoice?.matchedPaid?.toFixed(2) || "0.00", invoice?.balance?.toFixed(2) || ""]);
    });
    latestFinanceInvoices.filter(invoice => reportPeriodMatches(invoice.issueDate || invoice.dueDate, period)).forEach(invoice => {
        const matched = makeFinanceInvoiceRows([invoice], latestChartPayments)[0];
        rows.push(["Invoice", invoice.issueDate, invoice.client, invoice.number, "", invoice.amount.toFixed(2), invoice.status, "", invoice.dueDate, (matched?.matchedPaid || 0).toFixed(2), (matched?.balance || 0).toFixed(2)]);
    });
    if (rows.length === 1) { showToast("No report data", "No financial records are available for the selected period."); return; }
    downloadCsv(`zyma-pay-financial-report-${period}-${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportOutstandingReport() {
    const outstanding = makeFinanceInvoiceRows(latestFinanceInvoices, latestChartPayments).filter(invoice => !invoiceIsDraft(invoice) && invoice.balance > 0.009);
    const rows = [["Client","Client email","Invoice number","Invoice status","Issue date","Due date","Invoice amount (ZAR)","Confirmed payments matched (ZAR)","Outstanding balance (ZAR)","Overdue"]];
    outstanding.forEach(invoice => rows.push([invoice.client, invoice.email, invoice.number, invoice.status, invoice.issueDate, invoice.dueDate, invoice.amount.toFixed(2), invoice.matchedPaid.toFixed(2), invoice.balance.toFixed(2), invoice.overdue ? "Yes" : "No"]));
    if (!outstanding.length) { showToast("No outstanding invoices", "There are no outstanding issued invoices to export."); return; }
    downloadCsv(`zyma-pay-outstanding-invoices-${new Date().toISOString().slice(0,10)}.csv`, rows);
}

const cashflowHorizonControl = document.getElementById("cashflowHorizon");
if (cashflowHorizonControl) cashflowHorizonControl.addEventListener("change", () => renderFinanceInsights(latestChartPayments, latestFinanceInvoices));
const clientRevenuePeriodControl = document.getElementById("clientRevenuePeriod");
if (clientRevenuePeriodControl) clientRevenuePeriodControl.addEventListener("change", () => renderClientRevenue(latestChartPayments));
document.getElementById("exportFinancialReport")?.addEventListener("click", exportFinancialReport);
document.getElementById("exportOutstandingReport")?.addEventListener("click", exportOutstandingReport);

function openPaymentForInvoice(invoice) {
    if (typeof showPage === "function") showPage("new-payment");
    if (clientName) clientName.value = invoice.client || "";
    if (clientEmail) clientEmail.value = invoice.email || "";
    if (invoiceNumber) invoiceNumber.value = invoice.number || "";
    if (amount) amount.value = Number(invoice.amount || 0).toFixed(2);
    if (paymentStatus) paymentStatus.value = "awaiting";
    updatePreview?.();
}

async function loadCurrentUserFromApi() {
    if (!isApiModeEnabled()) return;

    try {
        const response = await window.zymaApi.getCurrentUser();
        const user = response?.user || response;
        const name = user?.name || user?.fullName || user?.email;
        const role = user?.role || user?.roleName;

        if (name) {
            const nameElement = document.getElementById("currentUserName");
            if (nameElement) nameElement.textContent = name;
            updateDashboardGreeting(name);
        }
        if (role) {
            const roleElement = document.getElementById("currentUserRole");
            if (roleElement) roleElement.textContent = role;
        }
    } catch (error) {
        if (error.status !== 401) {
            console.warn("Unable to load the current staff profile.", error);
        }
    }
}

function getPaymentRequest() {
    const statusValue = paymentStatus.value;
    return {
        clientName: clientName.value.trim(),
        clientEmail: clientEmail.value.trim(),
        invoiceNumber: invoiceNumber.value.trim(),
        receiptNumber: receiptNumber.value.trim() || null,
        amount: Number(String(amount.value).replace(/[^0-9.,-]/g, "").replace(",", ".")),
        paymentMethod: paymentType.value,
        paymentDate: paymentDate.value,
        // ASP.NET enum values: AwaitingReflection=0, Paid=1, Cancelled=2
        status: toApiPaymentStatus(statusValue)
    };
}

function getPaymentDocuments() {
    return [
        { input: document.getElementById("proofFile"), type: 0, label: "Proof of Payment" },
        { input: document.getElementById("invoiceFile"), type: 1, label: "Invoice" },
        { input: document.getElementById("receiptFile"), type: 2, label: "Sales Receipt" }
    ].filter(item => item.input?.files?.[0]);
}

function resetPaymentForm() {
    if (!form) return;

    form.reset();
    paymentStatus.value = "awaiting";
    if (paymentDate) {
        const today = new Date();
        paymentDate.value =
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }

    ["proofFileName", "invoiceFileName", "receiptFileName"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = "";
    });

    updatePreview();
}

async function submitPaymentToApi() {
    const submitButton = form?.querySelector('button[type="submit"]');
    const documents = getPaymentDocuments();
    const request = getPaymentRequest();

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = "Creating & sending…";
    }

    let payment = null;

    try {
        payment = await window.zymaApi.createPayment(request);

        // Store every selected document first. The email endpoint will then
        // attach the stored documents to the outgoing client email.
        for (const document of documents) {
            await window.zymaApi.uploadPaymentDocument(
                payment.id,
                document.input.files[0],
                document.type
            );
        }

        // Send the exact server-side email template for the selected
        // payment status. The backend sends from payments@zyma.co.za.
        console.info("[Zyma Pay] Sending payment email:", payment.id);
        await window.zymaApi.sendPaymentEmail(payment.id);
        console.info("[Zyma Pay] Payment email request completed:", payment.id);

        resetPaymentForm();
        localStorage.removeItem("zymaPaymentDraft");
        await loadPaymentsFromApi();
        showPage("payments");

        showToast(
            "Payment Email Sent",
            `Payment ${payment.invoiceNumber} was saved and the ${request.status === 1 ? "payment confirmation" : "Proof of Payment received"} email was sent to ${request.clientEmail}.`
        );
    } catch (error) {
        console.error("Unable to complete payment email workflow.", error);

        if (payment?.id) {
            showToast(
                "Payment Created — Email Not Sent",
                `${error.message || "Email delivery failed."} The payment was saved and was not deleted.`
            );
        } else {
            showToast(
                "Payment Not Created",
                error.message || "The backend could not create this payment."
            );
        }
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
                submitButton.dataset.originalText || "Continue";
        }
    }
}

async function deletePaymentFromApi(payment) {
    if (!isApiModeEnabled() || !payment?.id) return;

    const confirmed = window.confirm(
        `Delete payment ${payment.invoiceNumber} for ${formatCurrency(payment.amount)}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
        await window.zymaApi.deletePayment(payment.id);
        await loadPaymentsFromApi();
        showToast(
            "Payment Deleted",
            `Payment ${payment.invoiceNumber} was permanently deleted.`
        );
    } catch (error) {
        showToast(
            "Payment Not Deleted",
            error.message || "The backend could not delete this payment."
        );
    }
}

async function handleApiStatusChange(control) {
    const row = control.closest(".searchable-row");
    if (!row) return;

    const paymentId = row.dataset.paymentId;
    const previousStatus = row.dataset.status;
    const nextStatus = control.value;

    if (!paymentId) {
        control.value = previousStatus;
        showToast(
            "Payment ID Missing",
            "This payment is not linked to a backend record."
        );
        return;
    }

    if (nextStatus !== "awaiting" && nextStatus !== "paid") {
        control.value = previousStatus;
        return;
    }

    control.disabled = true;

    try {
        if (nextStatus === "paid") {
            await window.zymaApi.confirmPayment(paymentId);
        } else {
            // The backend intentionally has no endpoint to move a payment
            // backwards from Paid to Awaiting Reflection.
            throw new Error("A confirmed payment cannot be moved back to Awaiting Reflection.");
        }

        // The API is the source of truth. Reload the payment collection after
        // every successful state change so Payments and Overview cannot drift.
        await loadPaymentsFromApi();

        showToast(
            "Payment Updated",
            "Payment status was updated successfully."
        );
    } catch (error) {
        control.value = previousStatus;
        control.dataset.status = previousStatus;
        showToast(
            "Status Not Updated",
            error.message || "The backend could not update this payment."
        );
    } finally {
        control.disabled = false;
    }
}


function showPage(pageId) {

    pages.forEach(page => {
        page.classList.remove("active-page");
    });

    const target = document.getElementById(pageId);

    if (target) {
        target.classList.add("active-page");
    }


    navItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === pageId
        );

    });


    if (pageTitle) {
        pageTitle.textContent =
            pageNames[pageId] || "Overview";
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (isApiModeEnabled() && (pageId === "dashboard" || pageId === "payments")) {
        loadPaymentsFromApi();
    }
    if (isApiModeEnabled() && pageId === "dashboard") {
        loadBillingDashboard();
    }
}


navItems.forEach(item => {

    item.addEventListener("click", () => {

        showPage(item.dataset.page);

    });

});


/* =========================================================
   NEW PAYMENT BUTTONS
========================================================= */

const newPaymentButtons = [
    "topNewPayment",
    "dashboardNewPayment",
    "paymentsNewPayment"
];


newPaymentButtons.forEach(id => {

    const button = document.getElementById(id);

    if (!button) return;

    button.addEventListener("click", () => {

        showPage("new-payment");

    });

});


/* =========================================================
   ELEMENTS
========================================================= */

const form = document.getElementById("paymentForm");

const clientName =
    document.getElementById("clientName");

const clientEmail =
    document.getElementById("clientEmail");

const invoiceNumber =
    document.getElementById("invoiceNumber");

const receiptNumber =
    document.getElementById("receiptNumber");

const amount =
    document.getElementById("amount");

const paymentType =
    document.getElementById("paymentType");

const paymentDate =
    document.getElementById("paymentDate");

const paymentStatus =
    document.getElementById("paymentStatus");


/* =========================================================
   PREVIEW ELEMENTS
========================================================= */

const previewEmail =
    document.getElementById("previewEmail");

const previewSubject =
    document.getElementById("previewSubject");

const previewEyebrow =
    document.getElementById("previewEyebrow");

const previewHeading =
    document.getElementById("previewHeading");

const previewIntro =
    document.getElementById("previewIntro");

const previewAmount =
    document.getElementById("previewAmount");

const previewInvoice =
    document.getElementById("previewInvoice");

const previewPaymentType =
    document.getElementById("previewPaymentType");

const previewStatus =
    document.getElementById("previewStatus");

const previewNotice =
    document.getElementById("previewNotice");


/* =========================================================
   FORMAT MONEY
========================================================= */

function formatCurrency(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "R0.00";
    }

    return new Intl.NumberFormat(
        "en-ZA",
        {
            style: "currency",
            currency: "ZAR"
        }
    ).format(number);

}


/* =========================================================
   UPDATE EMAIL PREVIEW
========================================================= */

function updatePreview() {

    const status =
        paymentStatus.value;

    const email =
        clientEmail.value.trim();

    const invoice =
        invoiceNumber.value.trim();

    const type =
        paymentType.value;

    const money =
        formatCurrency(amount.value);


    previewEmail.textContent =
        email || "Client email";

    previewInvoice.textContent =
        invoice || "—";

    previewAmount.textContent =
        money;

    previewPaymentType.textContent =
        type;


    if (status === "paid") {

        previewEyebrow.textContent =
            "PAYMENT CONFIRMED";

        previewHeading.innerHTML =
            "Payment received.";

        previewIntro.textContent =
            "Your payment has been successfully received, verified and allocated to the invoice below.";

        previewStatus.textContent =
            "Payment Received";

        previewNotice.innerHTML = `
            <strong>PAYMENT VERIFIED</strong>

            <p>
                The payment of ${money} has been received
                and allocated to invoice ${invoice || "—"}.
                The invoice has now been marked as paid.
            </p>
        `;

        previewNotice.style.background =
            "#eef8f0";

        previewNotice.style.borderLeftColor =
            "#258044";

        previewNotice.querySelector("strong").style.color =
            "#258044";

        previewNotice.querySelector("p").style.color =
            "#52745b";

        previewSubject.textContent =
            `Payment Confirmed — ${invoice || "Invoice"}`;

    } else {

        previewEyebrow.textContent =
            "PROOF OF PAYMENT RECEIVED";

        previewHeading.innerHTML =
            "We've received your<br>proof of payment.";

        previewIntro.textContent =
            "Thank you for sending your proof of payment. We have received the document and will verify the transaction.";

        previewStatus.textContent =
            "Awaiting Verification";

        previewNotice.innerHTML = `
            <strong>AWAITING BANK VERIFICATION</strong>

            <p>
                The proof of payment has been received,
                but the payment has not yet been confirmed.
            </p>
        `;

        previewNotice.style.background =
            "#fff8e9";

        previewNotice.style.borderLeftColor =
            "#f59b00";

        previewNotice.querySelector("strong").style.color =
            "#a56700";

        previewNotice.querySelector("p").style.color =
            "#806b49";

        previewSubject.textContent =
            `Proof of Payment Received — ${invoice || "Invoice"}`;

    }

}


/* =========================================================
   LIVE PREVIEW EVENTS
========================================================= */

[
    clientName,
    clientEmail,
    invoiceNumber,
    receiptNumber,
    amount,
    paymentType,
    paymentStatus
].forEach(element => {

    if (!element) return;

    element.addEventListener(
        "input",
        updatePreview
    );

    element.addEventListener(
        "change",
        updatePreview
    );

});


/* =========================================================
   DEFAULT DATE
========================================================= */

if (paymentDate) {

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(today.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(today.getDate())
            .padStart(2, "0");

    paymentDate.value =
        `${year}-${month}-${day}`;

}


/* =========================================================
   FILE UPLOAD DISPLAY
========================================================= */

function setupFileInput(inputId, outputId) {

    const input =
        document.getElementById(inputId);

    const output =
        document.getElementById(outputId);

    if (!input || !output) return;


    const clearFile = () => {
        input.value = "";
        output.textContent = "";
    };


    input.addEventListener("change", () => {

        output.innerHTML = "";

        if (!input.files.length) {
            return;
        }


        const file =
            input.files[0];

        const row =
            document.createElement("span");

        row.className = "file-selected-row";

        const fileName =
            document.createElement("span");

        fileName.className = "file-name-value";
        fileName.textContent = file.name;

        const removeButton =
            document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "remove-file";
        removeButton.textContent = "Remove";
        removeButton.setAttribute("aria-label", `Remove ${file.name}`);

        removeButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            clearFile();
        });

        row.appendChild(fileName);
        row.appendChild(removeButton);
        output.appendChild(row);

    });

}


setupFileInput(
    "proofFile",
    "proofFileName"
);

setupFileInput(
    "invoiceFile",
    "invoiceFileName"
);

setupFileInput(
    "receiptFile",
    "receiptFileName"
);


/* =========================================================
   TOAST
========================================================= */

const toast =
    document.getElementById("toast");

const toastTitle =
    document.getElementById("toastTitle");

const toastMessage =
    document.getElementById("toastMessage");


function showToast(title, message) {

    toastTitle.textContent =
        title;

    toastMessage.textContent =
        message;

    toast.classList.add("show");


    setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);

}


/* =========================================================
   SAVE DRAFT
========================================================= */

const saveDraft =
    document.getElementById("saveDraft");


if (saveDraft) {

    saveDraft.addEventListener("click", async () => {

        const draft = {

            clientName:
                clientName.value,

            clientEmail:
                clientEmail.value,

            invoiceNumber:
                invoiceNumber.value,

            receiptNumber:
                receiptNumber.value,

            amount:
                amount.value,

            paymentType:
                paymentType.value,

            paymentDate:
                paymentDate.value,

            paymentStatus:
                paymentStatus.value

        };


        localStorage.setItem(
            "zymaPaymentDraft",
            JSON.stringify(draft)
        );


        showToast(
            "Draft Saved",
            "Payment information has been saved locally."
        );

    });

}


/* =========================================================
   RESTORE DRAFT
========================================================= */

function restoreDraft() {

    if (isApiModeEnabled()) return;

    const saved =
        localStorage.getItem(
            "zymaPaymentDraft"
        );

    if (!saved) return;


    try {

        const draft =
            JSON.parse(saved);


        if (clientName)
            clientName.value =
                draft.clientName || "";

        if (clientEmail)
            clientEmail.value =
                draft.clientEmail || "";

        if (invoiceNumber)
            invoiceNumber.value =
                draft.invoiceNumber || "";

        if (receiptNumber)
            receiptNumber.value =
                draft.receiptNumber || "";

        if (amount)
            amount.value =
                draft.amount || "";

        if (paymentType)
            paymentType.value =
                draft.paymentType ||
                draft.paymentMethod ||
                "Bank transfer (EFT)";

        if (paymentDate)
            paymentDate.value =
                draft.paymentDate || "";

        if (paymentStatus)
            paymentStatus.value =
                draft.paymentStatus || "awaiting";


        updatePreview();

    } catch (error) {

        console.error(
            "Unable to restore payment draft.",
            error
        );

    }

}


restoreDraft();


/* =========================================================
   FORM SUBMISSION
========================================================= */

if (form) {

    form.addEventListener("submit", event => {

        event.preventDefault();


        if (!form.checkValidity()) {

            form.reportValidity();

            return;

        }

        if (isApiModeEnabled()) {
            submitPaymentToApi();
            return;
        }


        const payment = {

            clientName:
                clientName.value.trim(),

            clientEmail:
                clientEmail.value.trim(),

            invoiceNumber:
                invoiceNumber.value.trim(),

            receiptNumber:
                receiptNumber.value.trim(),

            amount:
                Number(amount.value),

            paymentType:
                paymentType.value,

            paymentDate:
                paymentDate.value,

            paymentStatus:
                paymentStatus.value,

            createdAt:
                new Date().toISOString()

        };


        console.log(
            "Payment ready for API:",
            payment
        );


        /*
            API MODE SENDS THIS PAYMENT TO THE PRODUCTION BACKEND:

            POST /api/payments

            {
                clientName,
                clientEmail,
                invoiceNumber,
                receiptNumber,
                amount,
                paymentType,
                paymentDate,
                paymentStatus,
                documents
            }

        */


        showToast(
            "Payment Ready",
            "The payment record has passed validation."
        );

    });

}


/* =========================================================
   SEARCH
========================================================= */

const paymentSearch =
    document.getElementById("paymentSearch");

const statusFilter =
    document.getElementById("statusFilter");

const paymentTypeFilter =
    document.getElementById("paymentTypeFilter");

function getSearchableRows() {
    return document.querySelectorAll(".searchable-row");
}

function getPaymentStatusControls() {
    return document.querySelectorAll(".payment-status-control");
}

const paymentStatusStorageKey =
    "zymaPaymentStatuses";


function restorePaymentStatuses() {

    if (isApiModeEnabled()) return;

    let saved;

    try {

        saved = localStorage.getItem(
            paymentStatusStorageKey
        );

    } catch (error) {

        console.error(
            "Unable to read saved payment statuses.",
            error
        );

        return;

    }


    if (!saved) return;


    try {

        const statuses =
            JSON.parse(saved);

        if (
            !statuses ||
            typeof statuses !== "object" ||
            Array.isArray(statuses)
        ) {
            throw new Error("Saved payment statuses are invalid.");
        }


        getPaymentStatusControls().forEach(control => {

            const row =
                control.closest(".searchable-row");

            const savedStatus =
                statuses[row.dataset.invoice];

            if (
                savedStatus !== "awaiting" &&
                savedStatus !== "paid"
            ) {
                return;
            }


            control.value =
                savedStatus;

            control.dataset.status =
                savedStatus;

            row.dataset.status =
                savedStatus;

        });

    } catch (error) {

        console.error(
            "Unable to restore saved payment statuses.",
            error
        );

    }

}


restorePaymentStatuses();


function filterPayments() {

    const query =
        paymentSearch.value
            .toLowerCase()
            .trim();

    const status =
        statusFilter.value;

    const type =
        paymentTypeFilter.value.toLowerCase();


    getSearchableRows().forEach(row => {

        const text =
            Array.from(row.children)
                .filter(cell => !cell.matches(".payment-status-control"))
                .map(cell => cell.textContent.toLowerCase())
                .join(" ");

        const rowStatus =
            row.dataset.status;

        const rowType =
            row.querySelector(".payment-type")
                .textContent
                .trim()
                .toLowerCase();


        const matchesSearch =
            !query ||
            text.includes(query);

        const matchesStatus =
            status === "all" ||
            rowStatus === status;

        const matchesType =
            type === "all" ||
            rowType === type;


        row.style.display =
            matchesSearch && matchesStatus && matchesType
                ? ""
                : "none";

    });

}


if (paymentSearch) {

    paymentSearch.addEventListener(
        "input",
        filterPayments
    );

}


if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        filterPayments
    );

}

if (paymentTypeFilter) {

    paymentTypeFilter.addEventListener(
        "change",
        filterPayments
    );

}


function bindPaymentStatusControl(control) {
    if (!control || control.dataset.bound === "true") return;

    control.dataset.bound = "true";

    control.addEventListener("change", async () => {
        if (isApiModeEnabled()) {
            await handleApiStatusChange(control);
            return;
        }

        const row = control.closest(".searchable-row");
        if (!row) return;

        const previousStatus = row.dataset.status;
        const nextStatus = control.value;

        if (nextStatus !== "awaiting" && nextStatus !== "paid") {
            control.value = previousStatus;
            return;
        }

        control.dataset.status = nextStatus;
        row.dataset.status = nextStatus;

        const statuses = {};
        getSearchableRows().forEach(paymentRow => {
            if (paymentRow.dataset.invoice) {
                statuses[paymentRow.dataset.invoice] =
                    paymentRow.dataset.status;
            }
        });

        try {
            localStorage.setItem(
                paymentStatusStorageKey,
                JSON.stringify(statuses)
            );
        } catch (error) {
            control.value = previousStatus;
            control.dataset.status = previousStatus;
            row.dataset.status = previousStatus;

            console.error("Unable to save payment status.", error);
            showToast(
                "Status Not Saved",
                "Unable to save the payment status locally."
            );
            return;
        }

        filterPayments();

        showToast(
            "Payment Updated",
            nextStatus === "paid"
                ? "Payment marked as received."
                : "Payment set to awaiting reflection."
        );
    });
}

function bindPaymentSearchEvents() {
    getPaymentStatusControls().forEach(bindPaymentStatusControl);
}

bindPaymentSearchEvents();



/* =========================================================
   TEXT BUTTON PAGE NAVIGATION
========================================================= */

document.querySelectorAll(
    "[data-page-target]"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            showPage(
                button.dataset.pageTarget
            );

        }
    );

});


/* =========================================================
   INITIAL DATA LOAD
========================================================= */

updatePreview();

if (isApiModeEnabled()) {
    // The backend is the source of truth. Load persisted payments whenever
    // the application starts so refresh/login never resets the visible data.
    loadCurrentUserFromApi();
    loadPaymentsFromApi();
    awaitBillingMigrationAndRefresh();

    // Browser back/forward navigation can restore a page from the bfcache.
    // Rehydrate the payment state when that happens as well.
    window.addEventListener("pageshow", () => {
        loadPaymentsFromApi();
        loadBillingDashboard();
    });

    window.addEventListener("zyma:billing-updated", () => {
        loadBillingDashboard();
        loadPaymentsFromApi();
    });
}

async function awaitBillingMigrationAndRefresh() {
    await migrateLegacyBillingData();
    await loadBillingDashboard();
}

// If an invoice page sends the user here, prefill the payment form from the
// authoritative invoice record instead of asking staff to retype it.
(async function hydratePaymentFromInvoiceQuery() {
    if (!isApiModeEnabled() || !form) return;
    const invoiceRef = new URLSearchParams(window.location.search).get("invoice");
    if (!invoiceRef) return;
    try {
        const response = await window.zymaApi.listInvoices({ search: invoiceRef });
        const invoices = Array.isArray(response) ? response : response?.items || [];
        const invoice = invoices.find(item => (item.invoiceNumber ?? item.number) === invoiceRef);
        if (!invoice) return;
        const normalized = normalizeDashboardInvoice(invoice);
        openPaymentForInvoice(normalized);
        showPage("new-payment");
        window.history.replaceState({}, document.title, "dashboard.html");
    } catch (error) {
        console.warn("Unable to prefill payment from invoice.", error);
    }
})();
