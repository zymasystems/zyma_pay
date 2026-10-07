const invoiceStorageKey = "zymaInvoices";
const invoiceForm = document.getElementById("invoiceForm");
const invoiceItems = document.getElementById("invoiceItems");
const savedInvoices = document.getElementById("savedInvoices");
const invoiceFormPanel = document.getElementById("invoiceFormPanel");
const invoicePreview = document.getElementById("invoicePrintPreview");
const invoicePdfViewer = document.getElementById("invoicePdfViewer");
const downloadInvoicePdf = document.getElementById("downloadInvoicePdf");
const invoiceFormMessage = document.getElementById("invoiceFormMessage");
const invoiceRegisterMessage =
    document.getElementById("invoiceRegisterMessage");
const invoiceVat = document.getElementById("invoiceVat");
const invoiceTerms = document.getElementById("invoiceTerms");
let currentPdfUrl = "";
let invoiceLogoDataPromise;
const defaultInvoiceNotes = `Please make payments to our business bank account:
Bank: [Bank name]
Name: [Account name]
Account Number: [Account number]
Branch Code: [Branch code]
Account Type: [Account type]

Thank you for your patronage!`;
let currentPreviewInvoiceNumber = "";

function formatInvoiceCurrency(value) {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR"
    }).format(value);
}

function formatInvoicePdfDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value.replace(/-/g, "/")
        : value;
}

function roundInvoiceCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getInvoiceLines() {
    return Array.from(invoiceItems.querySelectorAll(".invoice-item-row")).map(row => {
        const quantity = Number(row.querySelector(".item-quantity").value);
        const unitPrice = Number(row.querySelector(".item-rate").value);

        return {
            description: row.querySelector(".item-description").value.trim(),
            quantity,
            unitPrice,
            total: roundInvoiceCurrency(quantity * unitPrice)
        };
    });
}

function updateInvoiceTotals() {
    let subtotal = 0;

    invoiceItems.querySelectorAll(".invoice-item-row").forEach(row => {
        const quantity = Number(row.querySelector(".item-quantity").value) || 0;
        const unitPrice = Number(row.querySelector(".item-rate").value) || 0;
        const lineTotal = roundInvoiceCurrency(quantity * unitPrice);

        subtotal += lineTotal;
        row.querySelector(".item-line-total").textContent =
            formatInvoiceCurrency(lineTotal);
    });

    const vat = invoiceVat.checked ? subtotal * 0.15 : 0;
    const roundedVat = roundInvoiceCurrency(vat);
    document.getElementById("invoiceSubtotal").textContent =
        formatInvoiceCurrency(subtotal);
    document.getElementById("invoiceVatAmount").textContent =
        formatInvoiceCurrency(roundedVat);
    document.getElementById("invoiceTotal").textContent =
        formatInvoiceCurrency(roundInvoiceCurrency(subtotal + roundedVat));
    document.getElementById("invoiceVatRow").hidden =
        !invoiceVat.checked;
}

function bindInvoiceItem(row) {
    row.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", updateInvoiceTotals);
    });

    row.querySelector(".remove-invoice-item").addEventListener("click", () => {
        row.remove();
        updateInvoiceTotals();
    });
}

function loadInvoices() {
    let stored;

    try {
        stored = localStorage.getItem(invoiceStorageKey);
    } catch (error) {
        console.error("Unable to read saved invoices.", error);
        invoiceRegisterMessage.textContent =
            "Saved invoices are unavailable because browser storage could not be read.";
        return [];
    }

    if (!stored) return [];

    try {
        const invoices = JSON.parse(stored);
        if (!Array.isArray(invoices)) {
            throw new Error("Saved invoice data is not a list.");
        }
        return invoices.map(invoice => ({
            ...invoice,
            terms: invoice.terms || "Due on Receipt",
            notes: invoice.notes || defaultInvoiceNotes,
            status: ["draft", "sent", "paid"].includes(invoice.status)
                ? invoice.status
                : "draft"
        }));
    } catch (error) {
        console.error("Unable to restore saved invoices.", error);
        invoiceRegisterMessage.textContent =
            "Saved invoice data could not be read. Create a new invoice to continue.";
        return [];
    }
}

function nextInvoiceNumber(invoices, year) {
    const sequence = invoices.reduce((highest, invoice) => {
        const match = /^INV-(\d{4})-(\d+)$/.exec(invoice.number || "");
        if (!match || Number(match[1]) !== year) return highest;
        return Math.max(highest, Number(match[2]));
    }, 0);

    return `INV-${year}-${String(sequence + 1).padStart(4, "0")}`;
}

function setDefaultInvoiceDates() {
    const today = new Date();
    const localToday = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
    document.getElementById("invoiceIssueDate").value = localToday;
    invoiceTerms.value = "Due on Receipt";
    document.getElementById("invoiceDueDate").value = localToday;
}

function updateInvoiceDueDate() {
    const issueDate =
        document.getElementById("invoiceIssueDate").value;

    if (!issueDate) return;

    const dueDate = new Date(`${issueDate}T00:00:00`);
    const termDays = {
        "Due on Receipt": 0,
        "7 days": 7,
        "14 days": 14,
        "30 days": 30
    }[invoiceTerms.value];

    dueDate.setDate(dueDate.getDate() + termDays);
    document.getElementById("invoiceDueDate").value =
        new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
}

function renderSavedInvoices(invoices) {
    savedInvoices.replaceChildren();
    updateInvoiceSummary(invoices);

    if (!invoices.length) {
        const empty = document.createElement("p");
        empty.className = "empty-invoices";
        empty.textContent = "No invoices yet. Select “Create invoice” to get started.";
        savedInvoices.append(empty);
        return;
    }

    [...invoices].reverse().forEach(invoice => {
        const row = document.createElement("article");
        row.className = "saved-invoice-row";
        row.dataset.status = invoice.status;
        row.dataset.search = `${invoice.number} ${invoice.client}`.toLowerCase();

        const details = document.createElement("div");
        const number = document.createElement("strong");
        const email = document.createElement("span");
        const client = document.createElement("span");
        const issued = document.createElement("span");
        const dueDate = document.createElement("span");
        const amount = document.createElement("strong");
        const actions = document.createElement("div");
        actions.className = "saved-invoice-actions";
        const status = document.createElement("select");
        status.className = `invoice-status-select status-${invoice.status}`;
        status.setAttribute("aria-label", `Status for invoice ${invoice.number}`);
        [
            ["draft", "Draft"],
            ["sent", "Sent"],
            ["paid", "Paid"]
        ].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = invoice.status === value;
            status.append(option);
        });
        const previewButton = document.createElement("button");
        const downloadButton = document.createElement("button");
        const deleteButton = document.createElement("button");

        number.textContent = invoice.number;
        email.textContent = invoice.email;
        client.textContent = invoice.client;
        issued.textContent = invoice.issueDate;
        dueDate.textContent = invoice.dueDate;
        amount.textContent = formatInvoiceCurrency(invoice.total);
        previewButton.type = "button";
        previewButton.className = "secondary-button";
        previewButton.textContent = "Preview PDF";
        previewButton.addEventListener("click", () => showInvoicePreview(invoice));
        downloadButton.type = "button";
        downloadButton.className = "secondary-button";
        downloadButton.textContent = "Download PDF";
        downloadButton.addEventListener("click", () => downloadInvoice(invoice));
        deleteButton.type = "button";
        deleteButton.className = "invoice-delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete invoice ${invoice.number}`
        );
        deleteButton.addEventListener("click", () => deleteInvoice(invoice.number));
        status.addEventListener("change", () => {
            updateInvoiceStatus(invoice.number, status.value);
        });

        details.append(number, email);
        actions.append(previewButton, downloadButton, deleteButton);
        row.append(details, client, issued, dueDate, amount, status, actions);
        savedInvoices.append(row);
    });

    filterInvoices();
}

function updateInvoiceSummary(invoices) {
    document.getElementById("invoiceCountTotal").textContent =
        String(invoices.length);
    document.getElementById("invoiceCountDraft").textContent =
        String(invoices.filter(invoice => invoice.status === "draft").length);
    document.getElementById("invoiceCountSent").textContent =
        String(invoices.filter(invoice => invoice.status === "sent").length);
    document.getElementById("invoiceCountPaid").textContent =
        String(invoices.filter(invoice => invoice.status === "paid").length);
}

function updateInvoiceStatus(number, status) {
    if (!["draft", "sent", "paid"].includes(status)) return;

    const invoices = loadInvoices();
    const invoice = invoices.find(saved => saved.number === number);
    if (!invoice) {
        invoiceRegisterMessage.textContent =
            "That invoice could not be found. Refresh the list and try again.";
        return;
    }

    const previousStatus = invoice.status;
    invoice.status = status;

    try {
        localStorage.setItem(invoiceStorageKey, JSON.stringify(invoices));
    } catch (error) {
        console.error("Unable to update invoice status.", error);
        invoiceRegisterMessage.textContent =
            "Invoice status could not be saved in this browser.";
        invoice.status = previousStatus;
        renderSavedInvoices(invoices);
        return;
    }

    renderSavedInvoices(invoices);
}

function deleteInvoice(number) {
    if (!window.confirm(`Delete invoice ${number}? This cannot be undone.`)) {
        return;
    }

    let stored;

    try {
        stored = localStorage.getItem(invoiceStorageKey);
    } catch (error) {
        console.error("Unable to read invoices before deleting.", error);
        invoiceRegisterMessage.textContent =
            "Invoice could not be deleted because saved records are unavailable.";
        return;
    }

    let invoices;

    try {
        invoices = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(invoices)) {
            throw new Error("Saved invoice data is not a list.");
        }
    } catch (error) {
        console.error("Unable to parse invoices before deleting.", error);
        invoiceRegisterMessage.textContent =
            "Invoice could not be deleted because the saved invoice list is invalid.";
        return;
    }

    const matchingInvoices =
        invoices.filter(invoice => invoice.number === number);

    if (!matchingInvoices.length) {
        invoiceRegisterMessage.textContent =
            `Invoice ${number} was not found. Refresh the page and try again.`;
        return;
    }

    const remainingInvoices =
        invoices.filter(invoice => invoice.number !== number);

    try {
        localStorage.setItem(
            invoiceStorageKey,
            JSON.stringify(remainingInvoices)
        );
    } catch (error) {
        console.error("Unable to save invoices after deletion.", error);
        invoiceRegisterMessage.textContent =
            `Invoice ${number} could not be deleted from browser storage.`;
        return;
    }

    if (currentPreviewInvoiceNumber === number) {
        invoicePdfViewer.removeAttribute("src");
        downloadInvoicePdf.removeAttribute("href");
        invoicePreview.hidden = true;

        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
            currentPdfUrl = "";
        }

        currentPreviewInvoiceNumber = "";
    }

    renderSavedInvoices(remainingInvoices);
    invoiceRegisterMessage.textContent =
        `Invoice ${number} was deleted.`;
}

function filterInvoices() {
    const search =
        document.getElementById("invoiceSearch").value.trim().toLowerCase();
    const status =
        document.getElementById("invoiceStatusFilter").value;

    savedInvoices.querySelectorAll(".saved-invoice-row").forEach(row => {
        const matchesSearch =
            !search || row.dataset.search.includes(search);
        const matchesStatus =
            status === "all" || row.dataset.status === status;
        row.hidden = !(matchesSearch && matchesStatus);
    });

    const hasRows =
        savedInvoices.querySelector(".saved-invoice-row");
    const hasVisibleRows =
        Array.from(savedInvoices.querySelectorAll(".saved-invoice-row"))
            .some(row => !row.hidden);
    let empty = savedInvoices.querySelector(".invoice-filter-empty");

    if (hasRows && !hasVisibleRows) {
        if (!empty) {
            empty = document.createElement("p");
            empty.className = "empty-invoices invoice-filter-empty";
            empty.textContent = "No invoices match those filters.";
            savedInvoices.append(empty);
        }
    } else if (empty) {
        empty.remove();
    }
}

function pdfSafeText(value) {
    return String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7e]/g, "?");
}

function pdfEscape(value) {
    return pdfSafeText(value)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function pdfBinaryBytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
        bytes[index] = value.charCodeAt(index);
    }
    return bytes;
}

function getInvoiceLogoData() {
    if (!invoiceLogoDataPromise) {
        invoiceLogoDataPromise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    const context = canvas.getContext("2d");

                    if (!context) {
                        throw new Error("Canvas is unavailable for invoice logo conversion.");
                    }

                    context.drawImage(image, 0, 0);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
                    const base64 = dataUrl.split(",")[1];
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);

                    for (let index = 0; index < binary.length; index += 1) {
                        bytes[index] = binary.charCodeAt(index);
                    }

                    resolve({
                        bytes,
                        width: canvas.width,
                        height: canvas.height
                    });
                } catch (error) {
                    reject(error);
                }
            };
            image.onerror = () => {
                reject(new Error("Unable to load Zyma invoice logo from images/5.png."));
            };
            image.src = new URL("images/5.png", window.location.href).href;
        });
    }

    return invoiceLogoDataPromise;
}

function wrapPdfText(value, maxCharacters) {
    const lines = [];

    pdfSafeText(value).split(/\r?\n/).forEach(paragraph => {
        const words = paragraph.split(/\s+/);
        let line = "";

        words.forEach(word => {
            if (!word) return;

            if (word.length > maxCharacters) {
                if (line) {
                    lines.push(line);
                    line = "";
                }
                for (let offset = 0; offset < word.length; offset += maxCharacters) {
                    lines.push(word.slice(offset, offset + maxCharacters));
                }
                return;
            }

            const next = line ? `${line} ${word}` : word;
            if (next.length > maxCharacters) {
                if (line) lines.push(line);
                line = word;
            } else {
                line = next;
            }
        });

        if (line) lines.push(line);
        else if (!paragraph) lines.push("");
    });

    return lines;
}

async function createInvoicePdf(invoice) {
    const logo = await getInvoiceLogoData();
    const pages = [];
    let commands = [];
    let y = 0;
    const invoiceTotal =
        Number(invoice.total) || Number(invoice.subtotal) + Number(invoice.vatAmount || 0);
    const balanceDue =
        invoice.status === "paid" ? 0 : invoiceTotal;

    const addText = (x, top, text, size = 10) => {
        commands.push(
            `BT /F1 ${size} Tf 1 0 0 1 ${x} ${top} Tm (${pdfEscape(text)}) Tj ET`
        );
    };

    const addBoldText = (x, top, text, size = 10) => {
        commands.push(
            `BT /F2 ${size} Tf 1 0 0 1 ${x} ${top} Tm (${pdfEscape(text)}) Tj ET`
        );
    };

    const addLine = (x1, y1, x2, y2) => {
        commands.push(`0.8 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };

    const addRightText = (right, top, text, size = 10) => {
        const safeText = pdfSafeText(text);
        const estimatedWidth = safeText.length * size * 0.52;
        addText(Math.max(36, right - estimatedWidth), top, safeText, size);
    };

    const addLogo = () => {
        commands.push("q 198 0 0 198 36 608 cm /Logo Do Q");
    };

    const startPage = (firstPage) => {
        commands = [];

        if (firstPage) {
            addLogo();
            addBoldText(36, 597, "Zyma Systems", 9);
            addText(36, 584, "South Africa", 8);
            addText(36, 571, "payments@zyma.co.za", 8);
            addText(36, 558, "https://zyma.co.za", 8);

            addRightText(559, 795, "Invoice", 29);
            addRightText(559, 775, `# ${invoice.number}`, 9);
            addRightText(559, 742, "Balance Due", 8);
            const balanceText = formatInvoiceCurrency(balanceDue);
            addBoldText(
                Math.max(36, 559 - pdfSafeText(balanceText).length * 11 * 0.52),
                725,
                balanceText,
                11
            );

            addText(36, 484, "Bill To", 8);
            addBoldText(36, 468, invoice.client, 9);

            const dateRows = [
                ["Invoice Date", formatInvoicePdfDate(invoice.issueDate)],
                ["Terms", invoice.terms || "Due on Receipt"],
                ["Due Date", formatInvoicePdfDate(invoice.dueDate)]
            ];
            dateRows.forEach((row, index) => {
                const top = 522 - index * 22;
                addRightText(442, top, `${row[0]} :`, 8);
                addRightText(559, top, row[1], 8);
            });

            y = 451;
        } else {
            commands.push("q 54 0 0 54 36 752 cm /Logo Do Q");
            addBoldText(98, 800, "Zyma Systems", 9);
            addText(98, 787, "South Africa", 8);
            addText(98, 774, "payments@zyma.co.za", 8);
            addText(98, 761, "https://zyma.co.za", 8);
            addRightText(559, 795, "Invoice", 25);
            addRightText(559, 775, `${invoice.number} - continued`, 10);
            y = 700;
        }

        const tableTop = y - 6;
        commands.push(`0.23 0.23 0.23 rg 36 ${tableTop - 27} 523 28 re f`);
        commands.push("1 1 1 rg");
        addText(49, tableTop - 18, "#", 8);
        addText(78, tableTop - 18, "Item & Description", 8);
        addRightText(408, tableTop - 18, "Qty", 8);
        addRightText(474, tableTop - 18, "Rate", 8);
        addRightText(550, tableTop - 18, "Amount", 8);
        commands.push("0 0 0 rg");
        y = tableTop - 29;
    };

    startPage(true);

    invoice.items.forEach((item, index) => {
        const descriptionLines = wrapPdfText(item.description, 55);
        const rowHeight = Math.max(30, descriptionLines.length * 12 + 6);

        if (y - rowHeight < 175) {
            pages.push(commands.join("\n"));
            startPage(false);
        }

        addText(49, y - 12, String(index + 1), 8);
        descriptionLines.forEach((line, index) => {
            addText(78, y - 12 - index * 12, line, 8);
        });
        addRightText(408, y - 12, Number(item.quantity).toFixed(2), 8);
        addRightText(
            474,
            y - 12,
            Number(item.unitPrice).toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            8
        );
        addRightText(
            550,
            y - 12,
            Number(item.total).toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            8
        );
        y -= rowHeight;
        addLine(36, y, 559, y);
    });

    const notesLines = wrapPdfText(
        invoice.notes || defaultInvoiceNotes,
        90
    );
    const notesSpace = 17 + Math.max(0, notesLines.length - 1) * 11;
    const totalsSpace = 148 + (invoice.vatAmount > 0 ? 24 : 0);
    if (y < 36 + notesSpace + totalsSpace) {
        pages.push(commands.join("\n"));
        startPage(false);
    }

    const totalsTop = y - 23;
    addRightText(456, totalsTop, "Sub Total", 8);
    addRightText(
        550,
        totalsTop,
        Number(invoice.subtotal).toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }),
        8
    );
    y = totalsTop - 31;

    if (invoice.vatAmount > 0) {
        addRightText(456, y, "VAT (15%)", 8);
        addRightText(
            550,
            y,
            Number(invoice.vatAmount).toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            8
        );
        y -= 24;
    }

    addBoldText(430, y, "Total", 9);
    const totalText = formatInvoiceCurrency(invoiceTotal);
    addBoldText(
        Math.max(36, 550 - pdfSafeText(totalText).length * 9 * 0.52),
        y,
        totalText,
        9
    );
    y -= 32;

    commands.push(`0.96 0.96 0.96 rg 292 ${y - 19} 267 34 re f 0 0 0 rg`);
    addBoldText(394, y, "Balance Due", 9);
    const balanceDueText = formatInvoiceCurrency(balanceDue);
    addBoldText(
        Math.max(36, 550 - pdfSafeText(balanceDueText).length * 9 * 0.52),
        y,
        balanceDueText,
        9
    );
    y -= 62;

    addText(36, y, "Notes", 10);
    y -= 17;
    notesLines.forEach(line => {
        if (y < 36) {
            pages.push(commands.join("\n"));
            startPage(false);
            y = 480;
            addText(36, y, "Notes (continued)", 10);
            y -= 17;
        }
        addText(36, y, line, 7);
        y -= 11;
    });
    pages.push(commands.join("\n"));

    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [PAGE_REFS] /Count PAGE_COUNT >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n${Array.from(logo.bytes, byte => String.fromCharCode(byte)).join("")}\nendstream`
    ];
    const pageRefs = [];

    pages.forEach((content, index) => {
        const pageObjectNumber = 6 + index * 2;
        const contentObjectNumber = pageObjectNumber + 1;
        pageRefs.push(`${pageObjectNumber} 0 R`);
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
        );
        objects.push(
            `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
        );
    });

    objects[1] = objects[1]
        .replace("PAGE_REFS", pageRefs.join(" "))
        .replace("PAGE_COUNT", String(pages.length));

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdfBinaryBytes(pdf)], { type: "application/pdf" });
}

function invoiceFilename(invoice) {
    const safeNumber =
        pdfSafeText(invoice.number).replace(/[^A-Za-z0-9_-]/g, "_");
    return `${safeNumber || "invoice"}.pdf`;
}

async function downloadInvoice(invoice) {
    try {
        const pdf = await createInvoicePdf(invoice);
        const url = URL.createObjectURL(pdf);
        const link = document.createElement("a");
        link.href = url;
        link.download = invoiceFilename(invoice);
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error("Unable to generate invoice PDF for download.", error);
        invoiceRegisterMessage.textContent =
            "Invoice PDF could not be generated. Check that images/5.png is available and try again.";
    }
}

async function showInvoicePreview(invoice) {
    if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl);
        currentPdfUrl = "";
    }

    try {
        const pdf = await createInvoicePdf(invoice);
        currentPdfUrl = URL.createObjectURL(pdf);
        currentPreviewInvoiceNumber = invoice.number;
        invoicePdfViewer.src = currentPdfUrl;
        downloadInvoicePdf.href = currentPdfUrl;
        downloadInvoicePdf.download = invoiceFilename(invoice);
        invoicePreview.hidden = false;
        invoicePreview.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Unable to generate invoice PDF preview.", error);
        invoiceRegisterMessage.textContent =
            "Invoice PDF preview could not be generated. Check that images/5.png is available and try again.";
    }
}

document.getElementById("addInvoiceItem").addEventListener("click", () => {
    const template =
        document.getElementById("invoiceItemTemplate");
    const row = template.content.firstElementChild.cloneNode(true);
    invoiceItems.append(row);
    bindInvoiceItem(row);
});

document.getElementById("showInvoiceForm").addEventListener("click", () => {
    invoiceFormPanel.hidden = false;
    document.getElementById("invoiceClient").focus();
    invoiceFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("cancelInvoiceForm").addEventListener("click", () => {
    invoiceForm.reset();
    invoiceItems.replaceChildren(
        document.getElementById("invoiceItemTemplate").content
            .firstElementChild.cloneNode(true)
    );
    invoiceItems.querySelectorAll(".invoice-item-row").forEach(bindInvoiceItem);
    invoiceFormMessage.textContent = "";
    invoiceFormPanel.hidden = true;
    setDefaultInvoiceDates();
    updateInvoiceTotals();
});

document.getElementById("invoiceSearch").addEventListener(
    "input",
    filterInvoices
);
document.getElementById("invoiceStatusFilter").addEventListener(
    "change",
    filterInvoices
);

document.getElementById("invoiceIssueDate").addEventListener(
    "change",
    updateInvoiceDueDate
);
invoiceTerms.addEventListener("change", updateInvoiceDueDate);

invoiceItems.querySelectorAll(".invoice-item-row").forEach(bindInvoiceItem);
invoiceVat.addEventListener("change", updateInvoiceTotals);
setDefaultInvoiceDates();

const currentInvoices = loadInvoices();
document.getElementById("invoiceNumber").value =
    nextInvoiceNumber(currentInvoices, new Date().getFullYear());
renderSavedInvoices(currentInvoices);
updateInvoiceTotals();

invoiceForm.addEventListener("submit", event => {
    event.preventDefault();
    invoiceFormMessage.textContent = "";

    if (!invoiceForm.checkValidity()) {
        invoiceForm.reportValidity();
        return;
    }

    const items = getInvoiceLines();
    if (!items.length || items.some(item =>
        !item.description ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0
    )) {
        invoiceFormMessage.textContent =
            "Add at least one complete line item with a valid quantity and unit price.";
        return;
    }

    const subtotal = roundInvoiceCurrency(
        items.reduce((sum, item) => sum + item.total, 0)
    );
    const vatAmount = invoiceVat.checked
        ? roundInvoiceCurrency(subtotal * 0.15)
        : 0;
    const invoice = {
        number: document.getElementById("invoiceNumber").value.trim(),
        client: document.getElementById("invoiceClient").value.trim(),
        email: document.getElementById("invoiceEmail").value.trim(),
        billingAddress:
            document.getElementById("invoiceBillingAddress").value.trim(),
        issueDate: document.getElementById("invoiceIssueDate").value,
        dueDate: document.getElementById("invoiceDueDate").value,
        terms: invoiceTerms.value,
        notes: document.getElementById("invoiceNotes").value.trim(),
        items,
        subtotal,
        vatAmount,
        total: subtotal + vatAmount,
        status: "draft",
        createdAt: new Date().toISOString()
    };

    if (new Date(`${invoice.dueDate}T00:00:00`) <
        new Date(`${invoice.issueDate}T00:00:00`)) {
        invoiceFormMessage.textContent =
            "The due date cannot be earlier than the issue date.";
        return;
    }

    const invoices = loadInvoices();
    if (invoices.some(saved => saved.number === invoice.number)) {
        invoiceFormMessage.textContent =
            "That invoice number already exists. Refresh the page to generate the next number.";
        return;
    }

    invoices.push(invoice);

    try {
        localStorage.setItem(invoiceStorageKey, JSON.stringify(invoices));
    } catch (error) {
        console.error("Unable to save invoice.", error);
        invoiceFormMessage.textContent =
            "Invoice could not be saved in this browser. Check available storage and try again.";
        return;
    }

    renderSavedInvoices(invoices);
    invoiceFormPanel.hidden = true;
    invoiceRegisterMessage.textContent =
        `${invoice.number} created as a draft. Preview or download its PDF from the invoice register.`;
    document.getElementById("invoiceNumber").value =
        nextInvoiceNumber(invoices, new Date().getFullYear());
    document.getElementById("invoiceClient").value = "";
    document.getElementById("invoiceEmail").value = "";
    document.getElementById("invoiceBillingAddress").value = "";
    document.getElementById("invoiceNotes").value = defaultInvoiceNotes;
    invoiceTerms.value = "Due on Receipt";
    setDefaultInvoiceDates();
    invoiceItems.replaceChildren(
        document.getElementById("invoiceItemTemplate").content
            .firstElementChild.cloneNode(true)
    );
    invoiceItems.querySelectorAll(".invoice-item-row").forEach(bindInvoiceItem);
    invoiceVat.checked = false;
    updateInvoiceTotals();
});
