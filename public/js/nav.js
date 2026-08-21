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