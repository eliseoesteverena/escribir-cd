// GET  /api/letters — lista las cartas del usuario autenticado (más
//                      reciente primero).
// POST /api/letters — crea una carta nueva para el usuario autenticado.
//
// Requiere sesión de BetterAuth (cookie). No hay endpoint público: todo
// pasa por createAuth(context.env).api.getSession(...), igual que hace
// internamente el catch-all de auth en functions/api/auth/[[path]].js.

import { getDb } from '../../../db/client';
import { createAuth } from '../../../db/auth';
import { letters } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

const COURIERS = new Set(['cd_correo_arg', 'cd_correo_andreani']);

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function requireSession(context) {
    const auth = createAuth(context.env);
    return auth.api.getSession({ headers: context.request.headers });
}

export async function onRequestGet(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const db = getDb(context.env);
        const rows = await db
            .select()
            .from(letters)
            .where(eq(letters.userId, session.user.id))
            .orderBy(desc(letters.updatedAt));

        return json(rows);
    } catch (err) {
        console.error('[letters:GET]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestPost(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        let body;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'JSON inválido' }, 400);
        }

        const { courier, remitente, destinatario, cuerpo_html } = body ?? {};

        if (!COURIERS.has(courier)) {
            return json({ error: `courier debe ser uno de: ${[...COURIERS].join(', ')}` }, 400);
        }
        if (typeof remitente !== 'object' || remitente === null) {
            return json({ error: 'remitente es requerido (objeto)' }, 400);
        }
        if (typeof destinatario !== 'object' || destinatario === null) {
            return json({ error: 'destinatario es requerido (objeto)' }, 400);
        }
        if (typeof cuerpo_html !== 'string' || cuerpo_html.trim() === '') {
            return json({ error: 'cuerpo_html es requerido' }, 400);
        }

        const now = Date.now();
        const db = getDb(context.env);

        const [inserted] = await db
            .insert(letters)
            .values({
                id: crypto.randomUUID(),
                userId: session.user.id,
                courier,
                remitente,
                destinatario,
                cuerpoHtml: cuerpo_html,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return json(inserted, 201);
    } catch (err) {
        console.error('[letters:POST]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
