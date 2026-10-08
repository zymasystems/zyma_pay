const receiptStorageKey = "zymaSalesReceipts";
const receiptApiEnabled = Boolean(window.ZYMA_PAY_CONFIG?.API_ENABLED && window.zymaApi?.isEnabled());
let receiptCache = [];
const receiptForm = document.getElementById("receiptForm");
const receiptItems = document.getElementById("receiptItems");
const savedReceipts = document.getElementById("savedReceipts");
const receiptFormPanel = document.getElementById("receiptFormPanel");
const receiptPreview = document.getElementById("receiptPrintPreview");
const receiptPdfViewer = document.getElementById("receiptPdfViewer");
const downloadReceiptPdf = document.getElementById("downloadReceiptPdf");
const receiptFormMessage = document.getElementById("receiptFormMessage");
const receiptRegisterMessage =
    document.getElementById("receiptRegisterMessage");
const defaultReceiptNotes =
    "Thank you for choosing Zyma Systems (Pty) Ltd. We appreciate your trust in our services and look forward to working with you further.";

let currentReceiptPdfUrl = "";
let currentPreviewReceiptNumber = "";
let receiptLogoPromise;
let generatedReceiptNumber = "SR-1101";

function formatReceiptCurrency(value) {
    return `R${Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatReceiptAmount(value) {
    return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function roundReceiptCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatReceiptPdfDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value.replace(/-/g, "/")
        : value;
}

function safePdfText(value) {
    return String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7e]/g, "?");
}

function escapePdfText(value) {
    return safePdfText(value)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function pdfBytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
        bytes[index] = value.charCodeAt(index);
    }
    return bytes;
}

function wrapReceiptText(value, maxCharacters) {
    const lines = [];

    safePdfText(value).split(/\r?\n/).forEach(paragraph => {
        let line = "";
        paragraph.split(/\s+/).forEach(word => {
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
            if (line && `${line} ${word}`.length > maxCharacters) {
                lines.push(line);
                line = word;
            } else {
                line = line ? `${line} ${word}` : word;
            }
        });
        if (line) lines.push(line);
        else if (!paragraph) lines.push("");
    });

    return lines;
}

function loadReceiptLogo() {
    if (!receiptLogoPromise) {
        receiptLogoPromise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    const context = canvas.getContext("2d");
                    if (!context) {
                        throw new Error("Canvas is unavailable for receipt logo conversion.");
                    }
                    context.drawImage(image, 0, 0);
                    const binary = atob(
                        canvas.toDataURL("image/jpeg", 0.94).split(",")[1]
                    );
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
                reject(new Error("Unable to load Zyma receipt logo from images/5.png."));
            };
            image.src = new URL("images/5.png", window.location.href).href;
        });
    }
    return receiptLogoPromise;
}

function getReceiptLines() {
    return Array.from(receiptItems.querySelectorAll(".invoice-item-row")).map(row => {
        const quantity = Number(row.querySelector(".item-quantity").value);
        const unitPrice = Number(row.querySelector(".item-rate").value);
        return {
            description: row.querySelector(".item-description").value.trim(),
            quantity,
            unitPrice,
            total: roundReceiptCurrency(quantity * unitPrice)
        };
    });
}

function updateReceiptTotals() {
    let subtotal = 0;
    receiptItems.querySelectorAll(".invoice-item-row").forEach(row => {
        const quantity = Number(row.querySelector(".item-quantity").value) || 0;
        const rate = Number(row.querySelector(".item-rate").value) || 0;
        const total = roundReceiptCurrency(quantity * rate);
        subtotal += total;
        row.querySelector(".item-line-total").textContent =
            formatReceiptCurrency(total);
    });
    document.getElementById("receiptSubtotal").textContent =
        formatReceiptCurrency(subtotal);
    document.getElementById("receiptTotal").textContent =
        formatReceiptCurrency(subtotal);
}

function bindReceiptItem(row) {
    row.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", updateReceiptTotals);
    });
    row.querySelector(".remove-invoice-item").addEventListener("click", () => {
        row.remove();
        updateReceiptTotals();
    });
}

function normalizeReceipt(receipt) {
    let items = [];
    try { items = receipt.itemsJson ? JSON.parse(receipt.itemsJson) : (receipt.items || []); } catch { items = []; }
    return {
        ...receipt,
        id: receipt.id || receipt.Id,
        number: receipt.receiptNumber ?? receipt.number ?? "",
        client: receipt.clientName ?? receipt.client ?? "",
        email: receipt.clientEmail ?? receipt.email ?? "",
        date: receipt.receiptDate ?? receipt.date ?? "",
        reference: receipt.reference ?? "",
        paymentMode: receipt.paymentMode ?? receipt.payment_mode ?? "Bank Transfer",
        notes: receipt.notes || defaultReceiptNotes,
        items,
        total: Number(receipt.amount ?? receipt.total ?? 0) || 0
    };
}

function receiptToApiPayload(receipt) {
    return {
        receiptNumber: receipt.number,
        clientName: receipt.client,
        clientEmail: receipt.email || "",
        reference: receipt.reference || null,
        paymentMode: receipt.paymentMode || null,
        notes: receipt.notes || null,
        itemsJson: JSON.stringify(receipt.items || []),
        amount: Number(receipt.total) || 0,
        receiptDate: receipt.date
    };
}

function readReceipts() {
    if (receiptApiEnabled) return receiptCache.slice();
    try {
        const stored = localStorage.getItem(receiptStorageKey);
        if (!stored) return [];
        const receipts = JSON.parse(stored);
        if (!Array.isArray(receipts)) throw new Error("Saved receipt data is not a list.");
        return receipts.map(normalizeReceipt);
    } catch (error) {
        console.error("Unable to restore sales receipts.", error);
        receiptRegisterMessage.textContent = "Saved receipts could not be read.";
        return [];
    }
}

async function loadReceiptsFromApi() {
    if (!receiptApiEnabled) return readReceipts();
    try {
        const response = await window.zymaApi.listReceipts();
        const items = Array.isArray(response) ? response : response?.items || [];
        receiptCache = items.map(normalizeReceipt);
        renderReceipts(receiptCache);
        try {
            await updateReceiptNumber();
        } catch (error) {
            console.error("Unable to determine the next billing document number.", error);
            receiptRegisterMessage.textContent =
                error.message || "The next sales receipt number could not be determined.";
        }
        return receiptCache.slice();
    } catch (error) {
        console.error("Unable to load sales receipts from API.", error);
        receiptRegisterMessage.textContent = error.message || "Sales receipts could not be loaded from the server.";
        renderReceipts([]);
        return [];
    }
}

async function updateReceiptNumber() {
    const nextNumber = await window.zymaBillingNumbering.next("SR");
    const numberInput = document.getElementById("receiptNumber");
    if (!numberInput.value || numberInput.value === generatedReceiptNumber) {
        numberInput.value = nextNumber;
        generatedReceiptNumber = nextNumber;
    }
}

function setDefaultReceiptDate() {
    const now = new Date();
    document.getElementById("receiptDate").value =
        new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
}

function filterReceipts() {
    const search = document.getElementById("receiptSearch")
        .value.trim().toLowerCase();
    savedReceipts.querySelectorAll(".receipt-register-row").forEach(row => {
        row.hidden = Boolean(search) && !row.dataset.search.includes(search);
    });
    const rows = Array.from(
        savedReceipts.querySelectorAll(".receipt-register-row")
    );
    let empty = savedReceipts.querySelector(".invoice-filter-empty");
    if (rows.length && !rows.some(row => !row.hidden)) {
        if (!empty) {
            empty = document.createElement("p");
            empty.className = "empty-invoices invoice-filter-empty";
            empty.textContent = "No sales receipts match that search.";
            savedReceipts.append(empty);
        }
    } else if (empty) {
        empty.remove();
    }
}

function renderReceipts(receipts) {
    savedReceipts.replaceChildren();
    document.getElementById("receiptCountTotal").textContent =
        String(receipts.length);

    if (!receipts.length) {
        const empty = document.createElement("p");
        empty.className = "empty-invoices";
        empty.textContent =
            "No sales receipts yet. Select “Create sales receipt” to get started.";
        savedReceipts.append(empty);
        return;
    }

    [...receipts].reverse().forEach(receipt => {
        const row = document.createElement("article");
        row.className = "receipt-register-row";
        row.dataset.search =
            `${receipt.number} ${receipt.client}`.toLowerCase();

        const details = document.createElement("div");
        const number = document.createElement("strong");
        const paymentMode = document.createElement("span");
        const client = document.createElement("span");
        const date = document.createElement("span");
        const reference = document.createElement("span");
        const amount = document.createElement("strong");
        const actions = document.createElement("div");
        actions.className = "saved-invoice-actions";
        number.textContent = receipt.number;
        paymentMode.textContent = receipt.paymentMode;
        client.textContent = receipt.client;
        date.textContent = receipt.date;
        reference.textContent = receipt.reference || "—";
        amount.textContent = formatReceiptCurrency(receipt.total);

        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "secondary-button";
        previewButton.textContent = "Preview PDF";
        previewButton.addEventListener("click", () => previewReceipt(receipt));

        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "secondary-button";
        downloadButton.textContent = "Download PDF";
        downloadButton.addEventListener("click", () => downloadReceipt(receipt));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "invoice-delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete sales receipt ${receipt.number}`
        );
        deleteButton.addEventListener("click", () => deleteReceipt(receipt.id || receipt.number));

        details.append(number, paymentMode);
        actions.append(previewButton, downloadButton, deleteButton);
        row.append(details, client, date, reference, amount, actions);
        savedReceipts.append(row);
    });
    filterReceipts();
}

async function createReceiptPdfLegacy(receipt) {
    const logo = await loadReceiptLogo();
    const pages = [];
    let commands = [];
    let y;

    const text = (x, top, value, size = 10, bold = false) => {
        const font = bold ? "F2" : "F1";
        commands.push(
            `0 g BT /${font} ${size} Tf 1 0 0 1 ${x} ${top} Tm (${escapePdfText(value)}) Tj ET`
        );
    };
    const rightText = (right, top, value, size = 10, bold = false) => {
        const safe = safePdfText(value);
        const estimatedWidth = safe.length * size * 0.55 + 1;
        text(Math.max(16, right - estimatedWidth), top, safe, size, bold);
    };
    const line = (x1, y1, x2, y2, width = 0.6) => {
        commands.push(`${width} w 0.78 G ${x1} ${y1} m ${x2} ${y2} l S 0 G`);
    };
    const beginPage = (continued = false) => {
        commands = [];
        if (!continued) {
            text(36, 674, "Zyma Systems", 12, true);
            text(36, 656, "South Africa", 10);
            text(36, 640, "payments@zyma.co.za", 10);
            text(36, 624, "https://zyma.co.za", 10);
            commands.push("q 180 0 0 180 379 606 cm /Logo Do Q");
            line(36, 588, 559, 588, 1);
            text(36, 568, "SALES RECEIPT", 19, true);
            text(36, 551, `Sales Receipt# ${receipt.number}`, 11);
            text(36, 518, "Bill To", 10, true);
            const clientLines = wrapReceiptText(receipt.client, 47);
            clientLines.forEach((clientLine, index) => {
                text(36, 500 - index * 13, clientLine, 11, true);
            });
            text(398, 518, "Receipt Date", 10);
            rightText(559, 518, formatReceiptPdfDate(receipt.date), 10, true);
            text(414, 498, "Reference", 10);
            const referenceLines =
                wrapReceiptText(receipt.reference || "-", 20);
            referenceLines.forEach((referenceLine, index) => {
                rightText(559, 498 - index * 11, referenceLine, 9, true);
            });
            const detailLineCount =
                Math.max(clientLines.length, referenceLines.length);
            y = 469 - (detailLineCount - 1) * 12;
        } else {
            text(36, 790, "Zyma Systems", 10, true);
            text(36, 776, `Sales Receipt ${receipt.number} - continued`, 10);
            y = 730;
        }
        commands.push(`0.94 0.94 0.94 rg 36 ${y - 16} 523 20 re f 0 G`);
        text(47, y - 11, "#", 9, true);
        text(72, y - 11, "Item & Description", 9, true);
        rightText(398, y - 11, "Qty", 9, true);
        rightText(463, y - 11, "Rate", 9, true);
        rightText(553, y - 11, "Amount", 9, true);
        y -= 24;
    };

    beginPage();
    receipt.items.forEach((item, index) => {
        const descriptionLines = wrapReceiptText(item.description, 58);
        const rowHeight = Math.max(18, descriptionLines.length * 11 + 5);
        if (y - rowHeight < 190) {
            pages.push(commands.join("\n"));
            beginPage(true);
        }
        text(47, y - 7, String(index + 1), 9);
        descriptionLines.forEach((description, lineIndex) => {
            text(72, y - 7 - lineIndex * 11, description, 9);
        });
        rightText(398, y - 7, Number(item.quantity).toFixed(2), 9);
        rightText(463, y - 7, formatReceiptAmount(item.unitPrice), 9);
        rightText(553, y - 7, formatReceiptAmount(item.total), 9);
        y -= rowHeight;
        line(36, y, 559, y);
    });

    const notesLines = wrapReceiptText(
        receipt.notes || defaultReceiptNotes,
        98
    );
    const detailsPageMinimumY = 166 + Math.max(0, notesLines.length - 1) * 12;
    if (y < detailsPageMinimumY) {
        pages.push(commands.join("\n"));
        beginPage(true);
    }

    const panelTop = y - 8;
    const panelBottom = panelTop - 82;
    commands.push(
        `0.84 G 0.8 w 36 ${panelBottom} m 338 ${panelBottom} l 348 ${panelBottom} 356 ${panelBottom + 8} 356 ${panelBottom + 18} c 356 ${panelTop - 18} l 356 ${panelTop - 8} 348 ${panelTop} 338 ${panelTop} c 46 ${panelTop} l 36 ${panelTop} 28 ${panelTop - 8} 28 ${panelTop - 18} c 28 ${panelBottom + 18} l 28 ${panelBottom + 8} 36 ${panelBottom} 46 ${panelBottom} c h S 0 G`
    );
    text(52, panelTop - 20, "Payment Details", 10, true);
    text(52, panelTop - 41, "Payment Mode", 10);
    text(172, panelTop - 41, receipt.paymentMode, 10, true);
    text(52, panelTop - 62, "Reference", 10);
    text(172, panelTop - 62, receipt.reference || "-", 10, true);

    const subtotal = Number(receipt.total) || 0;
    const totalsTop = panelTop - 9;
    rightText(462, totalsTop, "Sub Total", 10);
    rightText(559, totalsTop, formatReceiptAmount(subtotal), 10);
    line(365, totalsTop - 11, 559, totalsTop - 11);
    rightText(462, totalsTop - 22, "Total", 10, true);
    rightText(559, totalsTop - 22, formatReceiptCurrency(subtotal), 10, true);
    line(365, totalsTop - 33, 559, totalsTop - 33, 1);

    let notesY = panelBottom - 24;
    text(36, notesY, "Notes", 10, true);
    notesY -= 18;
    notesLines.forEach(note => {
        if (notesY < 36) {
            pages.push(commands.join("\n"));
            beginPage(true);
            notesY = 680;
            text(36, notesY, "Notes (continued)", 10, true);
            notesY -= 18;
        }
        text(36, notesY, note, 9);
        notesY -= 12;
    });
    pages.push(commands.join("\n"));

    const imageBytes = Array.from(
        logo.bytes,
        byte => String.fromCharCode(byte)
    ).join("");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [PAGE_REFS] /Count PAGE_COUNT >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n${imageBytes}\nendstream`
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
    return new Blob([pdfBytes(pdf)], { type: "application/pdf" });
}

async function createReceiptPdf(receipt) {
    const logo = await loadReceiptLogo();
    const pages = [];
    let commands = [];
    let y = 0;

    const addText = (x, top, value, size = 10, bold = false) => {
        const font = bold ? "F2" : "F1";
        commands.push(
            `0 g BT /${font} ${size} Tf 1 0 0 1 ${x} ${top} Tm (${escapePdfText(value)}) Tj ET`
        );
    };
    const addRightText = (right, top, value, size = 10, bold = false) => {
        const safe = safePdfText(value);
        addText(Math.max(36, right - safe.length * size * 0.52), top, safe, size, bold);
    };
    const addRule = (x1, y1, x2, y2, width = 0.6, gray = 0.78) => {
        commands.push(`${width} w ${gray} G ${x1} ${y1} m ${x2} ${y2} l S 0 G`);
    };
    const beginPage = continued => {
        commands = [];
        if (!continued) {
            addText(36, 674, "Zyma Systems", 12, true);
            addText(36, 656, "South Africa", 10);
            addText(36, 640, "payments@zyma.co.za", 10);
            addText(36, 624, "https://zyma.co.za", 10);
            commands.push("q 180 0 0 180 379 606 cm /Logo Do Q");
            addRule(36, 588, 559, 588, 1);

            addText(36, 568, "SALES RECEIPT", 19, true);
            addText(36, 551, `Sales Receipt# ${receipt.number}`, 11);
            addText(36, 518, "Bill To", 10, true);
            wrapReceiptText(receipt.client, 48).slice(0, 2).forEach((value, index) => {
                addText(36, 500 - index * 13, value, 11, true);
            });
            addText(405, 518, "Receipt Date", 10);
            addRightText(559, 518, formatReceiptPdfDate(receipt.date), 10, true);
            addText(418, 498, "Reference", 10);
            addRightText(559, 498, receipt.reference || "-", 10, true);
            y = 469;
        } else {
            addText(36, 790, "Zyma Systems", 10, true);
            addText(36, 776, `Sales Receipt ${receipt.number} - continued`, 10);
            y = 750;
        }

        commands.push(`0.94 0.94 0.94 rg 36 ${y - 15} 523 17 re f 0 G`);
        addText(46, y - 10, "#", 9, true);
        addText(70, y - 10, "Item & Description", 9, true);
        addRightText(393, y - 10, "Qty", 9, true);
        addRightText(457, y - 10, "Rate", 9, true);
        addRightText(553, y - 10, "Amount", 9, true);
        y -= 22;
    };

    beginPage(false);
    receipt.items.forEach((item, index) => {
        const descriptionLines = wrapReceiptText(item.description, 52);
        const rowHeight = Math.max(17, descriptionLines.length * 11 + 5);
        if (y - rowHeight < 180) {
            pages.push(commands.join("\n"));
            beginPage(true);
        }
        addText(46, y - 7, String(index + 1), 9);
        descriptionLines.forEach((value, lineIndex) => {
            addText(70, y - 7 - lineIndex * 11, value, 9);
        });
        addRightText(393, y - 7, Number(item.quantity).toFixed(2), 9);
        addRightText(457, y - 7, formatReceiptAmount(item.unitPrice), 9);
        addRightText(553, y - 7, formatReceiptAmount(item.total), 9);
        y -= rowHeight;
        addRule(36, y, 559, y, 0.5, 0.66);
    });

    const noteLines = wrapReceiptText(
        receipt.notes || defaultReceiptNotes,
        88
    );
    const summarySpace = 136;
    const notesSpace = 29 + noteLines.length * 11;
    if (y < 36 + summarySpace + notesSpace) {
        pages.push(commands.join("\n"));
        beginPage(true);
    }

    const panelTop = y - 6;
    const panelBottom = panelTop - 72;
    commands.push(
        `0.84 G 0.8 w 46 ${panelBottom} m 354 ${panelBottom} l 359.52 ${panelBottom} 364 ${panelBottom + 4.48} 364 ${panelBottom + 10} c 364 ${panelTop - 10} l 364 ${panelTop - 4.48} 359.52 ${panelTop} 354 ${panelTop} c 46 ${panelTop} l 40.48 ${panelTop} 36 ${panelTop - 4.48} 36 ${panelTop - 10} c 36 ${panelBottom + 10} l 36 ${panelBottom + 4.48} 40.48 ${panelBottom} 46 ${panelBottom} c h S 0 G`
    );
    addText(51, panelTop - 20, "Payment Details", 9, true);
    addText(51, panelTop - 39, "Payment Mode", 9);
    addText(171, panelTop - 39, receipt.paymentMode, 9, true);
    addText(51, panelTop - 58, "Reference", 9);
    addText(171, panelTop - 58, receipt.reference || "-", 9, true);

    const total = Number(receipt.total) || 0;
    const totalsTop = panelTop - 6;
    addRightText(456, totalsTop, "Sub Total", 9);
    addRightText(559, totalsTop, formatReceiptAmount(total), 9);
    addRule(365, totalsTop - 9, 559, totalsTop - 9, 0.6, 0.72);
    addRightText(456, totalsTop - 20, "Total", 9, true);
    addRightText(559, totalsTop - 20, formatReceiptCurrency(total), 9, true);
    addRule(365, totalsTop - 29, 559, totalsTop - 29, 0.8, 0.72);

    let notesY = panelBottom - 24;
    addText(36, notesY, "Notes", 10, true);
    notesY -= 16;
    noteLines.forEach(note => {
        if (notesY < 36) {
            pages.push(commands.join("\n"));
            beginPage(true);
            notesY = 700;
            addText(36, notesY, "Notes (continued)", 10, true);
            notesY -= 16;
        }
        addText(36, notesY, note, 8);
        notesY -= 11;
    });
    pages.push(commands.join("\n"));

    const imageHex = Array.from(
        logo.bytes,
        byte => byte.toString(16).padStart(2, "0")
    ).join("") + ">";
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [PAGE_REFS] /Count PAGE_COUNT >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${imageHex.length} >>\nstream\n${imageHex}\nendstream`
    ];
    const pageRefs = [];
    pages.forEach((content, index) => {
        const pageNumber = 6 + index * 2;
        const contentNumber = pageNumber + 1;
        pageRefs.push(`${pageNumber} 0 R`);
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${contentNumber} 0 R >>`
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
    return new Blob([pdf], { type: "application/pdf" });
}

function receiptFilename(receipt) {
    const safeNumber = safePdfText(receipt.number)
        .replace(/[^A-Za-z0-9_-]/g, "_");
    return `${safeNumber || "sales-receipt"}.pdf`;
}

async function previewReceipt(receipt) {
    try {
        const blob = await createReceiptPdf(receipt);
        if (currentReceiptPdfUrl) {
            URL.revokeObjectURL(currentReceiptPdfUrl);
        }
        currentReceiptPdfUrl = URL.createObjectURL(blob);
        currentPreviewReceiptNumber = receipt.number;
        receiptPdfViewer.src = currentReceiptPdfUrl;
        downloadReceiptPdf.href = currentReceiptPdfUrl;
        downloadReceiptPdf.download = receiptFilename(receipt);
        receiptPreview.hidden = false;
        receiptPreview.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Unable to generate sales receipt PDF preview.", error);
        receiptRegisterMessage.textContent =
            "Sales receipt PDF preview could not be generated. Check that images/5.png is available and try again.";
    }
}

async function downloadReceipt(receipt) {
    try {
        const blob = await createReceiptPdf(receipt);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = receiptFilename(receipt);
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error("Unable to generate sales receipt PDF download.", error);
        receiptRegisterMessage.textContent =
            "Sales receipt PDF could not be generated. Check that images/5.png is available and try again.";
    }
}

async function deleteReceipt(idOrNumber) {
    if (!window.confirm("Delete this sales receipt? This cannot be undone.")) return;
    if (!receiptApiEnabled) {
        const remaining = readReceipts().filter(receipt => receipt.number !== idOrNumber);
        localStorage.setItem(receiptStorageKey, JSON.stringify(remaining));
        renderReceipts(remaining);
        return;
    }
    const receipt = receiptCache.find(item => item.id === idOrNumber || item.number === idOrNumber);
    if (!receipt) return;
    try {
        await window.zymaApi.deleteReceipt(receipt.id);
        await loadReceiptsFromApi();
        window.dispatchEvent(new CustomEvent("zyma:billing-updated"));
        receiptRegisterMessage.textContent = `${receipt.number} was deleted.`;
    } catch (error) {
        receiptRegisterMessage.textContent = error.message || "Sales receipt could not be deleted.";
    }
}

document.getElementById("showReceiptForm").addEventListener("click", () => {
    receiptFormPanel.hidden = false;
    document.getElementById("receiptClient").focus();
    receiptFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("cancelReceiptForm").addEventListener("click", () => {
    receiptForm.reset();
    document.getElementById("receiptNotes").value = defaultReceiptNotes;
    receiptItems.replaceChildren(
        document.getElementById("receiptItemTemplate").content
            .firstElementChild.cloneNode(true)
    );
    receiptItems.querySelectorAll(".invoice-item-row").forEach(bindReceiptItem);
    receiptFormMessage.textContent = "";
    receiptFormPanel.hidden = true;
    setDefaultReceiptDate();
    updateReceiptTotals();
});

document.getElementById("addReceiptItem").addEventListener("click", () => {
    const row = document.getElementById("receiptItemTemplate").content
        .firstElementChild.cloneNode(true);
    receiptItems.append(row);
    bindReceiptItem(row);
});

document.getElementById("receiptSearch").addEventListener("input", filterReceipts);
receiptItems.querySelectorAll(".invoice-item-row").forEach(bindReceiptItem);
setDefaultReceiptDate();

const initialReceipts = readReceipts();
document.getElementById("receiptNumber").value = "SR-1101";
renderReceipts(initialReceipts);
updateReceiptTotals();
updateReceiptNumber().catch(error => {
    console.error("Unable to determine the next billing document number.", error);
    receiptRegisterMessage.textContent =
        error.message || "The next sales receipt number could not be determined.";
});
if (receiptApiEnabled) loadReceiptsFromApi();

receiptForm.addEventListener("submit", async event => {
    event.preventDefault();
    receiptFormMessage.textContent = "";
    if (!receiptForm.checkValidity()) {
        receiptForm.reportValidity();
        return;
    }

    try {
        await updateReceiptNumber();
    } catch (error) {
        console.error("Unable to determine the next billing document number.", error);
        receiptFormMessage.textContent =
            error.message || "The next sales receipt number could not be determined.";
        return;
    }

    const items = getReceiptLines();
    if (!items.length || items.some(item =>
        !item.description ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0 ||
        !Number.isFinite(item.total)
    )) {
        receiptFormMessage.textContent =
            "Add at least one complete line item with a valid quantity and unit price.";
        return;
    }

    const total = roundReceiptCurrency(
        items.reduce((sum, item) => sum + item.total, 0)
    );
    const receipts = readReceipts();
    const receipt = {
        number: document.getElementById("receiptNumber").value.trim(),
        client: document.getElementById("receiptClient").value.trim(),
        date: document.getElementById("receiptDate").value,
        reference: document.getElementById("receiptReference").value.trim(),
        paymentMode: document.getElementById("receiptPaymentMode").value,
        notes: document.getElementById("receiptNotes").value.trim(),
        items,
        total,
        createdAt: new Date().toISOString()
    };

    if (receipts.some(saved => saved.number === receipt.number)) {
        receiptFormMessage.textContent = "That sales receipt number already exists.";
        return;
    }
    try {
        if (receiptApiEnabled) {
            const saved = normalizeReceipt(await window.zymaApi.createReceipt(receiptToApiPayload(receipt)));
            receiptCache.unshift(saved);
            renderReceipts(receiptCache);
            receiptRegisterMessage.textContent = `${saved.number} created and shared with staff.`;
            window.dispatchEvent(new CustomEvent("zyma:billing-updated"));
        } else {
            receipts.push(receipt);
            localStorage.setItem(receiptStorageKey, JSON.stringify(receipts));
            renderReceipts(receipts);
            receiptRegisterMessage.textContent = `${receipt.number} created.`;
        }
    } catch (error) {
        receiptFormMessage.textContent = error.message || "Sales receipt could not be saved.";
        return;
    }

    try {
        await updateReceiptNumber();
    } catch (error) {
        console.error("Sales receipt was saved but the next number could not be loaded.", error);
        receiptRegisterMessage.textContent =
            `${receipt.number} was created, but the next sales receipt number could not be loaded.`;
    }

    receiptFormPanel.hidden = true;
    receiptForm.reset();
    document.getElementById("receiptNotes").value = defaultReceiptNotes;
    receiptItems.replaceChildren(
        document.getElementById("receiptItemTemplate").content
            .firstElementChild.cloneNode(true)
    );
    receiptItems.querySelectorAll(".invoice-item-row").forEach(bindReceiptItem);
    setDefaultReceiptDate();
    updateReceiptTotals();
});

if (receiptApiEnabled) {
    window.addEventListener("pageshow", () => loadReceiptsFromApi());
    window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") loadReceiptsFromApi();
    });
}
