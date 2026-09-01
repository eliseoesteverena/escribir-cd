// GET    /api/templates/:id
// PUT    /api/templates/:id — actualiza parcial (solo pisa campos presentes).
// DELETE /api/templates/:id
//
// Mismo criterio de ownership que letters/[id].js: 404 (no 403) si la
// plantilla no existe o es de otro usuario.

import { getDb } from '../../../db/client';
import { createAuth } from '../../../db/auth';
import { templates } from '../../../db/schema';
import { eq } from 'drizzle-orm';

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

async function findOwnedTemplate(context, session) {
    const db = getDb(context.env);
    const rows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, context.params.id))
        .limit(1);
    const template = rows[0];

    if (!template || template.userId !== session.user.id) {
        return { errorResponse: json({ error: 'Plantilla no encontrada' }, 404) };
    }
    return { template, db };
}

export async function onRequestGet(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { template, errorResponse } = await findOwnedTemplate(context, session);
        if (errorResponse) return errorResponse;

        return json(template);
    } catch (err) {
        console.error('[templates/:id GET]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestPut(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { template, db, errorResponse } = await findOwnedTemplate(context, session);
        if (errorResponse) return errorResponse;

        let body;
        try {
            body = await context.request.json();
        } catch {
            return json({ error: 'JSON inválido' }, 400);
        }

        const { name, remitente, destinatario, cuerpo_html } = body ?? {};
        const updates = { updatedAt: Date.now() };

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim() === '') {
                return json({ error: 'name no puede estar vacío' }, 400);
            }
            updates.name = name.trim();
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
            .update(templates)
            .set(updates)
            .where(eq(templates.id, template.id))
            .returning();

        return json(updated);
    } catch (err) {
        console.error('[templates/:id PUT]', err);
        return json({ error: 'Error interno' }, 500);
    }
}

export async function onRequestDelete(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const { template, db, errorResponse } = await findOwnedTemplate(context, session);
        if (errorResponse) return errorResponse;

        await db.delete(templates).where(eq(templates.id, template.id));

        return json(null, 204);
    } catch (err) {
        console.error('[templates/:id DELETE]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
