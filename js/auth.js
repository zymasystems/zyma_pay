/**
 * Zyma Pay authentication.
 *
 * Authentication uses a Secure, HttpOnly cookie. Passwords and reset tokens
 * are kept only in memory and are never written to browser storage.
 */
function authApiEnabled() {
    return Boolean(
        window.ZYMA_PAY_CONFIG?.API_ENABLED &&
        window.zymaApi?.isEnabled()
    );
}

function setMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", isError);
}

async function handleApiLogin(email, password) {
    const submitButton = document.querySelector("#loginForm button[type='submit']");
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Signing in…";
    }

    try {
        await window.zymaApi.login(email, password);
        window.location.href = "dashboard.html";
    } catch (error) {
        if (error.status === 403 &&
            error.payload?.code === "PASSWORD_CHANGE_REQUIRED") {
            const params = new URLSearchParams({
                email: error.payload.email || email,
                mode: "first-login"
            });
            window.location.href = `reset-password.html?${params.toString()}`;
            return;
        }

        setMessage(
            "loginMessage",
            error.status === 401
                ? "The email address or password is incorrect."
                : error.message || "Sign-in failed. Please try again.",
            true
        );

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Sign in";
        }
    }
}

function setupLoginForm() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!authApiEnabled()) {
            setMessage("loginMessage", "Unable to connect to the staff authentication service. Please try again.", true);
            return;
        }

        await handleApiLogin(email, password);
    });
}

function setupForgotPassword() {
    const link = document.getElementById("forgotPasswordLink");
    const loginForm = document.getElementById("loginForm");
    const forgotPanel = document.getElementById("forgotPasswordPanel");
    const back = document.getElementById("backToLogin");
    const email = document.getElementById("loginEmail");
    const forgotEmail = document.getElementById("forgotEmail");
    const form = document.getElementById("forgotPasswordForm");

    if (!link || !loginForm || !forgotPanel || !form) return;

    function showForgot() {
        loginForm.hidden = true;
        forgotPanel.hidden = false;
        setMessage("forgotMessage", "");
        if (forgotEmail && email?.value.trim()) forgotEmail.value = email.value.trim();
        forgotEmail?.focus();
    }

    function showLogin() {
        forgotPanel.hidden = true;
        loginForm.hidden = false;
        document.getElementById("loginEmail")?.focus();
    }

    link.addEventListener("click", event => {
        event.preventDefault();
        showForgot();
    });

    back?.addEventListener("click", showLogin);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!authApiEnabled()) {
            setMessage("forgotMessage", "Unable to connect to the password recovery service. Please try again.", true);
            return;
        }

        const button = form.querySelector("button[type='submit']");
        const value = forgotEmail.value.trim();

        button.disabled = true;
        button.textContent = "Sending…";

        try {
            const result = await window.zymaApi.forgotPassword(value);
            setMessage(
                "forgotMessage",
                result?.message ||
                "If an active Zyma Pay account exists for that email address, a password reset link has been sent."
            );
            form.reset();
        } catch (error) {
            setMessage("forgotMessage", error.message || "Unable to request a password reset.", true);
        } finally {
            button.disabled = false;
            button.textContent = "Send reset link";
        }
    });
}

setupLoginForm();
setupForgotPassword();

if (authApiEnabled()) {
    window.zymaApi.getCurrentUser().catch(error => {
        if (error.status !== 401) {
            console.warn("Unable to verify the current staff session.", error);
        }
    });
}

window.addEventListener("zyma:unauthorized", () => {
    if (window.location.pathname.endsWith("index.html") ||
        window.location.pathname === "/") {
        return;
    }
    window.location.href = "index.html";
});
