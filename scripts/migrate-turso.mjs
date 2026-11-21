import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = String(
  process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || process.env.LIBSQL_DB_URL || ""
).trim();
const authToken = String(
  process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_DB_AUTH_TOKEN || ""
).trim();

if (!databaseUrl || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running migrations.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "migrations");
const client = createClient({ url: databaseUrl, authToken });

try {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS aryanzz_schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)"
  );

  const files = (await readdir(migrationDirectory))
    .filter(name => /^\\d+_[a-z0-9_-]+\\.sql$/i.test(name))
    .sort();

  for (const name of files) {
    const existing = await client.execute({
      sql: "SELECT name FROM aryanzz_schema_migrations WHERE name=?1 LIMIT 1",
      args: [name]
    });

    if (existing.rows.length) {
      console.log("Already applied:", name);
      continue;
    }

    const sql = await readFile(path.join(migrationDirectory, name), "utf8");
    await client.executeMultiple(sql);
    await client.execute({
      sql: "INSERT OR IGNORE INTO aryanzz_schema_migrations (name, applied_at) VALUES (?1, ?2)",
      args: [name, Date.now()]
    });
    console.log("Applied:", name);
  }

  console.log("ARYANZZ Turso schema is up to date.");
} catch (error) {
  console.error("Turso migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  client.close();
}
