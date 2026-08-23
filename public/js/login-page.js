// =============================================================
// LÓGICA DE LA PÁGINA DE LOGIN
// Depende de las funciones definidas en auth.js (cargado antes).
// =============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Si ya hay sesión activa, no tiene sentido mostrar el login.
    const existing = await authGetSession();
    if (existing && existing.user) {
        window.location.href = 'cd.html';
        return;
    }

    const tabSignIn = document.getElementById('tab-signin');
    const tabSignUp = document.getElementById('tab-signup');
    const formSignIn = document.getElementById('form-signin');
    const formSignUp = document.getElementById('form-signup');
    const errorEl = document.getElementById('auth-error');

    function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    function clearError() {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    function setActiveTab(tab) {
        clearError();
        const isSignIn = tab === 'signin';

        formSignIn.classList.toggle('hidden', !isSignIn);
        formSignUp.classList.toggle('hidden', isSignIn);

        tabSignIn.classList.toggle('text-blue-600', isSignIn);
        tabSignIn.classList.toggle('border-blue-600', isSignIn);
        tabSignIn.classList.toggle('text-gray-400', !isSignIn);
        tabSignIn.classList.toggle('border-transparent', !isSignIn);

        tabSignUp.classList.toggle('text-blue-600', !isSignIn);
        tabSignUp.classList.toggle('border-blue-600', !isSignIn);
        tabSignUp.classList.toggle('text-gray-400', isSignIn);
        tabSignUp.classList.toggle('border-transparent', isSignIn);
    }

    tabSignIn.addEventListener('click', () => setActiveTab('signin'));
    tabSignUp.addEventListener('click', () => setActiveTab('signup'));

    formSignIn.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();
        const submitBtn = formSignIn.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            await authSignInEmail({
                email: document.getElementById('signin-email').value.trim(),
                password: document.getElementById('signin-password').value,
            });
            window.location.href = 'cd.html';
        } catch (err) {
            showError(err.message);
            submitBtn.disabled = false;
        }
    });

    formSignUp.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();
        const submitBtn = formSignUp.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            await authSignUpEmail({
                name: document.getElementById('signup-name').value.trim(),
                email: document.getElementById('signup-email').value.trim(),
                password: document.getElementById('signup-password').value,
            });
            window.location.href = 'cd.html';
        } catch (err) {
            showError(err.message);
            submitBtn.disabled = false;
        }
    });
});
