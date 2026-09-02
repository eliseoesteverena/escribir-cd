// =============================================================
// LÓGICA DE LA PÁGINA "MIS CARTAS"
// Depende de auth.js (sesión) y letters.js (apiListLetters,
// apiDeleteLetter), cargados antes en mis-cartas.html.
// =============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await authGetSession();
    if (!session || !session.user) {
        window.location.href = 'login.html';
        return;
    }

    const listEl = document.getElementById('letters-list');
    const emptyEl = document.getElementById('letters-empty');
    const loadingEl = document.getElementById('letters-loading');
    const statusEl = document.getElementById('letters-status');

    function showStatus(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = type === 'error'
            ? 'text-sm rounded-lg p-3 mb-4 bg-red-50 text-red-700 border border-red-100'
            : 'text-sm rounded-lg p-3 mb-4 bg-emerald-50 text-emerald-700 border border-emerald-100';
        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 3500);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function letterCardHtml(letter) {
        const courierLabel = letter.courier === 'cd_correo_andreani' ? 'Andreani' : 'Correo Argentino';
        const nombre = (letter.destinatario && letter.destinatario.nombre) || 'Sin destinatario';
        const fecha = letter.updatedAt
            ? new Date(letter.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';

        return `
            <li class="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                <div class="min-w-0">
                    <p class="font-semibold text-gray-800 truncate">${escapeHtml(nombre)}</p>
                    <p class="text-xs text-gray-500">${courierLabel}${fecha ? ` · actualizada el ${fecha}` : ''}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <a href="cd.html?letter=${letter.id}" class="text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                        Editar
                    </a>
                    <button type="button" data-delete-id="${letter.id}" class="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        Borrar
                    </button>
                </div>
            </li>`;
    }

    async function renderLetters() {
        try {
            const letters = await apiListLetters();
            loadingEl?.classList.add('hidden');

            if (!letters.length) {
                emptyEl?.classList.remove('hidden');
                listEl.innerHTML = '';
                return;
            }

            emptyEl?.classList.add('hidden');
            listEl.innerHTML = letters.map(letterCardHtml).join('');

            listEl.querySelectorAll('[data-delete-id]').forEach((btn) => {
                btn.addEventListener('click', () => handleDelete(btn.dataset.deleteId));
            });
        } catch (err) {
            loadingEl?.classList.add('hidden');
            showStatus('No se pudieron cargar tus cartas: ' + err.message, 'error');
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Borrar esta carta? Esta acción no se puede deshacer (los links compartidos de esta carta también dejan de funcionar).')) {
            return;
        }
        try {
            await apiDeleteLetter(id);
            showStatus('Carta borrada.', 'success');
            await renderLetters();
        } catch (err) {
            showStatus('No se pudo borrar: ' + err.message, 'error');
        }
    }

    await renderLetters();
});
