import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
// Si el import de arriba falla al instalar dependencias (nombre de paquete
// distinto según la versión de BetterAuth), reemplazar por:
//   import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './client';

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
        database: drizzleAdapter(db, { provider: 'sqlite' }),
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
