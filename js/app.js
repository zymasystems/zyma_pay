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
        paymentType: paymentValue(payment, "paymentType", "payment_type", "Other"),
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

    row.append(clientCell, invoice, receipt, amount, type, status);
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
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = "Creating payment…";
    }

    try {
        const payment = await window.zymaApi.createPayment(getPaymentRequest());

        // Documents are stored through the dedicated payment document endpoint
        // after the payment record has been created.
        const documents = getPaymentDocuments();
        for (const document of documents) {
            await window.zymaApi.uploadPaymentDocument(
                payment.id,
                document.input.files[0],
                document.type
            );
        }

        resetPaymentForm();
        localStorage.removeItem("zymaPaymentDraft");
        await loadPaymentsFromApi();
        showPage("payments");
        showToast(
            "Payment Created",
            "The payment record and supporting documents were saved successfully."
        );
    } catch (error) {
        console.error("Unable to create payment.", error);
        showToast(
            "Payment Not Created",
            error.message || "The backend could not create this payment."
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
                submitButton.dataset.originalText || "Continue";
        }
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


    input.addEventListener("change", () => {

        if (!input.files.length) {

            output.textContent = "";

            return;
        }


        const file =
            input.files[0];

        output.textContent =
            file.name;

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
            BACKEND WILL EVENTUALLY RECEIVE:

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
   INITIAL PREVIEW
========================================================= */

updatePreview();