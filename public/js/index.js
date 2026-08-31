// =============================================================
// 1. LÓGICA DEL MODAL DE VISTA PREVIA INMERSIVA
// =============================================================
// Se renderiza con PDF.js sobre un <canvas> en vez de un <iframe> con el
// visor nativo del navegador: en Chrome de escritorio ese visor existe,
// pero en Chrome/WebView de Android no hay visor de PDF embebido para
// iframes, así que el preview quedaba en blanco.
let activePdfDoc = null;
let activePdfPageNum = 1;

async function renderActivePdfPage() {
    if (!activePdfDoc) return;

    const canvas = document.getElementById('pdf-preview-canvas');
    const wrapper = document.getElementById('pdf-preview-wrapper');
    const indicator = document.getElementById('pdf-page-indicator');
    const prevBtn = document.getElementById('pdf-prev-page');
    const nextBtn = document.getElementById('pdf-next-page');

    const ctx = canvas.getContext('2d');
    const page = await activePdfDoc.getPage(activePdfPageNum);

    // Escalamos para que la página entre en el ancho visible del modal
    // (importante en celular, donde el modal ocupa casi toda la pantalla)
    const availableWidth = Math.max(wrapper.parentElement.clientWidth - 32, 240);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(availableWidth / baseViewport.width, 1.4);
    const viewport = page.getViewport({ scale });

    // Nitidez en pantallas de alta densidad (la mayoría de los celulares)
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    await page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
    }).promise;

    if (indicator) indicator.textContent = `Página ${activePdfPageNum} de ${activePdfDoc.numPages}`;
    if (prevBtn) prevBtn.disabled = activePdfPageNum <= 1;
    if (nextBtn) nextBtn.disabled = activePdfPageNum >= activePdfDoc.numPages;
}

document.getElementById('pdf-prev-page')?.addEventListener('click', () => {
    if (activePdfPageNum > 1) {
        activePdfPageNum--;
        renderActivePdfPage();
    }
});

document.getElementById('pdf-next-page')?.addEventListener('click', () => {
    if (activePdfDoc && activePdfPageNum < activePdfDoc.numPages) {
        activePdfPageNum++;
        renderActivePdfPage();
    }
});

async function openPreviewModal(correoType) {
    const modal = document.getElementById('preview-modal');
    const modalContent = document.getElementById('preview-modal-content');
    const title = document.getElementById('modal-title');
    const wrapper = document.getElementById('pdf-preview-wrapper');
    const canvas = document.getElementById('pdf-preview-canvas');
    const downloadBtn = document.getElementById('modal-download-btn');
    const pageNav = document.getElementById('pdf-page-nav');

    // Actualizar título según la empresa
    title.textContent = `Vista Previa - ${correoType === 'cd_correo_andreani' ? 'Andreani' : 'Correo Argentino'}`;

    // Asignar acción al botón de descarga del modal
    if (downloadBtn) {
        downloadBtn.onclick = () => generatePDF(correoType, 'pdf');
    }

    // Mostrar el modal (animación fade in)
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    wrapper.style.opacity = '0.4';
    if (pageNav) pageNav.classList.add('hidden');

    let pdfArrayBuffer;
    try {
        // Antes: generatePDF devolvía una blob: URL y se la pasábamos a
        // pdfjsLib.getDocument({ url }). Eso obliga a PDF.js a "descargarla"
        // de vuelta vía XHR/fetch — aunque sea local, pasa por la misma
        // maquinaria de red que un PDF remoto. En Chrome/WebView de Android
        // esa descarga del blob: falla de forma intermitente con
        // "Unexpected server response (0)" (bug conocido y documentado de
        // PDF.js con blob: URLs en mobile), y forzar disableRange/disableStream
        // solo cambia qué motor de red falla (XHR en vez de fetch), no
        // elimina el problema de fondo.
        //
        // La solución real es no pasar por red en absoluto: jsPDF ya tiene
        // el PDF completo en memoria, así que le pedimos los bytes crudos
        // (arraybuffer) en vez de una blob: URL, y se los pasamos a PDF.js
        // vía la opción `data`. PDF.js parsea esos bytes directo en memoria,
        // sin ningún fetch de por medio.
        pdfArrayBuffer = await generatePDF(correoType, 'arraybuffer');

        if (!pdfArrayBuffer) {
            console.error('No se pudo generar el PDF.');
            return;
        }

        activePdfDoc = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
        activePdfPageNum = 1;

        if (pageNav) {
            const hasMultiplePages = activePdfDoc.numPages > 1;
            pageNav.classList.toggle('hidden', !hasMultiplePages);
            pageNav.classList.toggle('flex', hasMultiplePages);
        }

        await renderActivePdfPage();
        wrapper.style.opacity = '1';
    } catch (error) {
        console.error('Error al generar la vista previa:', error);
        alert("Hubo un error al generar la vista previa.");
    }
}

function closeModal() {
    const modal = document.getElementById('preview-modal');
    const modalContent = document.getElementById('preview-modal-content');
    const canvas = document.getElementById('pdf-preview-canvas');

    // Animación fade out
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        if (canvas) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        }
        activePdfDoc = null;
        activePdfPageNum = 1;
    }, 300);
}

// Cerrar modal con la tecla ESC
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('preview-modal');
    if (event.key === "Escape" && modal && !modal.classList.contains('hidden')) {
        closeModal();
    }
});


// =============================================================
// 2. FUNCIONALIDAD DE LA TOPBAR IA (Subir y Pegar)
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnUpload = document.getElementById('btn-topbar-upload');
    const fileInput = document.getElementById('topbar-file-input');
    const btnPaste = document.getElementById('btn-topbar-paste');

    // Botón "Subilo"
    if (btnUpload && fileInput) {
        btnUpload.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                // Reutilizamos la función de procesamiento existente
                await processFileWithGemini(files[0]);
                fileInput.value = ''; // Resetear el input
            }
        });
    }

    // Botón "Pegá directamente"
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                // Leer el portapapeles del usuario
                const text = await navigator.clipboard.readText();
                if (text && text.trim().length > 0) {
                    const inputContent = { text: text };
                    // Enviar directamente a la API de Gemini
                    await callGeminiExtractionAPI(inputContent);
                } else {
                    alert("El portapapeles está vacío.");
                }
            } catch (err) {
                console.error('Error al leer el portapapeles: ', err);
                alert("No se pudo acceder al portapapeles. Asegúrate de dar los permisos necesarios en tu navegador.");
            }
        });
    }
});


// =============================================================
// 3. OVERLAY DRAG & DROP
// =============================================================
const dropOverlay = document.createElement('div');
dropOverlay.id = 'drop-overlay';
dropOverlay.innerHTML = `
    <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">Soltá tu archivo PDF o Word (.docx) aquí</h2>
    <p style="font-size: 1.1rem;">Extraeremos automáticamente los datos del Remitente, Destinatario y Cuerpo</p>
`;
document.body.appendChild(dropOverlay);

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

let dragCounter = 0;
document.body.addEventListener('dragenter', () => {
    dragCounter++;
    dropOverlay.classList.add('active');
});

document.body.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter === 0) {
        dropOverlay.classList.remove('active');
    }
});

document.body.addEventListener('drop', async (e) => {
    dragCounter = 0;
    dropOverlay.classList.remove('active');
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    await processFileWithGemini(file);
});


// =============================================================
// 4. PROCESAMIENTO DE ARCHIVOS Y GEMINI API
// =============================================================
async function processFileWithGemini(file) {
    try {
        let inputContent = null;

        if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
            const base64Data = await fileToBase64(file);
            inputContent = {
                inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data
                }
            };
        } else if (file.name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            inputContent = { text: result.value };
        } else if (file.name.endsWith('.doc') || file.type === "application/msword") {
            const extractedText = await extractRawTextFromLegacyDoc(file);
            inputContent = { text: extractedText };
        } else {
            alert("Formato no soportado. Usa PDF, DOCX o DOC.");
            return;
        }

        await callGeminiExtractionAPI(inputContent);

    } catch (error) {
        console.error("Error al procesar el archivo:", error);
        alert("Ocurrió un error al procesar el archivo.");
    }
}

async function extractRawTextFromLegacyDoc(file) {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('windows-1252');
    const rawString = decoder.decode(arrayBuffer);
    const cleanText = rawString
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleanText;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// =============================================================
// TOASTS: feedback no bloqueante para operaciones asíncronas
// =============================================================
let toastContainerEl = null;
let activeToastEl = null;
let activeToastTimeout = null;

function getToastContainer() {
    if (!toastContainerEl) {
        toastContainerEl = document.createElement('div');
        toastContainerEl.id = 'toast-container';
        Object.assign(toastContainerEl.style, {
            position: 'fixed',
            left: '50%',
            bottom: '1.5rem',
            transform: 'translateX(-50%)',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            pointerEvents: 'none',
            maxWidth: '92vw',
        });
        document.body.appendChild(toastContainerEl);
    }
    return toastContainerEl;
}

const TOAST_STYLES = {
    loading: { bg: '#1e293b', icon: '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M21 12a9 9 0 1 1-9-9"></path></svg>' },
    success: { bg: '#059669', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' },
    error:   { bg: '#dc2626', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' },
};

// duration=0 deja el toast visible hasta que otra llamada lo reemplace
// (útil para el estado "loading" mientras esperamos una respuesta).
function showToast(message, type = 'loading', duration = 3000) {
    const container = getToastContainer();
    const style = TOAST_STYLES[type] || TOAST_STYLES.loading;

    if (activeToastTimeout) {
        clearTimeout(activeToastTimeout);
        activeToastTimeout = null;
    }
    if (activeToastEl) {
        activeToastEl.remove();
        activeToastEl = null;
    }

    const toast = document.createElement('div');
    Object.assign(toast.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1rem',
        borderRadius: '9999px',
        color: '#ffffff',
        fontSize: '0.875rem',
        fontWeight: '500',
        backgroundColor: style.bg,
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
        opacity: '0',
        transform: 'translateY(8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
    });
    toast.innerHTML = `${style.icon}<span></span>`;
    toast.querySelector('span').textContent = message;

    container.appendChild(toast);
    activeToastEl = toast;

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    if (duration > 0) {
        activeToastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => {
                toast.remove();
                if (activeToastEl === toast) activeToastEl = null;
            }, 200);
        }, duration);
    }

    return toast;
}


// ¿Hay algo ya cargado a mano (campos del form o cuerpo del editor) antes
// de esta extracción? Si es así, hay que preguntar antes de pisarlo.
function hasExistingFormData() {
    const fieldIds = [
        'nombre_rt', 'domicilio_rt', 'cp_rt', 'localidad_rt', 'provincia_rt',
        'nombre_dt', 'domicilio_dt', 'cp_dt', 'localidad_dt', 'provincia_dt',
    ];
    const hasFieldValue = fieldIds.some((id) => {
        const el = document.getElementById(id);
        return el && el.value.trim().length > 0;
    });
    const hasBodyValue = typeof editor !== 'undefined' && editor && editor.textContent.trim().length > 0;
    return hasFieldValue || hasBodyValue;
}

// Muestra el modal de conflicto (markup en cd.html, mismo patrón visual
// que #preview-modal) y devuelve una promesa que resuelve a 'insert' o
// 'keep'. Cerrar con la X cuenta como 'keep' — es la opción que nunca
// pierde nada, así que es el default seguro si el usuario no elige.
function askKeepOrInsertExtracted() {
    return new Promise((resolve) => {
        const modal = document.getElementById('extract-confirm-modal');
        const modalContent = document.getElementById('extract-confirm-modal-content');
        const insertBtn = document.getElementById('extract-confirm-insert-btn');
        const keepBtn = document.getElementById('extract-confirm-keep-btn');
        const closeBtn = document.getElementById('extract-confirm-close-btn');

        if (!modal || !modalContent || !insertBtn || !keepBtn) {
            // Si el modal no está en el DOM por algún motivo, no trabamos
            // el flujo — nos quedamos con el comportamiento previo.
            resolve('insert');
            return;
        }

        function close(result) {
            modal.classList.add('opacity-0');
            modalContent.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
            insertBtn.removeEventListener('click', onInsert);
            keepBtn.removeEventListener('click', onKeep);
            if (closeBtn) closeBtn.removeEventListener('click', onKeep);
            resolve(result);
        }

        function onInsert() { close('insert'); }
        function onKeep() { close('keep'); }

        insertBtn.addEventListener('click', onInsert);
        keepBtn.addEventListener('click', onKeep);
        if (closeBtn) closeBtn.addEventListener('click', onKeep);

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
        }, 10);
    });
}

async function callGeminiExtractionAPI(inputContent) {
    // Feedback visual al usuario
    document.body.style.cursor = 'wait';
    showToast('Analizando documento con IA…', 'loading', 0);
    
    try {
        const response = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(inputContent)
        });
        
        // Intentamos parsear la respuesta (sea de éxito o de error)
        const data = await response.json();
        
        if (!response.ok) {
            // Si el backend devolvió { message: "..." }, lo usamos para el error
            throw new Error(data.message || `Error en el servidor (${response.status})`);
        }

        // Si ya había datos cargados a mano, preguntamos antes de pisarlos.
        // populateFormWithExtractedData ya es selectiva por sí misma —solo
        // toca los campos que vienen con valor en `data`—, así que elegir
        // "usar lo extraído" nunca resetea un campo que la IA no completó.
        if (hasExistingFormData()) {
            showToast('Encontramos datos extraídos — elegí qué hacer', 'success', 2500);
            const choice = await askKeepOrInsertExtracted();
            if (choice === 'keep') {
                showToast('Se conservaron los datos ya cargados.', 'success', 3000);
                return;
            }
        }

        populateFormWithExtractedData(data);
        showToast('Datos completados con IA ✓', 'success', 3000);
        
    } catch (error) {
        console.error("Error al procesar con IA:", error);
        showToast(`No se pudo procesar el documento: ${error.message}`, 'error', 4500);
    } finally {
        document.body.style.cursor = 'default';
    }
}


function populateFormWithExtractedData(data) {
    if (data.remitente) {
        if (data.remitente.nombre) document.getElementById('nombre_rt').value = data.remitente.nombre;
        if (data.remitente.domicilio) document.getElementById('domicilio_rt').value = data.remitente.domicilio;
        if (data.remitente.cp) document.getElementById('cp_rt').value = data.remitente.cp;
        if (data.remitente.localidad) document.getElementById('localidad_rt').value = data.remitente.localidad;
        if (data.remitente.provincia) document.getElementById('provincia_rt').value = data.remitente.provincia;
    }

    if (data.destinatario) {
        if (data.destinatario.nombre) document.getElementById('nombre_dt').value = data.destinatario.nombre;
        if (data.destinatario.domicilio) document.getElementById('domicilio_dt').value = data.destinatario.domicilio;
        if (data.destinatario.cp) document.getElementById('cp_dt').value = data.destinatario.cp;
        if (data.destinatario.localidad) document.getElementById('localidad_dt').value = data.destinatario.localidad;
        if (data.destinatario.provincia) document.getElementById('provincia_dt').value = data.destinatario.provincia;
    }
    
    // Si la API devuelve el cuerpo de la carta, lo inyectamos en el editor.
    // A diferencia de Quill.setText(), asignar texto plano a innerHTML no
    // genera saltos de línea visuales por sí solo — hay que convertir "\n"
    // a <br> a mano. También hay que escapar < > & primero: el texto viene
    // de la extracción de IA, no es HTML de confianza.
    if (data.cuerpo && editor) {
        const escaped = data.cuerpo
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        editor.innerHTML = escaped.replace(/\n/g, '<br>');
        editor.style.fontSize = DEFAULT_SIZE;
        editor.style.lineHeight = DEFAULT_LINE_HEIGHT;
    }
}


// =============================================================
// 5. PAGINACIÓN DEL CUERPO (para cuando no entra en una sola hoja)
// =============================================================
// 1cm = 96/2.54 px exactos por definición de la unidad CSS 'cm',
// independiente de la densidad de pantalla real del dispositivo.
const CM_TO_PX = 96 / 2.54;

function getTextNodesInOrder(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

function resolveGlobalOffset(textNodes, globalOffset) {
    let remaining = globalOffset;
    for (const node of textNodes) {
        const len = node.textContent.length;
        if (remaining <= len) return { node, offset: remaining };
        remaining -= len;
    }
    const last = textNodes[textNodes.length - 1];
    return last ? { node: last, offset: last.textContent.length } : null;
}

function measureHeightUpTo(container, textNodes, globalOffset) {
    const target = resolveGlobalOffset(textNodes, globalOffset);
    if (!target) return 0;
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(target.node, target.offset);
    const rects = range.getClientRects();
    if (rects.length === 0) return 0;
    const containerTop = container.getBoundingClientRect().top;
    let maxBottom = 0;
    for (const r of rects) maxBottom = Math.max(maxBottom, r.bottom - containerTop);
    return maxBottom;
}

// Busca el mayor offset de texto tal que el contenido hasta ahí entra en
// maxHeightPx. Same idea que un "find last true" binario: la altura crece
// (o se mantiene) a medida que avanza el offset, así que es válido.
function binarySearchSplitOffset(container, textNodes, maxHeightPx) {
    const total = textNodes.reduce((sum, n) => sum + n.textContent.length, 0);
    if (total === 0) return 0;
    if (measureHeightUpTo(container, textNodes, 1) > maxHeightPx) return 0;

    let lo = 0, hi = total;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi + 1) / 2);
        const h = measureHeightUpTo(container, textNodes, mid);
        if (h <= maxHeightPx) lo = mid; else hi = mid - 1;
    }
    return lo;
}

// Retrocede hasta el espacio en blanco anterior más cercano, para que la
// palabra que queda "cortada" por la búsqueda binaria pase entera a la
// página siguiente en vez de partirse a la mitad.
function snapToWordBoundary(fullText, globalOffset) {
    let i = globalOffset;
    while (i > 0 && !/\s/.test(fullText[i - 1])) i--;
    return i;
}

// Divide el contenedor en dos fragmentos de HTML en el punto (node, offset)
// usando Range.cloneContents() — preserva automáticamente el formato
// (negrita, tamaño, etc.) de los spans que quedan "abiertos" en el corte.
function splitContainerAt(container, node, offset) {
    const rangeA = document.createRange();
    rangeA.setStart(container, 0);
    rangeA.setEnd(node, offset);
    const divA = document.createElement('div');
    divA.appendChild(rangeA.cloneContents());

    const rangeB = document.createRange();
    rangeB.setStart(node, offset);
    rangeB.setEnd(container, container.childNodes.length);
    const divB = document.createElement('div');
    divB.appendChild(rangeB.cloneContents());

    return { pageHtml: divA.innerHTML, restHtml: divB.innerHTML };
}

// Orquesta todo: recibe el HTML completo del cuerpo y devuelve un array de
// fragmentos de HTML, uno por página, cada uno garantizado de entrar en
// maxHeightCm a un ancho de widthCm.
async function paginateBody(html, widthCm, maxHeightCm) {
    const maxHeightPx = maxHeightCm * CM_TO_PX;

    const measureEl = document.createElement('div');
    measureEl.style.position = 'fixed';
    measureEl.style.left = '-9999px';
    measureEl.style.top = '0';
    measureEl.style.width = `${widthCm}cm`;
    measureEl.style.fontSize = DEFAULT_SIZE;
    measureEl.style.lineHeight = DEFAULT_LINE_HEIGHT;
    measureEl.style.fontFamily = 'Helvetica, Arial, sans-serif';
    document.body.appendChild(measureEl);

    const pages = [];
    let remainingHtml = html;
    let safety = 0;

    try {
        while (true) {
            safety++;
            if (safety > 30) { // salvaguarda: nunca debería hacer falta tanto
                pages.push(remainingHtml);
                break;
            }

            measureEl.innerHTML = remainingHtml;

            if (measureEl.scrollHeight <= maxHeightPx) {
                pages.push(remainingHtml);
                break;
            }

            const textNodes = getTextNodesInOrder(measureEl);
            if (textNodes.length === 0) {
                pages.push(remainingHtml);
                break;
            }

            const rawOffset = binarySearchSplitOffset(measureEl, textNodes, maxHeightPx);
            const fullText = textNodes.map((n) => n.textContent).join('');
            const snapped = snapToWordBoundary(fullText, rawOffset);
            const finalOffset = snapped > 0 ? snapped : rawOffset;

            if (finalOffset <= 0) {
                // Ni una palabra entra (caso extremo, no debería pasar en la
                // práctica) — evitamos loop infinito mandando todo junto.
                pages.push(remainingHtml);
                break;
            }

            const target = resolveGlobalOffset(textNodes, finalOffset);
            const { pageHtml, restHtml } = splitContainerAt(measureEl, target.node, target.offset);
            pages.push(pageHtml);
            remainingHtml = restHtml;

            const tmp = document.createElement('div');
            tmp.innerHTML = restHtml;
            if (tmp.textContent.trim().length === 0) break;
        }
    } finally {
        document.body.removeChild(measureEl);
    }

    return pages;
}

// =============================================================
// 6. GENERADOR DE PDF Y RASTERIZADO (jsPDF + html2canvas)
// =============================================================
async function generatePDF(correo, output = 'pdf') {
    const { jsPDF } = window.jspdf;
    
    const datos = {
        nombre_rt: document.getElementById('nombre_rt').value,
        domicilio_rt: document.getElementById('domicilio_rt').value,
        cp_rt: document.getElementById('cp_rt').value,
        localidad_rt: document.getElementById('localidad_rt').value,
        provincia_rt: document.getElementById('provincia_rt').value,
        nombre_dt: document.getElementById('nombre_dt').value,
        domicilio_dt: document.getElementById('domicilio_dt').value,
        cp_dt: document.getElementById('cp_dt').value,
        localidad_dt: document.getElementById('localidad_dt').value,
        provincia_dt: document.getElementById('provincia_dt').value,
        // Duplicados para el formulario físico
        nombre_rt_bis: document.getElementById('nombre_rt').value,
        domicilio_rt_bis: document.getElementById('domicilio_rt').value,
        cp_rt_bis: document.getElementById('cp_rt').value,
        localidad_rt_bis: document.getElementById('localidad_rt').value,
        provincia_rt_bis: document.getElementById('provincia_rt').value,
        nombre_dt_bis: document.getElementById('nombre_dt').value,
        domicilio_dt_bis: document.getElementById('domicilio_dt').value,
        cp_dt_bis: document.getElementById('cp_dt').value,
        localidad_dt_bis: document.getElementById('localidad_dt').value,
        provincia_dt_bis: document.getElementById('provincia_dt').value,
        cuerpo_cd: editor.innerHTML
    };

    const config = {
        nombre_rt: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.54, y: 3, width: 8.12, height: 1.26 },
                cd_correo_andreani: { x: 1.37, y: 2.86, width: 9.3, height: 0.5 }
            }, text: datos.nombre_rt
        },
        domicilio_rt: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.54, y: 4.75, width: 8.12, height: 0.49 },
                cd_correo_andreani: { x: 1.37, y: 3.73, width: 9.3, height: 0.5 }
            }, text: datos.domicilio_rt
        },
        cp_rt: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.55, y: 5.56, width: 2.3, height: 0.47 },
                cd_correo_andreani: { x: 1.37, y: 4.6, width: 1.5, height: 0.5 }
            }, text: datos.cp_rt
        },
        localidad_rt: {
            sizesAndPos: {
                cd_correo_arg: { x: 5, y: 5.56, width: 2.92, height: 0.47 },
                cd_correo_andreani: { x: 2.98, y: 4.6, width: 2.96, height: 0.5 }
            }, text: datos.localidad_rt
        },
        provincia_rt: {
            sizesAndPos: {
                cd_correo_arg: { x: 8, y: 5.56, width: 2.57, height: 0.47 },
                cd_correo_andreani: { x: 6, y: 4.6, width: 4.67, height: 0.5 }
            }, text: datos.provincia_rt
        },
        nombre_dt: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 3, width: 8.12, height: 1.263 },
                cd_correo_andreani: { x: 11.58, y: 2.86, width: 9.3, height: 0.5 }
            }, text: datos.nombre_dt
        },
        domicilio_dt: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 4.75, width: 8.19, height: 0.486 },
                cd_correo_andreani: { x: 11.58, y: 3.73, width: 9.3, height: 0.5 }
            }, text: datos.domicilio_dt
        },
        cp_dt: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 5.56, width: 2.3, height: 0.5 },
                cd_correo_andreani: { x: 11.58, y: 4.6, width: 1.5, height: 0.5 }
            }, text: datos.cp_dt
        },
        localidad_dt: {
            sizesAndPos: {
                cd_correo_arg: { x: 13.4, y: 5.56, width: 2.92, height: 0.5 },
                cd_correo_andreani: { x: 13.19, y: 4.6, width: 2.96, height: 0.5 }
            }, text: datos.localidad_dt
        },
        provincia_dt: {
            sizesAndPos: {
                cd_correo_arg: { x: 16.4, y: 5.56, width: 2.57, height: 0.5 },
                cd_correo_andreani: { x: 16.21, y: 4.6, width: 4.67, height: 0.5 }
            }, text: datos.provincia_dt
        },
        nombre_rt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.54, y: 12.4, width: 8.13, height: 1.26 },
                cd_correo_andreani: { x: 1.37, y: 10.19, width: 9.3, height: 0.5 }
            }, text: datos.nombre_rt_bis
        },
        domicilio_rt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.54, y: 14.15, width: 8.12, height: 0.49 },
                cd_correo_andreani: { x: 1.37, y: 11.06, width: 9.3, height: 0.5 }
            }, text: datos.domicilio_rt_bis
        },
        cp_rt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 2.55, y: 14.96, width: 2.3, height: 0.5 },
                cd_correo_andreani: { x: 1.37, y: 11.93, width: 1.5, height: 0.5 }
            }, text: datos.cp_rt_bis
        },
        localidad_rt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 5, y: 14.96, width: 2.92, height: 0.5 },
                cd_correo_andreani: { x: 2.98, y: 11.93, width: 2.96, height: 0.5 }
            }, text: datos.localidad_rt_bis
        },
        provincia_rt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 8, y: 14.96, width: 2.57, height: 0.5 },
                cd_correo_andreani: { x: 6, y: 11.93, width: 4.67, height: 0.5 }
            }, text: datos.provincia_rt_bis
        },
        nombre_dt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 12.4, width: 8.12, height: 1.263 },
                cd_correo_andreani: { x: 11.58, y: 10.19, width: 9.3, height: 0.5 }
            }, text: datos.nombre_dt_bis
        },
        domicilio_dt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 14.15, width: 8.19, height: 0.486 },
                cd_correo_andreani: { x: 11.58, y: 11.06, width: 9.3, height: 0.5 }
            }, text: datos.domicilio_dt_bis
        },
        cp_dt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 10.9, y: 14.96, width: 2.3, height: 0.5
                },
                cd_correo_andreani: { x: 11.58, y: 11.93, width: 1.5, height: 0.5 }
            }, text: datos.cp_dt_bis
        },
        localidad_dt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 13.4, y: 14.96, width: 2.92, height: 0.5 },
                cd_correo_andreani: { x: 13.19, y: 11.93, width: 2.96, height: 0.5 }
            }, text: datos.localidad_dt_bis
        },
        provincia_dt_bis: {
            sizesAndPos: {
                cd_correo_arg: { x: 16.4, y: 14.96, width: 2.57, height: 0.5 },
                cd_correo_andreani: { x: 16.21, y: 11.93, width: 4.67, height: 0.5 }
            }, text: datos.provincia_dt_bis
        },
        cuerpo_cd: {
            sizesAndPos: {
                cd_correo_arg: { x: 1.7, y: 15.8, width: 17.9, height: 13.5 },
                cd_correo_andreani: { x: 0.8, y: 12.95, width: 19, height: 17.7 }
            }, text: datos.cuerpo_cd
        }
    };

    const cuerpoPos = config.cuerpo_cd.sizesAndPos[correo];
    const cuerpoPages = await paginateBody(datos.cuerpo_cd, cuerpoPos.width, cuerpoPos.height);

    // Arma UNA página completa (todos los campos + el tramo de cuerpo que
    // le toca) y devuelve su canvas rasterizado. Remitente/destinatario y
    // sus _bis se repiten igual en cada página — así es el formulario físico.
    async function renderPage(cuerpoHtml) {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '21.5cm';
        container.style.height = '35.5cm';
        container.style.backgroundColor = '#ffffff';
        container.style.boxSizing = 'border-box';
        container.style.fontFamily = 'Helvetica, Arial, sans-serif';
        container.style.zIndex = '99999';
        document.body.appendChild(container);

        for (const fieldName in config) {
            const field = config[fieldName];
            const pos = field.sizesAndPos[correo];

            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = `${pos.x}cm`;
            div.style.top = `${pos.y}cm`;
            div.style.width = `${pos.width}cm`;
            div.style.height = `${pos.height}cm`;
            div.style.fontSize = '9pt';
            div.style.lineHeight = '1.35';
            div.style.overflow = 'visible';
            div.style.backgroundColor = '#ffffff';
            div.style.color = '#000000';

            if (fieldName === 'cuerpo_cd') {
                // Antes hardcodeado a 12pt, no coincidía con el default real
                // del editor (10pt) — cualquier texto sin tamaño explícito
                // se imprimía más grande de lo que se veía en pantalla.
                div.style.fontSize = DEFAULT_SIZE;
                div.style.lineHeight = DEFAULT_LINE_HEIGHT;
                // overflow:hidden queda como salvaguarda — paginateBody ya
                // garantiza que cuerpoHtml entra en el alto disponible.
                div.style.overflow = 'hidden';
                div.innerHTML = cuerpoHtml;
            } else {
                div.textContent = field.text;
            }

            container.appendChild(div);
        }

        try {
            return await html2canvas(container, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
        } finally {
            document.body.removeChild(container);
        }
    }

    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'cm',
            format: [21.5, 35.5]
        });

        let firstCanvas = null;

        for (let i = 0; i < cuerpoPages.length; i++) {
            if (i > 0) pdf.addPage([21.5, 35.5], 'portrait');

            const canvas = await renderPage(cuerpoPages[i]);
            if (i === 0) firstCanvas = canvas;

            const imgData = canvas.toDataURL('image/jpeg', 0.99);
            pdf.addImage(imgData, 'JPEG', 0, 0, 21.5, 35.5);
        }

        // Control de Salida (Modificado para soportar el modal)
        if (output === 'pdf') {
            pdf.save(`Carta_Documento_${correo === 'cd_correo_andreani' ? 'Andreani' : 'Correo_Argentino'}.pdf`);
        } else if (output === 'bloburl') {
            return pdf.output('bloburl'); // Ideal para embeber en el iframe
        } else if (output === 'arraybuffer') {
            return pdf.output('arraybuffer'); // Bytes crudos, para pdfjsLib.getDocument({ data })
        } else {
            return firstCanvas;
        }

    } catch (error) {
        console.error("Error al rasterizar el documento PDF:", error);
    }
}