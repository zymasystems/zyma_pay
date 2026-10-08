/**
 * Zyma Pay authentication.
 *
 * Production mode:
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 *
 * The backend should issue a Secure, HttpOnly authentication cookie.
 * No password or bearer token is stored in browser storage.
 */
function authApiEnabled() {
    return Boolean(
        window.ZYMA_PAY_CONFIG?.API_ENABLED &&
        window.zymaApi?.isEnabled()
    );
}

function setLoginMessage(message, isError = false) {
    const element = document.getElementById("loginMessage");
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
        console.error("Zyma Pay sign-in failed.", error);
        setLoginMessage(
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

function setupAuthForm(formId, messageId) {
    const form = document.getElementById(formId);
    const message = document.getElementById(messageId);

    if (!form || !message) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!authApiEnabled()) {
            message.textContent =
                "Unable to connect to the staff authentication service. Please refresh and try again.";
            message.classList.remove("error");
            return;
        }

        await handleApiLogin(email, password);
    });
}

setupAuthForm("loginForm", "loginMessage");

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
