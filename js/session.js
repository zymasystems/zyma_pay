(function () {
    const config = window.ZYMA_PAY_CONFIG || {};
    const apiEnabled = Boolean(config.API_ENABLED && window.zymaApi?.isEnabled());

    function initials(name) {
        const parts = String(name || "Staff Member").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "--";
        return parts.slice(0, 2).map(part => part[0].toUpperCase()).join("");
    }

    function getTimeGreeting(date = new Date()) {
        const hour = date.getHours();
        if (hour >= 5 && hour < 12) return "Good morning";
        if (hour >= 12 && hour < 17) return "Good afternoon";
        return "Good evening";
    }

    function firstName(fullName) {
        const cleaned = String(fullName || "").trim();
        if (!cleaned || cleaned.includes("@")) return "there";
        return cleaned.split(/\s+/)[0];
    }

    function updateDashboardGreeting(userName) {
        const heading = document.getElementById("dashboardGreeting");
        if (!heading) return;
        heading.textContent = `${getTimeGreeting()} ${firstName(userName)}.`;
    }

    // Render a time-appropriate greeting immediately, then personalize it once
    // the authenticated user profile has loaded.
    updateDashboardGreeting("");

    function applyUser(user) {
        if (!user) return;
        const name = user.name || user.fullName || user.email || "Staff Member";
        updateDashboardGreeting(name);
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
    if (logout) {
        logout.addEventListener("click", async () => {
            if (logout.disabled) return;
            logout.disabled = true;
            logout.setAttribute("aria-busy", "true");

            try {
                if (apiEnabled) {
                    await window.zymaApi.logout();
                }
            } catch (error) {
                // A 401 means the session is already gone. Either way,
                // the correct client state after clicking Log out is signed out.
                if (error.status !== 401) {
                    console.warn("Logout request failed.", error);
                }
            } finally {
                window.location.replace("index.html");
            }
        });
    }

    loadSession();
    window.zymaSession = { applyUser, loadSession, apiEnabled };
})();
