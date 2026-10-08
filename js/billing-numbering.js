(() => {
    const firstSequence = 1101;
    const invoiceStorageKey = "zymaInvoices";
    const receiptStorageKey = "zymaSalesReceipts";

    function recordsFromStorage(key) {
        const stored = localStorage.getItem(key);
        if (!stored) return [];

        const records = JSON.parse(stored);
        if (!Array.isArray(records)) {
            throw new Error(`Saved billing data in ${key} is not a list.`);
        }
        return records;
    }

    function unwrapRecords(response) {
        const records = Array.isArray(response) ? response : response?.items;
        if (!Array.isArray(records)) {
            throw new Error("The billing records response is not a list.");
        }
        return records;
    }

    async function next(prefix) {
        let invoices;
        let receipts;
        const apiEnabled = Boolean(
            window.ZYMA_PAY_CONFIG?.API_ENABLED &&
            window.zymaApi?.isEnabled()
        );

        if (apiEnabled) {
            const [invoiceResponse, receiptResponse] = await Promise.all([
                window.zymaApi.listInvoices(),
                window.zymaApi.listReceipts()
            ]);
            invoices = unwrapRecords(invoiceResponse);
            receipts = unwrapRecords(receiptResponse);
        } else {
            invoices = recordsFromStorage(invoiceStorageKey);
            receipts = recordsFromStorage(receiptStorageKey);
        }

        const highestSequence = [...invoices, ...receipts].reduce(
            (highest, record) => {
                const number =
                    record.invoiceNumber ??
                    record.receiptNumber ??
                    record.number ??
                    "";
                const match = /^(?:INV|SR)-(\d+)$/.exec(String(number).trim());
                return match
                    ? Math.max(highest, Number(match[1]))
                    : highest;
            },
            firstSequence - 1
        );

        return `${prefix}-${highestSequence + 1}`;
    }

    window.zymaBillingNumbering = { next };
})();
