import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Punto único para obtener una instancia de Drizzle a partir del binding D1
 * ("DB", definido en wrangler.toml). Se usa desde cualquier Pages Function así:
 *
 *   import { getDb } from '../../db/client';
 *
 *   export async function onRequestGet(context) {
 *     const db = getDb(context.env);
 *     // ...
 *   }
 */
export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema });
}
