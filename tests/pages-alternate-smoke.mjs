import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {onRequest} from "../pages-alternate/functions/api/[[path]].js";

const config=readFileSync(new URL("../pages-alternate/wrangler.toml",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../.github/workflows/deploy-pages-alternate.yml",import.meta.url),"utf8");
assert.match(config,/^name = "aryanzz-access-alternate"$/m);
assert.match(config,/^pages_build_output_dir = "\.\.\/public"$/m);
assert.match(config,/\[\[services\]\][\s\S]*?binding = "ARYANZZ_BACKEND"[\s\S]*?service = "aryanzz-donwloader"/);
assert.match(workflow,/wrangler pages deploy \.\.\/public/);
assert.match(workflow,/api\/auth\/config/);
assert.match(workflow,/api\/membership\/payment-config/);
assert.doesNotMatch(config,/api_key|AUTH_SESSION_SECRET|TURNSTILE_SECRET_KEY|AIRPAY_API_KEY/i,
  "The Pages alias must never duplicate secrets from the original backend.");
let observed=null;
const request=new Request("https://aryanzz-access-alternate.pages.dev/api/auth/login",{
  method:"POST",headers:{
    origin:"https://aryanzz-access-alternate.pages.dev",
    cookie:"aryanzz_device_lock=abc",
    "content-type":"application/json"
  },body:'{"test":true}'
});
const response=await onRequest({
  request,
  env:{ARYANZZ_BACKEND:{fetch:async incoming=>{
    observed=incoming;
    return new Response('{"ok":true}',{
      status:202,headers:{"content-type":"application/json","set-cookie":"aryanzz_session=xyz; Path=/; HttpOnly; Secure; SameSite=Lax"}
    });
  }}}
});
assert.equal(response.status,202);
assert.equal(response.headers.get("cache-control"),"no-store");
assert.ok(response.headers.get("set-cookie")?.includes("aryanzz_session="));
assert.equal(observed.url,request.url,"Pages must retain same-origin host rather than invoke blocked workers.dev from the browser");
assert.equal(observed.headers.get("origin"),request.headers.get("origin"));
assert.equal(observed.headers.get("cookie"),request.headers.get("cookie"));
assert.equal(observed.method,"POST");
assert.equal(await observed.text(),'{"test":true}');
const disconnected=await onRequest({request,env:{}});
assert.equal(disconnected.status,503,"Service binding missing: fail closed");
assert.equal((await disconnected.json()).code,"PAGES_BACKEND_UNAVAILABLE");
console.log("Pages alternate: private same-origin API, cookies, method and error security checks passed.");
