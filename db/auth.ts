import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
// Nota: este import viene empaquetado junto con `betterAuth()` en el mismo
// release, así que no puede desincronizarse de versión con el core (a
// diferencia de instalar @better-auth/drizzle-adapter como paquete aparte).
// Si esta ruta de import no existe en la versión que se instaló, alternativa:
//   import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { getDb } from './client';
import * as schema from './schema';

type AuthEnv = {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL?: string;
};

/**
 * Crea una instancia de BetterAuth para la request actual.
 *
 * IMPORTANTE: en Cloudflare Pages Functions el binding D1 (env.DB) sólo
 * existe dentro del handler de cada request — no se puede crear una
 * instancia de auth una sola vez a nivel de módulo (el patrón típico de
 * una app Node con `export const auth = betterAuth(...)` global no
 * funciona acá). Por eso esto es una función que se llama en cada request.
 */
export function createAuth(env: AuthEnv) {
    const db = getDb(env);

    return betterAuth({
        database: drizzleAdapter(db, {
            provider: 'sqlite',
            schema,
        }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        emailAndPassword: {
            enabled: true,
            // La verificación de email queda para más adelante: requiere
            // un proveedor de envío de mails (Resend, Postmark, etc.) que
            // todavía no está configurado. Sin esto, el alta funciona
            // igual, solo que no exige confirmar el correo.
        },
    });
}
