// GET    /api/letters/:id — trae una carta puntual del usuario.
// PUT    /api/letters/:id — actualiza campos de una carta (parcial: solo
//                            se pisan los campos presentes en el body).
// DELETE /api/letters/:id — borra una carta.
//
// Todas requieren sesión y que la carta pertenezca al usuario de la
// sesión. Si la carta no existe O es de otro usuario, se devuelve 404
// en los dos casos (no 403) para no filtrar por status code si un id
// ajeno existe o no.

import { getDb } from '../../../db/client';
import { createAuth } from '../../../db/auth';
import { letters } from '../../../db/schema';
import { eq } from 'drizzle-orm';

const COURIERS = new Set(['cd_correo_arg', 'cd_correo_andreani']);

function json(data, status = 200) {
    return new Response(data === null ? null : JSON.stringify(data), {
        status,
        headers: data === null ? undefined : { 'Content-Type': 'application/json' },
    });
}

async function requireSession(context) {
    const auth = createAuth(context.env);
    return auth.api.getSession({ headers: context.request.headers });
}

// Busca la carta por id y confirma que pertenece a `session`.
// Devuelve { letter, db } o { errorResponse } — nunca ambos.
async function findOwnedLetter(context, session) {
    const db = getDb(context.env);
    const rows = await db
        .select()
        .from(letters)
        .where(eq(letters.id, context.params.id))
        .limit(1);
    const letter = rows[0];

    if (!letter || letter.userId !== session.user.id) {
        return { errorResponse: json({ error: 'Carta no encontrada' }, 404) };
    }
    return { letter, db };
}

export async function onRequestGet(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { letter, errorResponse } = await findOwnedLetter(context, session);
        if (errorResponse) return errorResponse;

        return json(letter);
    } catch (err) {
        console.error('[letters/:id GET]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestPut(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { letter, db, errorResponse } = await findOwnedLetter(context, session);
        if (errorResponse) return errorResponse;

        let body;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'JSON inválido' }, 400);
        }

        const { courier, remitente, destinatario, cuerpo_html } = body ?? {};
        const updates = { updatedAt: new Date() };

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

        return json(updated);
    } catch (err) {
        console.error('[letters/:id PUT]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestDelete(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { letter, db, errorResponse } = await findOwnedLetter(context, session);
        if (errorResponse) return errorResponse;

        await db.delete(letters).where(eq(letters.id, letter.id));

        return json(null, 204);
    } catch (err) {
        console.error('[letters/:id DELETE]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
