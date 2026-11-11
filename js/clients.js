(() => {
    "use strict";
    const apiEnabled = Boolean(window.ZYMA_PAY_CONFIG?.API_ENABLED && window.zymaApi?.isEnabled());
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    async function loadClients(search = "") {
        if (!apiEnabled) throw new Error("The Zyma Pay API is not available.");
        const response = await window.zymaApi.listClients(search ? {search} : {});
        return Array.isArray(response) ? response : response?.items || [];
    }
    function fillClientSelect(select, clients) {
        select.replaceChildren(new Option(clients.length ? "Choose a client from Zyma CRM" : "No active CRM clients found", ""));
        clients.forEach(client => {
            const option = new Option(client.email ? `${client.companyName} · ${client.email}` : client.companyName, client.id);
            option.dataset.email = client.email || ""; option.dataset.name = client.companyName || "";
            option.disabled = !client.email; select.append(option);
        });
    }
    function bindClientSelector(selectId, nameId, emailId) {
        const select = document.getElementById(selectId), name = document.getElementById(nameId), email = document.getElementById(emailId);
        if (!select || !name || !email) return;
        select.addEventListener("change", () => { const option=select.selectedOptions[0]; name.value=option?.dataset.name||""; email.value=option?.dataset.email||""; });
        loadClients().then(clients => fillClientSelect(select,clients)).catch(error => { select.replaceChildren(new Option("Unable to load CRM clients","")); const note=select.closest(".crm-client-field")?.querySelector("small"); if(note) note.textContent=error.message||"Could not load clients from Zyma CRM."; });
    }
    function renderDirectory(list) {
        const container=document.getElementById("clientDirectoryRows"), count=document.getElementById("clientDirectoryCount"), status=document.getElementById("clientDirectoryMessage");
        if(!container) return; count.textContent=String(list.length); container.replaceChildren();
        if(!list.length){const empty=document.createElement("div");empty.className="client-directory-empty";empty.innerHTML="<strong>No active clients found</strong><span>Clients added or updated in Zyma CRM will appear here automatically.</span>";container.append(empty);return;}
        list.forEach(client=>{const row=document.createElement("article");row.className="client-directory-row";const initials=String(client.companyName||"C").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();row.innerHTML=`<span class="client-directory-avatar">${escapeHtml(initials)}</span><span class="client-directory-main"><strong>${escapeHtml(client.companyName)}</strong><small>${escapeHtml(client.contactPerson||"Contact not provided")}</small></span><span class="client-directory-contact"><strong>${escapeHtml(client.email||"No email provided")}</strong><small>${escapeHtml(client.phone||client.industry||"")}</small></span><span class="client-directory-status">Active</span>`;container.append(row);});
        if(status)status.textContent=`Showing ${list.length} active CRM-synchronized client${list.length===1?"":"s"}.`;
    }
    function initDirectory(){const search=document.getElementById("clientDirectorySearch"),refresh=document.getElementById("refreshClientDirectory"),status=document.getElementById("clientDirectoryMessage");const run=async()=>{if(status)status.textContent="Refreshing client directory…";try{renderDirectory(await loadClients(search?.value.trim()||""));}catch(error){if(status)status.textContent=error.message||"Unable to load the client directory.";}};search?.addEventListener("input",()=>{clearTimeout(search._zymaTimer);search._zymaTimer=setTimeout(run,250);});refresh?.addEventListener("click",run);run();}
    bindClientSelector("invoiceClientSelect","invoiceClient","invoiceEmail");
    bindClientSelector("receiptClientSelect","receiptClient","receiptEmail");
    bindClientSelector("paymentClientSelect","clientName","clientEmail");
    if(document.getElementById("clientDirectoryRows"))initDirectory();
})();
