(function () {
    const list = document.getElementById("activityList");
    const search = document.getElementById("activitySearch");
    const type = document.getElementById("activityType");
    let events = [];

    function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
    function render() {
        if (!list || !events.length) return;
        const q = (search?.value || "").trim().toLowerCase();
        const t = type?.value || "";
        const filtered = events.filter(item => {
            const haystack = JSON.stringify(item).toLowerCase();
            return (!q || haystack.includes(q)) && (!t || item.category === t);
        });
        if (!filtered.length) { list.innerHTML = '<div class="empty-state"><strong>No matching activity</strong><p>Try another search or activity category.</p></div>'; return; }
        list.innerHTML = filtered.map(item => `
            <article class="activity-row">
                <span>${escapeHtml(item.createdAt || item.timestamp || "—")}</span>
                <strong>${escapeHtml(item.event || item.action || "Activity")}</strong>
                <span>${escapeHtml(item.description || item.message || "—")}</span>
                <span>${escapeHtml(item.actorName || item.actor || "System")}</span>
                <span class="status-badge">${escapeHtml(item.status || "recorded")}</span>
            </article>`).join("");
    }

    async function load() {
        if (!window.zymaSession?.apiEnabled) return;
        try { events = await window.zymaApi.listActivity({ limit: 100 }); render(); }
        catch (error) { console.warn("Unable to load activity.", error); }
    }
    search?.addEventListener("input", render); type?.addEventListener("change", render); load();
})();
