(function () {
    const panel = document.getElementById("invitePanel");
    const form = document.getElementById("inviteForm");
    const message = document.getElementById("inviteMessage");
    const list = document.getElementById("staffList");
    let staff = [];

    const showPanel = show => { if (panel) panel.hidden = !show; };
    const setMessage = (text, error = false) => { if (!message) return; message.textContent = text; message.classList.toggle("error", error); };
    const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

    function render() {
        if (!list || !staff.length) return;
        const q = (document.getElementById("staffSearch")?.value || "").toLowerCase().trim();
        const role = document.getElementById("staffRoleFilter")?.value || "";
        const filtered = staff.filter(member => (!q || JSON.stringify(member).toLowerCase().includes(q)) && (!role || member.role === role));
        if (!filtered.length) { list.innerHTML = '<div class="empty-state"><strong>No matching staff</strong><p>Try another search or role.</p></div>'; return; }
        list.innerHTML = filtered.map(member => `<article class="staff-row"><div><strong>${escapeHtml(member.name || member.email)}</strong><span>${escapeHtml(member.email || "")}</span></div><span class="role-badge">${escapeHtml(member.role || "staff").replace(/_/g," ")}</span><span class="status-badge">${escapeHtml(member.status || "active")}</span><span>${escapeHtml(member.lastAccess || "Never")}</span><div><button class="text-button" data-staff-id="${escapeHtml(member.id)}">Manage</button></div></article>`).join("");
    }

    async function load() {
        if (!window.zymaSession?.apiEnabled) return;
        try { const result = await window.zymaApi.listStaff(); staff = Array.isArray(result) ? result : (result?.items || []); render(); } catch (error) { console.warn("Unable to load staff directory.", error); }
    }

    [document.getElementById("inviteStaffButton"), document.getElementById("emptyInviteStaff")].forEach(button => button?.addEventListener("click", () => { showPanel(true); setMessage(""); }));
    document.getElementById("cancelInvite")?.addEventListener("click", () => showPanel(false));
    document.getElementById("staffSearch")?.addEventListener("input", render);
    document.getElementById("staffRoleFilter")?.addEventListener("change", render);

    form?.addEventListener("submit", async event => {
        event.preventDefault(); if (!form.checkValidity()) { form.reportValidity(); return; }
        if (!window.zymaSession?.apiEnabled) { setMessage("Staff invitations are waiting for the backend and Super Admin authentication.", true); return; }
        const button = form.querySelector("button[type='submit']"); button.disabled = true;
        try { await window.zymaApi.inviteStaff({ name: document.getElementById("staffName").value.trim(), email: document.getElementById("staffEmail").value.trim(), role: document.getElementById("staffRole").value, department: document.getElementById("staffDepartment").value.trim() }); form.reset(); showPanel(false); await load(); }
        catch (error) { setMessage(error.message || "Unable to send invitation.", true); }
        finally { button.disabled = false; }
    });

    load();
})();
