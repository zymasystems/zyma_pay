(function () {
    const panel = document.getElementById("invitePanel");
    const form = document.getElementById("inviteForm");
    const message = document.getElementById("inviteMessage");
    const list = document.getElementById("staffList");
    let staff = [];

    const showPanel = show => { if (panel) panel.hidden = !show; };
    const setMessage = (text, error = false) => {
        if (!message) return;
        message.textContent = text;
        message.classList.toggle("error", error);
    };
    const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => (
        {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]
    ));

    function normalizeRole(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "_");
    }

    function formatRole(value) {
        const role = normalizeRole(value);
        const labels = {
            super_admin: "Super Admin",
            administrator: "Administrator",
            finance: "Finance",
            staff: "Staff",
            viewer: "Viewer"
        };
        return labels[role] || String(value || "Staff");
    }

    function formatDate(value) {
        if (!value) return "Never";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat("en-ZA", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function render() {
        if (!list) return;

        const q = (document.getElementById("staffSearch")?.value || "").toLowerCase().trim();
        const role = normalizeRole(document.getElementById("staffRoleFilter")?.value || "");

        const filtered = staff.filter(member => {
            const searchable = [
                member.fullName,
                member.name,
                member.email,
                member.department,
                member.role,
                member.status
            ].filter(Boolean).join(" ").toLowerCase();

            return (!q || searchable.includes(q)) &&
                (!role || normalizeRole(member.role) === role);
        });

        if (!filtered.length) {
            list.innerHTML = '<div class="empty-state"><strong>No matching staff</strong><p>Try another search or role.</p></div>';
            return;
        }

        list.innerHTML = filtered.map(member => {
            const name = member.fullName || member.name || member.email || "Staff Member";
            const department = member.department || "—";
            const memberRole = normalizeRole(member.role);
            const status = String(member.status || "active").toUpperCase();
            const passwordStatus = member.mustChangePassword ? " · Password change required" : "";

            return `
                <article class="staff-row">
                    <div>
                        <strong>${escapeHtml(name)}</strong>
                        <span>${escapeHtml(member.email || "")}</span>
                    </div>
                    <span class="role-badge">${escapeHtml(formatRole(memberRole))}</span>
                    <span>${escapeHtml(department)}</span>
                    <span class="status-badge">${escapeHtml(status)}${escapeHtml(passwordStatus)}</span>
                    <span>${escapeHtml(formatDate(member.lastLoginAt || member.lastAccess))}</span>
                    <div>
                        <button class="text-button" data-staff-id="${escapeHtml(member.id)}" type="button">Manage</button>
                    </div>
                </article>
            `;
        }).join("");
    }

    async function load() {
        if (!window.zymaSession?.apiEnabled) return;

        try {
            const result = await window.zymaApi.listStaff();
            staff = Array.isArray(result) ? result : (result?.items || []);
            render();
        } catch (error) {
            console.warn("Unable to load staff directory.", error);
        }
    }

    [document.getElementById("inviteStaffButton"), document.getElementById("emptyInviteStaff")]
        .forEach(button => button?.addEventListener("click", () => {
            showPanel(true);
            setMessage("");
            document.getElementById("staffName")?.focus();
        }));

    document.getElementById("cancelInvite")?.addEventListener("click", () => {
        showPanel(false);
        setMessage("");
    });

    document.getElementById("staffSearch")?.addEventListener("input", render);
    document.getElementById("staffRoleFilter")?.addEventListener("change", render);

    form?.addEventListener("submit", async event => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!window.zymaSession?.apiEnabled) {
            setMessage("Staff invitations are waiting for the backend and Super Admin authentication.", true);
            return;
        }

        const button = form.querySelector("button[type='submit']");
        if (button) {
            button.disabled = true;
            button.textContent = "Sending invitation…";
        }

        // IMPORTANT: the backend contract expects fullName, not name.
        // Role is sent as the human-readable string expected by the API.
        const payload = {
            fullName: document.getElementById("staffName").value.trim(),
            email: document.getElementById("staffEmail").value.trim(),
            role: document.getElementById("staffRole").value,
            department: document.getElementById("staffDepartment").value.trim() || null
        };

        try {
            await window.zymaApi.inviteStaff(payload);

            setMessage(
                `Staff account created successfully. An invitation email has been sent to ${payload.email}.`,
                false
            );

            form.reset();
            await load();
        } catch (error) {
            console.error("Unable to send staff invitation.", error);

            const details = error.payload?.errors;
            let messageText = error.message || "Unable to send invitation.";

            if (details && typeof details === "object") {
                const validationMessages = Object.values(details)
                    .flat()
                    .filter(Boolean);

                if (validationMessages.length) {
                    messageText = validationMessages.join(" ");
                }
            }

            setMessage(messageText, true);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Send invitation";
            }
        }
    });

    load();
})();
