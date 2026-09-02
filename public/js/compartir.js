// =============================================================
// PÁGINA PÚBLICA DE CARTA COMPARTIDA (por token, SIN sesión)
// Depende de editor.js e index.js (cargados antes) para el editor
// de texto enriquecido y generatePDF()/openPreviewModal(). No usa
// auth.js más que para el estado del header (nav.js), no bloquea
// nada si no hay sesión — la autenticación acá es el token de la URL.
// =============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const statusEl = document.getElementById('compartir-status');
    const contentEl = document.getElementById('compartir-content');
    const permissionBadge = document.getElementById('compartir-permission-badge');
    const btnSave = document.getElementById('btn-save-shared');

    function showStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = isError
            ? 'text-sm rounded-lg p-4 mb-6 bg-red-50 text-red-700 border border-red-100'
            : 'text-sm rounded-lg p-4 mb-6 bg-blue-50 text-blue-700 border border-blue-100';
        statusEl.classList.remove('hidden');
    }

    if (!token) {
        showStatus('Falta el link completo — revisá que copiaste la URL entera.', true);
        return;
    }

    let letter;
    let permission;

    try {
        const res = await fetch(`/api/share/${token}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = res.status === 410
                ? 'Este link ya expiró.'
                : (data.error || 'No se pudo abrir este link.');
            showStatus(message, true);
            return;
        }
        letter = data;
        permission = data.permission;
    } catch (err) {
        showStatus('No se pudo conectar con el servidor: ' + err.message, true);
        return;
    }

    // --- Volcar los datos recibidos al formulario (mismos ids que cd.html) ---
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
    // OJO: la API devuelve `cuerpoHtml` (camelCase, así lo serializa
    // Drizzle a partir del schema), no `cuerpo_html`.
    if (typeof editor !== 'undefined' && editor && letter.cuerpoHtml !== undefined) {
        editor.innerHTML = letter.cuerpoHtml;
    }

    if (contentEl) contentEl.classList.remove('hidden');

    // --- Aplicar el permiso: 'view' = todo de solo lectura, 'edit' = editable ---
    const isEdit = permission === 'edit';

    if (permissionBadge) {
        permissionBadge.textContent = isEdit ? 'Podés ver y editar esta carta' : 'Solo podés ver esta carta';
        permissionBadge.className = isEdit
            ? 'text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 inline-block'
            : 'text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 inline-block';
        permissionBadge.classList.remove('hidden');
    }

    [
        'nombre_rt', 'domicilio_rt', 'cp_rt', 'localidad_rt', 'provincia_rt',
        'nombre_dt', 'domicilio_dt', 'cp_dt', 'localidad_dt', 'provincia_dt',
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.readOnly = !isEdit;
    });

    const toolbarEl = document.getElementById('toolbar');
    if (typeof editor !== 'undefined' && editor) {
        editor.contentEditable = isEdit ? 'true' : 'false';
    }
    if (toolbarEl) toolbarEl.classList.toggle('hidden', !isEdit);

    // --- Guardar cambios (solo si permission === 'edit') ---
    if (btnSave) {
        btnSave.classList.toggle('hidden', !isEdit);

        if (isEdit) {
            btnSave.addEventListener('click', async () => {
                const val = (id) => document.getElementById(id)?.value.trim() ?? '';
                const payload = {
                    remitente: {
                        nombre: val('nombre_rt'), domicilio: val('domicilio_rt'), cp: val('cp_rt'),
                        localidad: val('localidad_rt'), provincia: val('provincia_rt'),
                    },
                    destinatario: {
                        nombre: val('nombre_dt'), domicilio: val('domicilio_dt'), cp: val('cp_dt'),
                        localidad: val('localidad_dt'), provincia: val('provincia_dt'),
                    },
                    cuerpo_html: typeof editor !== 'undefined' && editor ? editor.innerHTML : '',
                };

                btnSave.disabled = true;
                const originalText = btnSave.textContent;
                btnSave.textContent = 'Guardando…';

                try {
                    const res = await fetch(`/api/share/${token}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
                    btnSave.textContent = 'Guardado ✓';
                    setTimeout(() => { btnSave.textContent = originalText; }, 2000);
                } catch (err) {
                    alert('No se pudo guardar: ' + err.message);
                    btnSave.textContent = originalText;
                } finally {
                    btnSave.disabled = false;
                }
            });
        }
    }
});
