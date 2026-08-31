// =============================================================
// EDITOR WYSIWYG (contenteditable + execCommand)
// Reemplaza a Quill: sin dependencia externa, toolbar con scroll
// horizontal nativo, selects nativos (no se recortan en mobile).
// =============================================================
const editor = document.getElementById('editor');
const toolbar = document.getElementById('toolbar');
const fontFamilySel = document.getElementById('fontFamily');
const fontSizeSel = document.getElementById('fontSize');
const lineHeightSel = document.getElementById('lineHeight');
const clearFormatBtn = document.getElementById('clearFormat');

// Usados también por index.js (extracción con IA) para dejar el cuerpo
// con el formato por defecto de la Carta Documento.
const DEFAULT_SIZE = '10pt';
const DEFAULT_LINE_HEIGHT = '1.15';

const FONT_STACKS = {
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    mono: "'Courier New', Courier, monospace",
};

// --- Guardar/restaurar selección ---
// Al tocar un <select>, el foco sale del contenteditable y la selección
// se pierde/colapsa antes de que dispare 'change' (en móvil el selector
// nativo toma toda la pantalla, así que esto pasa siempre). Por eso
// guardamos la última selección no colapsada dentro del editor y la
// restauramos justo antes de aplicar el formato.
let savedRange = null;

function saveSelectionIfValid() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed && editor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
    }
}

function restoreSelection() {
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.cloneRange());
    return true;
}

document.addEventListener('selectionchange', () => {
    saveSelectionIfValid();
    if (document.activeElement === editor) updateToolbarState();
});

// --- Comandos simples (bold, italic, underline, strike, alineación) ---
toolbar.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // no perder selección
    btn.addEventListener('click', () => {
        document.execCommand(btn.dataset.cmd, false, null);
        editor.focus();
        updateToolbarState();
    });
});

// --- Borrar formato ---
clearFormatBtn.addEventListener('mousedown', (e) => e.preventDefault());
clearFormatBtn.addEventListener('click', () => {
    document.execCommand('removeFormat', false, null);
    // removeFormat no siempre limpia spans de tamaño de fuente propios; forzamos limpieza
    unwrapFontSizeSpans();
    editor.focus();
    updateToolbarState();
});

function unwrapFontSizeSpans() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    container.querySelectorAll('span[style*="font-size"], span[style*="font-family"]').forEach((span) => {
        if (range.intersectsNode(span)) {
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
        }
    });
}

// --- Tipo de fuente ---
fontFamilySel.addEventListener('change', () => {
    if (!restoreSelection()) { editor.focus(); return; }
    applyStyleToSelection({ fontFamily: FONT_STACKS[fontFamilySel.value] });
    editor.focus();
});

// --- Tamaño de fuente: envolvemos la selección en un span ---
fontSizeSel.addEventListener('change', () => {
    if (!restoreSelection()) { editor.focus(); return; }
    applyStyleToSelection({ fontSize: fontSizeSel.value });
    editor.focus();
});

// --- Interlineado: se aplica al bloque contenedor (párrafo/div), no por carácter ---
lineHeightSel.addEventListener('change', () => {
    restoreSelection(); // si no hay selección guardada, aplica a todo el editor (ver función)
    applyLineHeightToBlock(lineHeightSel.value);
    editor.focus();
});

// Convierte una clave de estilo JS (camelCase, ej. "fontSize") a la
// propiedad CSS equivalente (kebab-case, "font-size") para poder usarla
// con style.removeProperty().
function camelToKebab(str) {
    return str.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

// Quita, de todos los descendientes de `root` que tengan estilo inline,
// las propiedades listadas en `propNames` (kebab-case). Si a un
// descendiente no le queda ningún estilo inline después, se le saca el
// atributo `style` por prolijidad.
function clearInlineStyleOnDescendants(root, propNames) {
    root.querySelectorAll('[style]').forEach((el) => {
        propNames.forEach((prop) => el.style.removeProperty(prop));
        if (el.getAttribute('style') === '') el.removeAttribute('style');
    });
}

function applyStyleToSelection(styles) {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    Object.assign(span.style, styles);
    try {
        range.surroundContents(span);
    } catch (e) {
        // selección cruza varios nodos: fallback con extractContents
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
    }
    // El contenido recién envuelto puede incluir spans previos con la
    // MISMA propiedad — típicamente al reajustar un tamaño de fuente ya
    // aplicado (por ejemplo, achicar de 10pt a 6pt un texto que ya
    // estaba en 10pt). En ese caso el span viejo queda anidado COMO
    // HIJO del nuevo (surroundContents cuando la selección coincide
    // exactamente con sus bordes, o extractContents clonándolo cuando
    // la coincidencia es parcial), y como son estilos inline, el hijo
    // siempre gana sobre el padre: el cambio nuevo queda invisible,
    // tapado por el viejo. Lo limpiamos DESPUÉS de envolver — nunca
    // antes — porque para entonces ese contenido ya quedó aislado
    // dentro del span nuevo y no arriesgamos tocar texto que quedó
    // afuera de la selección real.
    clearInlineStyleOnDescendants(span, Object.keys(styles).map(camelToKebab));
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    savedRange = newRange.cloneRange(); // permite aplicar otro cambio sin reseleccionar
}

function getBlockElement(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    const blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'];
    while (el && el !== editor) {
        if (blockTags.includes(el.tagName)) return el;
        el = el.parentElement;
    }
    return editor; // si no hay bloque explícito, afecta todo el editor
}

// El interlineado aplicado directo en el propio `#editor` (caso "todo el
// editor", o cuando getBlockElement no encuentra un bloque explícito —
// típico con texto plano separado por <br>, sin <div>/<p> por línea)
// NUNCA llegaba al PDF: la generación del cuerpo usa `editor.innerHTML`,
// que serializa solo los HIJOS del editor, no su propio atributo
// `style`. Por eso, en vez de setear el line-height en el editor mismo,
// envolvemos su contenido actual en un <div> — que sí es un hijo, y por
// lo tanto sí viaja adentro del innerHTML junto con el resto del cuerpo.
function applyLineHeightToWholeEditor(value) {
    clearInlineStyleOnDescendants(editor, ['line-height']);
    editor.style.removeProperty('line-height');

    // Reusamos el wrapper si ya existe (para no acumular uno nuevo cada
    // vez que se cambia el interlineado global).
    let wrapper = editor.firstElementChild;
    const isExistingWrapper =
        editor.children.length === 1 &&
        wrapper &&
        wrapper.tagName === 'DIV' &&
        wrapper.dataset.lineHeightWrapper === '1';

    if (!isExistingWrapper) {
        wrapper = document.createElement('div');
        wrapper.dataset.lineHeightWrapper = '1';
        while (editor.firstChild) {
            wrapper.appendChild(editor.firstChild);
        }
        editor.appendChild(wrapper);
    }
    wrapper.style.lineHeight = value;

    // Recolocar el cursor al final del wrapper para poder seguir
    // escribiendo con normalidad después de aplicar el cambio.
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
}

function applyLineHeightToBlock(value) {
    const sel = window.getSelection();
    if (!sel.rangeCount) {
        applyLineHeightToWholeEditor(value);
        return;
    }
    const range = sel.getRangeAt(0);
    const blocks = new Set();

    if (range.collapsed) {
        blocks.add(getBlockElement(range.startContainer));
    } else {
        // recorre todos los nodos dentro del rango y agrupa por bloque
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (range.intersectsNode(node)) {
                blocks.add(getBlockElement(node));
            }
        }
        if (blocks.size === 0) blocks.add(getBlockElement(range.startContainer));
    }

    blocks.forEach((b) => {
        if (b === editor) {
            // Mismo caso que arriba: no hay bloque explícito que envuelva
            // la selección, así que aplicamos al editor completo (vía
            // wrapper) en vez de al `#editor` directamente.
            applyLineHeightToWholeEditor(value);
        } else {
            clearInlineStyleOnDescendants(b, ['line-height']);
            b.style.lineHeight = value;
        }
    });
}

// --- Sincroniza estado visual de botones (bold/italic/underline/strike activos) ---
function updateToolbarState() {
    toolbar.querySelectorAll('[data-cmd="bold"], [data-cmd="italic"], [data-cmd="underline"], [data-cmd="strikeThrough"]').forEach((btn) => {
        const active = document.queryCommandState(btn.dataset.cmd);
        btn.classList.toggle('bg-gray-200', active);
    });
}
