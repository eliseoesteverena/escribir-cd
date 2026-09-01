// GET  /api/templates — lista las plantillas del usuario autenticado.
// POST /api/templates — crea una plantilla nueva.
//
// Mismo patrón que functions/api/letters/index.js: sesión de BetterAuth
// obligatoria, todo scoped al usuario de la sesión. A diferencia de
// `letters`, no hay campo `courier` (una plantilla no está atada a un
// correo en particular).

import { getDb } from '../../../db/client';
import { createAuth } from '../../../db/auth';
import { templates } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

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
            .from(templates)
            .where(eq(templates.userId, session.user.id))
            .orderBy(desc(templates.updatedAt));

        return json(rows);
    } catch (err) {
        console.error('[templates:GET]', err);
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

        const { name, remitente, destinatario, cuerpo_html } = body ?? {};

        if (typeof name !== 'string' || name.trim() === '') {
            return json({ error: 'name es requerido' }, 400);
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
            .insert(templates)
            .values({
                id: crypto.randomUUID(),
                userId: session.user.id,
                name: name.trim(),
                remitente,
                destinatario,
                cuerpoHtml: cuerpo_html,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return json(inserted, 201);
    } catch (err) {
        console.error('[templates:POST]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
