import assert from "node:assert/strict";
import { createD1CompatAdapter, withAuthDatabase } from "../src/auth-database.js";

const calls = [];
const fakeClient = {
  async execute(statement) {
    calls.push(statement);
    if (statement.sql.startsWith("SELECT")) {
      return {
        rows: [{ id: "ARY-ABCDEFGH23", email: "member@example.com" }],
        rowsAffected: 0,
        lastInsertRowid: null
      };
    }
    return { rows: [], rowsAffected: 2, lastInsertRowid: "42" };
  }
};

const db = createD1CompatAdapter(fakeClient);
const first = await db
  .prepare("SELECT id,email FROM auth_users WHERE id=?1")
  .bind("ARY-ABCDEFGH23")
  .first();

assert.deepEqual(first, {
  id: "ARY-ABCDEFGH23",
  email: "member@example.com"
});

const all = await db
  .prepare("SELECT id,email FROM auth_users WHERE id=?1")
  .bind("ARY-ABCDEFGH23")
  .all();

assert.equal(all.success, true);
assert.deepEqual(all.results, [first]);

const run = await db
  .prepare("DELETE FROM auth_sessions WHERE user_id=?1")
  .bind("ARY-ABCDEFGH23")
  .run();

assert.equal(run.success, true);
assert.equal(run.meta.changes, 2);
assert.equal(run.meta.last_row_id, "42");
assert.deepEqual(calls[0], {
  sql: "SELECT id,email FROM auth_users WHERE id=?1",
  args: ["ARY-ABCDEFGH23"]
});

const d1 = { prepare() { return {}; } };
const d1Env = { AUTH_DB: d1 };
assert.equal(withAuthDatabase(d1Env), d1Env, "Existing D1 binding remains a fallback when Turso is not configured.");

const noDatabaseEnv = {};
assert.equal(withAuthDatabase(noDatabaseEnv), noDatabaseEnv, "Missing database configuration must fail closed without throwing.");

console.log("ARYANZZ external Turso/libSQL database adapter checks passed.");
