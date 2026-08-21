import { getDb } from '../../db/client';
import { sql } from 'drizzle-orm';

// GET /api/health
// Diagnóstico de la conexión a D1. Separa dos chequeos a propósito:
//  - "raw": pega directo al binding D1 (context.env.DB), sin pasar por Drizzle.
//           Si esto falla, el problema es de configuración de Cloudflare
//           (binding mal puesto en wrangler.toml o en el dashboard de Pages).
//  - "drizzle": la misma consulta pero a través de Drizzle ORM.
//           Si "raw" funciona pero esto falla, el problema es de Drizzle
//           (versión, import, o configuración del cliente en db/client.ts).
export async function onRequestGet(context) {
  const result = { status: 'ok', raw: null, drizzle: null };

  try {
    result.raw = await context.env.DB.prepare('SELECT 1 AS ok').first();
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', stage: 'raw', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb(context.env);
    result.drizzle = await db.get(sql`SELECT 1 AS ok`);
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', stage: 'drizzle', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
