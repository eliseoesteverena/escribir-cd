// =============================================================
// ESTADO DE SESIÓN EN EL HEADER
// =============================================================
// Depende de las funciones definidas en auth.js (cargado antes que este
// archivo, mismo scope global de script clásico).
async function initAuthHeaderState() {
    const desktopSlot = document.getElementById('nav-auth-desktop');
    const mobileSlot = document.getElementById('nav-auth-mobile');
    if (!desktopSlot && !mobileSlot) return;

    const data = await authGetSession();
    const isLoggedIn = Boolean(data && data.user);

    if (isLoggedIn) {
        const displayName = data.user.name || data.user.email || 'Mi cuenta';

        if (desktopSlot) {
            desktopSlot.innerHTML = `
                <span class="text-gray-500 mr-2">${displayName}</span>
                <button type="button" id="nav-signout-desktop" class="hover:text-blue-600 transition-colors">Cerrar sesión</button>
            `;
            document.getElementById('nav-signout-desktop')?.addEventListener('click', authSignOut);
        }
        if (mobileSlot) {
            mobileSlot.innerHTML = `
                <div class="px-3 py-1 text-sm text-gray-500">${displayName}</div>
                <button type="button" id="nav-signout-mobile" class="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors">
                    Cerrar sesión
                </button>
            `;
            document.getElementById('nav-signout-mobile')?.addEventListener('click', authSignOut);
        }
    }
    // Si no hay sesión, se deja el link "Iniciar sesión" que ya está en el HTML.
}

document.addEventListener('DOMContentLoaded', initAuthHeaderState);

// =============================================================
// LÓGICA DEL MENÚ HAMBURGUESA
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnMobile = document.getElementById('btn-mobile-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconHamburger = document.getElementById('icon-hamburger');
    const iconClose = document.getElementById('icon-close');

    if (btnMobile && mobileMenu) {
        btnMobile.addEventListener('click', () => {
            const isHidden = mobileMenu.classList.toggle('hidden')// && mobileMenu.classList.toggle('absolute');
            
            // Alternar íconos entre 3 líneas y la 'X'
            if (iconHamburger && iconClose) {
                iconHamburger.classList.toggle('hidden', !isHidden);
                iconClose.classList.toggle('hidden', isHidden);
            }
        });

        // Cerrar el menú automáticamente al hacer clic en cualquier enlace
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
               // mobileMenu.classList.add('absolute');
                if (iconHamburger && iconClose) {
                    iconHamburger.classList.remove('hidden');
                    iconClose.classList.add('hidden');
                }
            });
        });
    }
});

// corrección scroll

window.scrollTo(0, 0);