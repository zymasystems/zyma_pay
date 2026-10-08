(() => {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const email = (params.get("email") || "").trim();
    const token = params.get("token") || "";
    const mode = params.get("mode") === "first-login" ? "first-login" : "reset";

    const form = document.getElementById("resetPasswordForm");
    const password = document.getElementById("newPassword");
    const confirm = document.getElementById("confirmPassword");
    const button = document.getElementById("resetSubmit");

    function message(text, error = false) {
        const element = document.getElementById("resetMessage");
        if (!element) return;
        element.textContent = text;
        element.classList.toggle("error", error);
    }

    if (mode === "reset") {
        document.getElementById("resetEyebrow").textContent = "ACCOUNT RECOVERY";
        document.getElementById("resetTitle").textContent = "Reset your password";
        document.getElementById("resetDescription").textContent =
            "Choose a new private password for your Zyma Pay staff account.";
        button.textContent = "Reset password";
    }

    // Keep the token only in this JavaScript execution context. Remove it from
    // the visible URL so it is not unnecessarily copied from browser history.
    if (window.history?.replaceState) {
        window.history.replaceState({}, document.title, "reset-password.html");
    }

    function validatePassword(value) {
        if (value.length < 12) return "Password must contain at least 12 characters.";
        if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter.";
        if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter.";
        if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
        if (!/[^A-Za-z0-9]/.test(value)) return "Password must contain at least one special character.";
        return "";
    }

    if (!email || !token) {
        message("This password link is incomplete or invalid. Request a new link from the sign-in page.", true);
        form.querySelectorAll("input, button").forEach(element => element.disabled = true);
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const passwordError = validatePassword(password.value);
        if (passwordError) {
            message(passwordError, true);
            password.focus();
            return;
        }

        if (password.value !== confirm.value) {
            message("The passwords do not match.", true);
            confirm.focus();
            return;
        }

        if (!window.ZYMA_PAY_CONFIG?.API_ENABLED || !window.zymaApi?.isEnabled()) {
            message("Unable to connect to the password service. Please try again.", true);
            return;
        }

        button.disabled = true;
        button.textContent = mode === "first-login" ? "Creating password…" : "Resetting password…";
        message("");

        try {
            const result = mode === "first-login"
                ? await window.zymaApi.firstPassword(email, token, password.value)
                : await window.zymaApi.resetPassword(email, token, password.value);

            message(result?.message || "Your password has been set successfully.");

            form.querySelectorAll("input, button").forEach(element => element.disabled = true);

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1400);
        } catch (error) {
            message(
                error.status === 400
                    ? (error.message || "This password link is invalid, expired, or has already been used.")
                    : (error.message || "Unable to set your password. Please request a new link."),
                true
            );
            button.disabled = false;
            button.textContent = mode === "first-login" ? "Create password" : "Reset password";
        }
    });
})();
