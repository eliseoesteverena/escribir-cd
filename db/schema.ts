// Esquema de la base de datos (Cloudflare D1 / SQLite), gestionado con Drizzle ORM.
//
// Este archivo es el punto único de verdad del esquema: cualquier tabla nueva
// se define y se exporta acá. `drizzle-kit generate` compara este archivo
// contra el snapshot anterior y genera el SQL de migración en /drizzle.
//
// Todavía no hay tablas. Van a aparecer en dos momentos:
//   - Fase 2 (Autenticación): BetterAuth genera acá sus propias tablas
//     (user, session, account, verification) vía `npx @better-auth/cli generate`.
//   - Fase 3 (Persistencia de la app): letters, templates, share_links,
//     subscriptions.
//
// import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
//
// export const ejemplo = sqliteTable('ejemplo', {
//   id: text('id').primaryKey(),
//   creadoEn: integer('creado_en', { mode: 'timestamp' }).notNull(),
// });

export {};
