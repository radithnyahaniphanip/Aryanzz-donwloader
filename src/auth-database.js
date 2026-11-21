import { createClient } from "@libsql/client/web";

const clientCache = new Map();

function plainRow(row) {
  if (!row) return null;
  if (typeof row.toJSON === "function") return row.toJSON();
  return Object.fromEntries(Object.entries(row));
}

function resultMeta(result) {
  return {
    changes: Number(result?.rowsAffected || 0),
    last_row_id: result?.lastInsertRowid ?? null,
    duration: 0
  };
}

/**
 * Adapt libSQL's execute() API to the small subset of Cloudflare D1 used by
 * ARYANZZ auth and MembershipStore. Keeping this interface lets the existing
 * PBKDF2/session/device-moderation code run without a Cloudflare D1 binding.
 */
export function createD1CompatAdapter(client) {
  if (!client || typeof client.execute !== "function") {
    throw new TypeError("A compatible libSQL client is required.");
  }

  return {
    prepare(sql) {
      const statementSql = String(sql);
      let args = [];

      const statement = {
        bind(...values) {
          args = values;
          return statement;
        },

        async first(column) {
          const result = await client.execute({ sql: statementSql, args });
          const row = plainRow(result.rows?.[0] ?? null);
          return column && row ? row[column] ?? null : row;
        },

        async all() {
          const result = await client.execute({ sql: statementSql, args });
          return {
            results: (result.rows || []).map(plainRow),
            success: true,
            meta: resultMeta(result)
          };
        },

        async run() {
          const result = await client.execute({ sql: statementSql, args });
          return { success: true, meta: resultMeta(result) };
        }
      };

      return statement;
    }
  };
}

function tursoConfig(env) {
  const url = String(
    env.TURSO_DATABASE_URL || env.TURSO_URL || env.LIBSQL_DB_URL || ""
  ).trim();
  const authToken = String(
    env.TURSO_AUTH_TOKEN || env.LIBSQL_DB_AUTH_TOKEN || ""
  ).trim();

  return url && authToken ? { url, authToken } : null;
}

export function createTursoAuthDatabase(env) {
  const config = tursoConfig(env || {});
  if (!config) return null;

  // Worker isolates are reused. Cache one HTTP client per configured database
  // so requests do not create a new libSQL client on every invocation.
  const cacheKey = config.url + "\u0000" + config.authToken;
  let database = clientCache.get(cacheKey);

  if (!database) {
    const client = createClient({
      url: config.url,
      authToken: config.authToken
    });
    database = createD1CompatAdapter(client);
    clientCache.set(cacheKey, database);
  }

  return database;
}

/**
 * Prefer the external Turso database when configured. A pre-existing D1
 * binding remains a compatibility fallback, but is not required.
 */
export function withAuthDatabase(env) {
  if (!env || typeof env !== "object") return env;

  const turso = createTursoAuthDatabase(env);
  if (turso) return { ...env, AUTH_DB: turso };

  if (env.AUTH_DB && typeof env.AUTH_DB.prepare === "function") return env;
  return env;
}
