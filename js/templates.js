(function () {
    const editor = document.getElementById("templateEditor");
    const form = document.getElementById("templateForm");
    const message = document.getElementById("templateMessage");
    const list = document.getElementById("templateList");

    function showEditor(show = true) { if (editor) editor.hidden = !show; }
    function setMessage(text, error = false) { if (!message) return; message.textContent = text; message.classList.toggle("error", error); }

    function render(templates) {
        if (!list) return;
        if (!Array.isArray(templates) || !templates.length) return;
        list.innerHTML = templates.map(template => `
            <article class="settings-list-row">
                <div><strong>${escapeHtml(template.name || template.key || "Template")}</strong><span>${escapeHtml(template.subject || "No subject configured")}</span></div>
                <span class="status-badge">${escapeHtml(template.status || "configured")}</span>
            </article>`).join("");
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }

    async function loadTemplates() {
        if (!window.zymaSession?.apiEnabled) return;
        try { render(await window.zymaApi.listEmailTemplates()); }
        catch (error) { console.warn("Unable to load email templates.", error); }
    }

    [document.getElementById("newTemplateButton"), document.getElementById("emptyNewTemplate")].forEach(button => {
        if (button) button.addEventListener("click", () => { showEditor(true); setMessage(""); });
    });
    document.getElementById("cancelTemplate")?.addEventListener("click", () => showEditor(false));

    form?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (!window.zymaSession?.apiEnabled) { setMessage("Template saving is waiting for the backend to be connected.", true); return; }
        const button = form.querySelector("button[type='submit']");
        button.disabled = true;
        try {
            await window.zymaApi.createEmailTemplate({
                name: document.getElementById("templateName").value.trim(),
                key: document.getElementById("templateKey").value.trim(),
                status: document.getElementById("templateStatus").value,
                subject: document.getElementById("templateSubject").value.trim(),
                html: document.getElementById("templateHtml").value
            });
            form.reset(); showEditor(false); await loadTemplates();
        } catch (error) { setMessage(error.message || "Unable to save template.", true); }
        finally { button.disabled = false; }
    });

    loadTemplates();
})();
