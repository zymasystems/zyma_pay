(function () {
    const organisationForm = document.getElementById("organisationForm");
    const rulesForm = document.getElementById("paymentRulesForm");
    const organisationMessage = document.getElementById("organisationMessage");
    const rulesMessage = document.getElementById("rulesMessage");
    const methodList = document.getElementById("paymentMethodList");

    const setMessage = (el, text, error = false) => { if (!el) return; el.textContent = text; el.classList.toggle("error", error); };
    const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

    function fill(settings) {
        const org = settings?.organisation || settings?.organization || settings || {};
        document.getElementById("organisationName").value = org.name || "";
        document.getElementById("organisationEmail").value = org.email || "";
        document.getElementById("organisationPhone").value = org.phone || "";
        document.getElementById("organisationWebsite").value = org.website || "";
        document.getElementById("organisationAddress").value = org.address || "";
        const rules = settings?.paymentRules || {};
        document.getElementById("defaultPaymentStatus").value = rules.defaultPaymentStatus || "awaiting_reflection";
        document.getElementById("requireProof").checked = Boolean(rules.requireProofOfPayment);
        document.getElementById("auditEnabled").checked = rules.auditEnabled !== false;
    }

    async function load() {
        if (!window.zymaSession?.apiEnabled) return;
        try { fill(await window.zymaApi.getSettings()); } catch (error) { console.warn("Unable to load settings.", error); }
        try {
            const methods = await window.zymaApi.listPaymentMethods();
            if (Array.isArray(methods) && methods.length) methodList.innerHTML = methods.map(method => `<div class="settings-list-row"><div><strong>${escapeHtml(method.name)}</strong><span>${escapeHtml(method.description || "")}</span></div><span class="status-badge">Active</span></div>`).join("");
        } catch (error) { console.warn("Unable to load payment methods.", error); }
    }

    organisationForm?.addEventListener("submit", async event => {
        event.preventDefault(); if (!organisationForm.checkValidity()) { organisationForm.reportValidity(); return; }
        if (!window.zymaSession?.apiEnabled) { setMessage(organisationMessage, "Settings are waiting for the backend to be connected.", true); return; }
        try { await window.zymaApi.updateSettings({ organisation: { name: document.getElementById("organisationName").value.trim(), email: document.getElementById("organisationEmail").value.trim(), phone: document.getElementById("organisationPhone").value.trim(), website: document.getElementById("organisationWebsite").value.trim(), address: document.getElementById("organisationAddress").value.trim() } }); setMessage(organisationMessage, "Organisation settings saved."); }
        catch (error) { setMessage(organisationMessage, error.message || "Unable to save settings.", true); }
    });

    rulesForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!window.zymaSession?.apiEnabled) { setMessage(rulesMessage, "Settings are waiting for the backend to be connected.", true); return; }
        try { await window.zymaApi.updateSettings({ paymentRules: { defaultPaymentStatus: document.getElementById("defaultPaymentStatus").value, requireProofOfPayment: document.getElementById("requireProof").checked, auditEnabled: document.getElementById("auditEnabled").checked } }); setMessage(rulesMessage, "Payment rules saved."); }
        catch (error) { setMessage(rulesMessage, error.message || "Unable to save rules.", true); }
    });

    document.getElementById("addPaymentMethod")?.addEventListener("click", async () => {
        const name = window.prompt("Payment method name");
        if (!name) return;
        if (!window.zymaSession?.apiEnabled) { alert("Payment method management is waiting for the backend."); return; }
        try { await window.zymaApi.createPaymentMethod({ name: name.trim() }); await load(); } catch (error) { alert(error.message || "Unable to add payment method."); }
    });

    load();
})();
