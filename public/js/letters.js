// =============================================================
// API DE CARTAS GUARDADAS (Fase 3) + integración con el wizard
// =============================================================
// Depende de auth.js (cargado antes) para authGetSession(). Mismo
// origen, así que fetch() manda la cookie de sesión sola.
//
// Este archivo se carga en cd.html (después de wizard.js) y en
// mis-cartas.html. Las funciones apiXxx de acá arriba son genéricas
// y las usan las dos páginas. El bloque de abajo (DOMContentLoaded)
// es específico del wizard: si no encuentra #btn-save-letter en el
// DOM, corta enseguida — así no hace nada en mis-cartas.html.

async function apiListLetters() {
    const res = await fetch('/api/letters', { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiGetLetter(id) {
    const res = await fetch(`/api/letters/${id}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiCreateLetter(payload) {
    const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiUpdateLetter(id, payload) {
    const res = await fetch(`/api/letters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiDeleteLetter(id) {
    const res = await fetch(`/api/letters/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
    }
}

async function apiListShareLinks(letterId) {
    const res = await fetch(`/api/letters/${letterId}/share-links`, { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiCreateShareLink(letterId, { permission, expires_at }) {
    const res = await fetch(`/api/letters/${letterId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission, expires_at }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

async function apiDeleteShareLink(letterId, linkId) {
    const res = await fetch(`/api/letters/${letterId}/share-links/${linkId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
    }
}

// ---------------------------------------------------------------
// Integración con el wizard (cd.html)
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const btnSaveLetter = document.getElementById('btn-save-letter');
    if (!btnSaveLetter) return; // no estamos en cd.html

    const loggedOutBox = document.getElementById('save-letter-logged-out');
    const loggedInBox = document.getElementById('save-letter-logged-in');
    const statusEl = document.getElementById('save-letter-status');
    const courierSelect = document.getElementById('save-letter-courier');
    const shareSection = document.getElementById('share-link-section');
    const shareHint = document.getElementById('share-link-hint');
    const btnCreateShareLink = document.getElementById('btn-create-share-link');
    const sharePermissionSelect = document.getElementById('share-link-permission');
    const shareLinkListEl = document.getElementById('share-link-list');

    const params = new URLSearchParams(window.location.search);
    let currentLetterId = params.get('letter');

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function notify(message, type) {
        // showToast vive en index.js, que se carga antes que este archivo
        // en cd.html — pero cubrimos igual el caso de que no esté.
        if (typeof showToast === 'function') {
            showToast(message, type, type === 'error' ? 4500 : 2500);
        } else {
            alert(message);
        }
    }

    // Arma el payload para /api/letters a partir de lo que hay en el DOM
    // ahora mismo. Mismas claves (nombre/domicilio/cp/localidad/provincia)
    // que ya usa /api/extract y populateFormWithExtractedData en index.js.
    function collectLetterPayload(courier) {
        const val = (id) => document.getElementById(id)?.value.trim() ?? '';
        return {
            courier,
            remitente: {
                nombre: val('nombre_rt'),
                domicilio: val('domicilio_rt'),
                cp: val('cp_rt'),
                localidad: val('localidad_rt'),
                provincia: val('provincia_rt'),
            },
            destinatario: {
                nombre: val('nombre_dt'),
                domicilio: val('domicilio_dt'),
                cp: val('cp_dt'),
                localidad: val('localidad_dt'),
                provincia: val('provincia_dt'),
            },
            cuerpo_html: typeof editor !== 'undefined' && editor ? editor.innerHTML : '',
        };
    }

    // Inversa de collectLetterPayload: vuelca una carta guardada al DOM.
    function applyLetterToForm(letter) {
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };
        if (letter.remitente) {
            set('nombre_rt', letter.remitente.nombre);
            set('domicilio_rt', letter.remitente.domicilio);
            set('cp_rt', letter.remitente.cp);
            set('localidad_rt', letter.remitente.localidad);
            set('provincia_rt', letter.remitente.provincia);
        }
        if (letter.destinatario) {
            set('nombre_dt', letter.destinatario.nombre);
            set('domicilio_dt', letter.destinatario.domicilio);
            set('cp_dt', letter.destinatario.cp);
            set('localidad_dt', letter.destinatario.localidad);
            set('provincia_dt', letter.destinatario.provincia);
        }
        if (typeof editor !== 'undefined' && editor && letter.cuerpoHtml !== undefined) {
            editor.innerHTML = letter.cuerpoHtml;
        }
        if (courierSelect && letter.courier) courierSelect.value = letter.courier;
    }

    function shareLinkRowHtml(link) {
        const url = `${window.location.origin}/compartir.html?token=${link.token}`;
        const permLabel = link.permission === 'edit' ? 'Ver y editar' : 'Solo ver';
        const expiry = link.expiresAt
            ? `vence el ${new Date(link.expiresAt).toLocaleDateString('es-AR')}`
            : 'sin vencimiento';
        return `
            <li class="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2" data-link-id="${link.id}">
                <div class="min-w-0">
                    <p class="text-xs font-medium text-gray-700">${permLabel} · ${expiry}</p>
                    <p class="text-xs text-gray-400 truncate">${url}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" class="btn-copy-link text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50" data-url="${url}">Copiar</button>
                    <button type="button" class="btn-revoke-link text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50" data-link-id="${link.id}">Revocar</button>
                </div>
            </li>`;
    }

    async function refreshShareLinks() {
        if (!currentLetterId || !shareLinkListEl) return;
        try {
            const links = await apiListShareLinks(currentLetterId);
            shareLinkListEl.innerHTML = links.length
                ? links.map(shareLinkRowHtml).join('')
                : '<li class="text-xs text-gray-400">Todavía no generaste ningún link.</li>';

            shareLinkListEl.querySelectorAll('.btn-copy-link').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(btn.dataset.url);
                        const original = btn.textContent;
                        btn.textContent = 'Copiado ✓';
                        setTimeout(() => { btn.textContent = original; }, 1500);
                    } catch {
                        prompt('Copiá el link manualmente:', btn.dataset.url);
                    }
                });
            });
            shareLinkListEl.querySelectorAll('.btn-revoke-link').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Revocar este link? Quien lo tenga ya no va a poder usarlo.')) return;
                    try {
                        await apiDeleteShareLink(currentLetterId, btn.dataset.linkId);
                        await refreshShareLinks();
                    } catch (err) {
                        notify('No se pudo revocar: ' + err.message, 'error');
                    }
                });
            });
        } catch (err) {
            shareLinkListEl.innerHTML = `<li class="text-xs text-red-500">No se pudieron cargar los links: ${err.message}</li>`;
        }
    }

    // --- Sesión + carga inicial (?letter=ID si venimos de Mis Cartas) ---
    const session = await authGetSession();
    const isLoggedIn = !!(session && session.user);

    if (loggedOutBox) loggedOutBox.classList.toggle('hidden', isLoggedIn);
    if (loggedInBox) loggedInBox.classList.toggle('hidden', !isLoggedIn);

    if (!isLoggedIn) return; // sin sesión no hay nada más para wirear acá

    if (currentLetterId) {
        try {
            const letter = await apiGetLetter(currentLetterId);
            applyLetterToForm(letter);
            setStatus('Carta cargada');
            if (shareSection) shareSection.classList.remove('hidden');
            if (shareHint) shareHint.classList.add('hidden');
            await refreshShareLinks();
        } catch (err) {
            currentLetterId = null;
            notify('No se pudo cargar la carta: ' + err.message, 'error');
        }
    } else if (shareHint) {
        shareHint.classList.remove('hidden');
    }

    // --- Botón Guardar ---
    btnSaveLetter.addEventListener('click', async () => {
        const courier = courierSelect ? courierSelect.value : 'cd_correo_arg';
        const payload = collectLetterPayload(courier);
        btnSaveLetter.disabled = true;
        setStatus('Guardando…');
        try {
            let saved;
            if (currentLetterId) {
                saved = await apiUpdateLetter(currentLetterId, payload);
            } else {
                saved = await apiCreateLetter(payload);
                currentLetterId = saved.id;
                const url = new URL(window.location.href);
                url.searchParams.set('letter', currentLetterId);
                window.history.replaceState({}, '', url);
            }
            setStatus('Guardado ✓');
            if (shareSection) shareSection.classList.remove('hidden');
            if (shareHint) shareHint.classList.add('hidden');
            await refreshShareLinks();
            notify('Carta guardada ✓', 'success');
        } catch (err) {
            setStatus('');
            notify('No se pudo guardar: ' + err.message, 'error');
        } finally {
            btnSaveLetter.disabled = false;
        }
    });

    // --- Generar share link ---
    if (btnCreateShareLink) {
        btnCreateShareLink.addEventListener('click', async () => {
            if (!currentLetterId) {
                notify('Guardá la carta antes de generar un link.', 'error');
                return;
            }
            const permission = sharePermissionSelect ? sharePermissionSelect.value : 'view';
            btnCreateShareLink.disabled = true;
            try {
                await apiCreateShareLink(currentLetterId, { permission, expires_at: null });
                await refreshShareLinks();
                notify('Link generado ✓', 'success');
            } catch (err) {
                notify('No se pudo generar el link: ' + err.message, 'error');
            } finally {
                btnCreateShareLink.disabled = false;
            }
        });
    }
});
