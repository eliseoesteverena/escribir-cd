// GET /api/share/:token — trae la carta asociada al token, si es válido y
//                          no expiró. Público, sin sesión.
// PUT /api/share/:token — edita la carta asociada, SOLO si el link tiene
//                          permission:'edit' y no expiró. Público, sin
//                          sesión — acá el token ES la autenticación.
//
// ⚠️ Superficie sensible: cualquiera con el link puede ver (y, si el link
// es de edición, modificar) la carta del dueño sin loguearse. No exponer
// userId en las respuestas de este endpoint.

import { getDb } from '../../../db/client';
import { letters, shareLinks } from '../../../db/schema';
import { eq } from 'drizzle-orm';

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Deja afuera userId antes de devolver la carta a un visitante anónimo.
function toPublicLetter(letter, permission) {
    const { userId, ...rest } = letter;
    return { ...rest, permission };
}

// Busca el link por token, valida que exista y no haya expirado.
// Devuelve { link, letter, db } o { errorResponse }.
async function resolveToken(context) {
    const db = getDb(context.env);
    const linkRows = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.token, context.params.token))
        .limit(1);
    const link = linkRows[0];

    if (!link) {
        return { errorResponse: json({ error: 'Link no encontrado o revocado' }, 404) };
    }
    if (link.expiresAt && link.expiresAt < Date.now()) {
        return { errorResponse: json({ error: 'Este link expiró' }, 410) };
    }

    const letterRows = await db.select().from(letters).where(eq(letters.id, link.letterId)).limit(1);
    const letter = letterRows[0];
    if (!letter) {
        // La carta se borró pero el link no se limpió a tiempo (no debería
        // pasar por el cascade de la FK, pero cubrimos el caso igual).
        return { errorResponse: json({ error: 'La carta ya no existe' }, 404) };
    }

    return { link, letter, db };
}

export async function onRequestGet(context) {
    try {
        const { link, letter, errorResponse } = await resolveToken(context);
        if (errorResponse) return errorResponse;

        return json(toPublicLetter(letter, link.permission));
    } catch (err) {
        console.error('[share/:token GET]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestPut(context) {
    try {
        const { link, letter, db, errorResponse } = await resolveToken(context);
        if (errorResponse) return errorResponse;

        if (link.permission !== 'edit') {
            return json({ error: 'Este link es de solo lectura' }, 403);
        }

        let body;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'JSON inválido' }, 400);
        }

        const { courier, remitente, destinatario, cuerpo_html } = body ?? {};
        const updates = { updatedAt: Date.now() };
        const COURIERS = new Set(['correo_argentino', 'andreani']);

        if (courier !== undefined) {
            if (!COURIERS.has(courier)) {
                return json({ error: `courier debe ser uno de: ${[...COURIERS].join(', ')}` }, 400);
            }
            updates.courier = courier;
        }
        if (remitente !== undefined) {
            if (typeof remitente !== 'object' || remitente === null) {
                return json({ error: 'remitente debe ser un objeto' }, 400);
            }
            updates.remitente = remitente;
        }
        if (destinatario !== undefined) {
            if (typeof destinatario !== 'object' || destinatario === null) {
                return json({ error: 'destinatario debe ser un objeto' }, 400);
            }
            updates.destinatario = destinatario;
        }
        if (cuerpo_html !== undefined) {
            if (typeof cuerpo_html !== 'string' || cuerpo_html.trim() === '') {
                return json({ error: 'cuerpo_html no puede estar vacío' }, 400);
            }
            updates.cuerpoHtml = cuerpo_html;
        }

        const [updated] = await db
            .update(letters)
            .set(updates)
            .where(eq(letters.id, letter.id))
            .returning();

        return json(toPublicLetter(updated, link.permission));
    } catch (err) {
        console.error('[share/:token PUT]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
