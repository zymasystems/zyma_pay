(function () {
    const config = window.ZYMA_PAY_CONFIG || {};
    const apiEnabled = Boolean(config.API_ENABLED && window.zymaApi?.isEnabled());

    function initials(name) {
        const parts = String(name || "Staff Member").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "--";
        return parts.slice(0, 2).map(part => part[0].toUpperCase()).join("");
    }

    function applyUser(user) {
        if (!user) return;
        const name = user.name || user.fullName || user.email || "Staff Member";
        const role = user.roleName || user.role || "Staff";
        const avatar = document.getElementById("userAvatar");
        const nameElement = document.getElementById("userName");
        const roleElement = document.getElementById("userRole");
        if (avatar) avatar.textContent = initials(name);
        if (nameElement) nameElement.textContent = name;
        if (roleElement) roleElement.textContent = String(role).replace(/_/g, " ");
        const normalizedRole = String(role).toLowerCase().replace(/[- ]/g, "_");
        if (normalizedRole !== "super_admin") {
            document.querySelectorAll("[data-super-admin-only]").forEach(element => {
                element.hidden = true;
            });
        }
    }

    async function loadSession() {
        if (!apiEnabled) return;
        try {
            const user = await window.zymaApi.getCurrentUser();
            applyUser(user);
            const status = document.getElementById("systemStatusText");
            if (status) status.textContent = "Backend connected";
        } catch (error) {
            if (error.status === 401) return;
            console.warn("Unable to load Zyma Pay session.", error);
        }
    }

    const logout = document.getElementById("logoutButton");
    if (logout && apiEnabled) {
        logout.addEventListener("click", async () => {
            logout.disabled = true;
            try {
                await window.zymaApi.logout();
            } catch (error) {
                console.warn("Logout request failed.", error);
            } finally {
                window.location.href = "index.html";
            }
        });
    }

    loadSession();
    window.zymaSession = { applyUser, loadSession, apiEnabled };
})();
