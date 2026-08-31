// Esquema de la base de datos (Cloudflare D1 / SQLite), gestionado con Drizzle ORM.
//
// Este archivo es el punto único de verdad del esquema: cualquier tabla nueva
// se define y se exporta acá. `drizzle-kit generate` compara este archivo
// contra el snapshot anterior y genera el SQL de migración en /drizzle.
//
// Fase 3 (Persistencia de la app) suma acá `letters`. `templates`,
// `share_links` y `subscriptions` quedan para más adelante (subscriptions
// en particular va atada a Mercado Pago, Fase 4).

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------
// Tablas de BetterAuth (Fase 2). Nombres de tabla/campo elegidos para
// matchear exactamente lo que espera el drizzleAdapter de BetterAuth
// (provider: 'sqlite') — no se generaron con su CLI porque acá no hay
// red para correrlo, así que se escribieron a mano siguiendo su esquema
// estándar documentado.
//
// IMPORTANTE: todos los timestamps usan mode: 'timestamp_ms' (milisegundos),
// NO 'timestamp' (segundos). BetterAuth trabaja en milisegundos (Date.now())
// como toda librería JS; con 'timestamp' (segundos) las comparaciones de
// fecha que hace puertas adentro (¿esta sesión sigue vigente?) quedaban
// desalineadas por un factor de 1000 — no tiraba error, simplemente producía
// resultados incorrectos.
// ---------------------------------------------------------------

export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    issuer: text('issuer'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
});

// ---------------------------------------------------------------
// Tablas de negocio (Fase 3). Por ahora solo `letters`: una carta
// guardada por un usuario autenticado. `id` se genera en la aplicación
// con crypto.randomUUID() (no autoincrement, mismo criterio que las
// tablas de BetterAuth). `remitente` y `destinatario` se guardan como
// JSON (mode: 'json' de Drizzle serializa/deserializa solo) para no
// tener que mantener columna por campo del formulario acá — la forma
// exacta de esos objetos la define el frontend (wizard, pasos 1 y 2).
//
// `courier` es texto libre validado en la capa de API (no hay enum
// nativo en SQLite). Valores usados: 'correo_argentino' | 'andreani'.
// ⚠️ Confirmar que coincide con las claves que ya usa `generatePDF()`
// en public/js/index.js (la doc menciona internamente 'cd_correo_arg' /
// 'cd_correo_andreani' para el objeto de coordenadas FIELD_POSITIONS) —
// si el frontend usa otro string para identificar el correo, alinear acá
// antes de conectar el guardado real.
// ---------------------------------------------------------------

export const letters = sqliteTable('letters', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    courier: text('courier').notNull(),
    remitente: text('remitente', { mode: 'json' }).notNull(),
    destinatario: text('destinatario', { mode: 'json' }).notNull(),
    cuerpoHtml: text('cuerpo_html').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type Letter = typeof letters.$inferSelect;
export type NewLetter = typeof letters.$inferInsert;
