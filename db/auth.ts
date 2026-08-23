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
 *
 * `onLog`, si se pasa, recibe cada línea del logger interno de BetterAuth
 * (nivel 'debug') — permite capturarlas y devolverlas en la respuesta de
 * error en vez de depender de los logs en vivo del dashboard de Cloudflare.
 */
export function createAuth(env: AuthEnv, options?: { onLog?: (line: string) => void }) {
    const db = getDb(env);

    // Se saca cualquier barra final: BetterAuth arma internamente
    // baseURL + basePath ('/api/auth'), y una barra sobrante ahí produce
    // '.../​/api/auth' (doble barra) que nunca matchea contra la URL real
    // de la request — el router HTTP interno queda 404 para todo, aunque
    // la config y la base de datos estén perfectas.
    const baseURL = env.BETTER_AUTH_URL?.replace(/\/+$/, '');

    return betterAuth({
        database: drizzleAdapter(db, {
            provider: 'sqlite',
            schema,
        }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL,
        // Explícito por prolijidad (aunque resultó ser el default real acá,
        // como confirmó el diagnóstico) — mejor no depender de un default
        // asumido para algo tan sensible al ruteo.
        basePath: '/api/auth',
        emailAndPassword: {
            enabled: true,
            // La verificación de email queda para más adelante: requiere
            // un proveedor de envío de mails (Resend, Postmark, etc.) que
            // todavía no está configurado. Sin esto, el alta funciona
            // igual, solo que no exige confirmar el correo.
        },
        // DIAGNÓSTICO TEMPORAL — bajar a 'error' (o sacar el bloque entero)
        // una vez resuelto el 500 del signup.
        logger: {
            level: 'debug',
            disabled: false,
            log: (level, message, ...args) => {
                const extra = args.length
                    ? ' ' + args.map((a) => {
                        try { return JSON.stringify(a); } catch { return String(a); }
                    }).join(' ')
                    : '';
                const line = `[${level}] ${message}${extra}`;
                if (options?.onLog) {
                    options.onLog(line);
                } else {
                    console.log(line);
                }
            },
        },
    });
}
