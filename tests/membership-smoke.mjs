import assert from "node:assert/strict";
import fs from "node:fs";
import { handleMembership } from "../src/membership.js";
const backend=fs.readFileSync(new URL("../src/membership.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../migrations/0004_membership.sql",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../public/membership.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/membership.css",import.meta.url),"utf8");
for(const [id,price] of [["starter",80000],["plus",140000],["pro",189000],["elite",328000],["ultimate",500000],["lifetime",1800000],["founder",5900000]]){
 assert.ok(backend.includes('id:"'+id+'"'),"Missing plan "+id);
 assert.ok(backend.includes("price:"+price),"Incorrect price for "+id);
 assert.ok(ui.includes('id:"'+id+'"'),"UI missing plan "+id);
}
for(const table of ["membership_orders","user_memberships"])assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS "+table));
assert.ok(backend.includes("credentials")===false,"Credentials are handled by same-origin browser calls");
assert.ok(backend.includes("paymentVerified!==true"),"Manual payment review must fail closed without explicit verification");
assert.ok(migration.includes("provider_transaction_id"),"Provider transaction IDs are reserved for deduplication");
assert.ok(ui.includes("Free Member")&&ui.includes("/api/membership/me"),"UI must preserve Free Member and use authenticated API");
assert.ok(css.includes(".ary-membership"),"Membership styles must be scoped");
const unauth=await handleMembership(new Request("https://aryanzz.example/api/membership/me"),{AUTH_DB:{prepare(){throw new Error("should not be called without session")}},AUTH_SESSION_SECRET:"x".repeat(40)});
assert.equal(unauth.status,401);
const catalog=await handleMembership(new Request("https://aryanzz.example/api/membership/catalog"),{AUTH_DB:{prepare(){}}});
assert.equal(catalog.status,200);
const catalogBody=await catalog.json();assert.equal(catalogBody.plans.length,7);assert.equal(catalogBody.free.id,"free");
assert.equal(catalogBody.pricingStatus,"proposed");
assert.equal(catalogBody.paymentEnabled,false);
console.log("ARYANZZ V1 Membership catalog, auth gate, migration, and fail-closed review checks passed.");
