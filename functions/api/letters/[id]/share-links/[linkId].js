// DELETE /api/letters/:id/share-links/:linkId — revoca un link (dueño).

import { getDb } from '../../../../../db/client';
import { createAuth } from '../../../../../db/auth';
import { letters, shareLinks } from '../../../../../db/schema';
import { and, eq } from 'drizzle-orm';

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

export async function onRequestDelete(context) {
    try {
        const session = await requireSession(context);
        if (!session) return json({ error: 'No autenticado' }, 401);

        const db = getDb(context.env);
        const letterRows = await db
            .select()
            .from(letters)
            .where(eq(letters.id, context.params.id))
            .limit(1);
        const letter = letterRows[0];
        if (!letter || letter.userId !== session.user.id) {
            return json({ error: 'Carta no encontrada' }, 404);
        }

        const linkRows = await db
            .select()
            .from(shareLinks)
            .where(and(eq(shareLinks.id, context.params.linkId), eq(shareLinks.letterId, letter.id)))
            .limit(1);
        if (!linkRows[0]) {
            return json({ error: 'Link no encontrado' }, 404);
        }

        await db.delete(shareLinks).where(eq(shareLinks.id, context.params.linkId));

        return json(null, 204);
    } catch (err) {
        console.error('[share-links/:linkId DELETE]', err);
        return json({ error: 'Error interno' }, 500);
    }
}
