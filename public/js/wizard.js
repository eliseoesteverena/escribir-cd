// =============================================================
// WIZARD DE 4 PASOS
// Solo maneja qué panel se ve y la validación mínima para avanzar.
// No toca la lógica de datos/PDF (index.js) para nada: generatePDF,
// populateFormWithExtractedData, etc. siguen leyendo los campos por
// getElementById sin importar qué panel esté visible.
// =============================================================
(function () {
    const TOTAL_STEPS = 4;
    let currentStep = 1;

    const STEP_LABELS = {
        1: 'Datos del Remitente',
        2: 'Datos del Destinatario',
        3: 'Cuerpo de la Carta',
        4: 'Descarga y Configuración',
    };

    const panels = document.querySelectorAll('[data-step-panel]');
    const stepperItems = document.querySelectorAll('[data-stepper-item]');
    const btnPrev = document.getElementById('wizard-btn-prev');
    const btnNext = document.getElementById('wizard-btn-next');
    const errorEl = document.getElementById('wizard-error');
    const subtitleEl = document.getElementById('wizard-subtitle');

    function showError(message, fieldId) {
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
        if (fieldId) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.add('border-red-400', 'ring-2', 'ring-red-100');
                field.focus();
                field.addEventListener(
                    'input',
                    function clearFieldError() {
                        field.classList.remove('border-red-400', 'ring-2', 'ring-red-100');
                        field.removeEventListener('input', clearFieldError);
                    },
                    { once: true }
                );
            }
        }
    }

    function clearError() {
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    // Validación mínima: solo pide lo esencial para no trabar al usuario,
    // no repite validación de todos los campos del formulario.
    function validateStep(step) {
        clearError();

        if (step === 1) {
            const nombre = document.getElementById('nombre_rt');
            if (nombre && !nombre.value.trim()) {
                showError('Completá al menos el nombre del remitente para continuar.', 'nombre_rt');
                return false;
            }
        }

        if (step === 2) {
            const nombre = document.getElementById('nombre_dt');
            if (nombre && !nombre.value.trim()) {
                showError('Completá al menos el nombre del destinatario para continuar.', 'nombre_dt');
                return false;
            }
        }

        if (step === 3) {
            // `editor` es el div contenteditable creado en editor.js (todos
            // los scripts clásicos comparten el mismo scope global de la página).
            if (typeof editor !== 'undefined' && editor.textContent.trim().length === 0) {
                showError('Escribí el cuerpo de la carta antes de continuar.');
                return false;
            }
        }

        return true;
    }

    function renderStep() {
        panels.forEach((panel) => {
            const step = Number(panel.dataset.stepPanel);
            panel.classList.toggle('hidden', step !== currentStep);
        });

        stepperItems.forEach((item) => {
            const step = Number(item.dataset.stepperItem);
            const circle = item.querySelector('[data-stepper-circle]');
            const label = item.querySelector('[data-stepper-label]');

            item.classList.remove('text-blue-600', 'text-gray-400');
            circle.classList.remove(
                'bg-blue-600', 'border-blue-600', 'text-white',
                'border-gray-300', 'text-gray-400'
            );

            if (step < currentStep) {
                // Paso completado
                item.classList.add('text-blue-600');
                circle.classList.add('bg-blue-600', 'border-blue-600', 'text-white');
                circle.textContent = '✓';
                item.style.cursor = 'pointer';
            } else if (step === currentStep) {
                item.classList.add('text-blue-600');
                circle.classList.add('bg-blue-600', 'border-blue-600', 'text-white');
                circle.textContent = String(step);
                item.style.cursor = 'default';
            } else {
                item.classList.add('text-gray-400');
                circle.classList.add('border-gray-300', 'text-gray-400');
                circle.textContent = String(step);
                item.style.cursor = 'default';
            }
        });

        if (subtitleEl) {
            subtitleEl.textContent = `Paso ${currentStep} de ${TOTAL_STEPS} — ${STEP_LABELS[currentStep]}`;
        }

        if (btnPrev) btnPrev.classList.toggle('hidden', currentStep === 1);
        if (btnNext) btnNext.classList.toggle('hidden', currentStep === TOTAL_STEPS);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            // Antes: `if (!validateStep(currentStep)) return;` frenaba el
            // avance si faltaba el nombre de remitente/destinatario o el
            // cuerpo estaba vacío. Se saca ese freno a pedido: ahora el
            // wizard nunca bloquea el paso siguiente por datos faltantes.
            // `validateStep`/`showError` quedan definidas y sin uso — se
            // pueden reconectar más adelante si hace falta mostrar un aviso
            // no bloqueante.
            clearError();
            if (currentStep < TOTAL_STEPS) {
                currentStep++;
                renderStep();
            }
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                renderStep();
            }
        });
    }

    // Permite volver a un paso ya completado tocando su círculo en el stepper
    stepperItems.forEach((item) => {
        item.addEventListener('click', () => {
            const step = Number(item.dataset.stepperItem);
            if (step < currentStep) {
                currentStep = step;
                renderStep();
            }
        });
    });

    renderStep();

    // ---------------------------------------------------------------
    // Toggle "Diseño de impresión": alterna el ancho del editor entre
    // 100% (cómodo para escribir en el celular) y el ancho real de
    // impresión, tomado de la variable CSS --print-preview-width
    // (definida en el <style> de cd.html — cambiar solo esa línea
    // para probar otros valores).
    // ---------------------------------------------------------------
    const printToggle = document.getElementById('print-preview-toggle');
    const editorWidthWrapper = document.getElementById('editor-width-wrapper');
    const printPreviewHint = document.getElementById('print-preview-hint');

    if (printToggle && editorWidthWrapper) {
        const printWidthValue = getComputedStyle(document.documentElement)
            .getPropertyValue('--print-preview-width')
            .trim();

        if (printPreviewHint && printWidthValue) {
            printPreviewHint.dataset.offText = printPreviewHint.textContent;
            printPreviewHint.dataset.onText = `Viendo el ancho real de impresión (${printWidthValue}). Deslizá para recorrerlo.`;
        }

        printToggle.addEventListener('change', () => {
            const active = printToggle.checked;
            editorWidthWrapper.classList.toggle('print-preview-active', active);
            if (printPreviewHint) {
                printPreviewHint.textContent = active
                    ? printPreviewHint.dataset.onText
                    : printPreviewHint.dataset.offText;
            }
        });
    }
})();
