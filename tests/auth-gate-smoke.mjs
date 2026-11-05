import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../public/auth-gate.js",import.meta.url),"utf8");
const USERS_KEY="aryanzz.local.accounts.v94";
const SESSION_KEY="aryanzz.local.session.v94";

class FakeElement{
  constructor(id){
    this.id=id;this.hidden=false;this.textContent="";this.value="";this.type="password";this.disabled=false;
    this.dataset={};this.style={};this.children=[];this.classList={toggle(){},add(){},remove(){}};
  }
  addEventListener(){}
  setAttribute(){}
  removeAttribute(){}
  append(...items){this.children.push(...items)}
}
function boot(values={},storageBlocked=false){
  const nodes=new Map(),bodyClasses={};
  const document={
    readyState:"complete",
    body:{classList:{toggle(name,value){bodyClasses[name]=!!value}}},
    getElementById(id){if(!nodes.has(id))nodes.set(id,new FakeElement(id));return nodes.get(id)},
    querySelectorAll(){return []},
    addEventListener(){}
  };
  const localStorage={
    getItem(key){if(storageBlocked)throw new Error("storage blocked");return Object.prototype.hasOwnProperty.call(values,key)?values[key]:null},
    setItem(key,value){if(storageBlocked)throw new Error("storage blocked");values[key]=String(value)},
    removeItem(key){if(storageBlocked)throw new Error("storage blocked");delete values[key]}
  };
  const window={crypto:{subtle:{},getRandomValues(){}}};
  vm.runInNewContext(source,{document,localStorage,window,crypto:{},TextEncoder,Uint8Array,Date,JSON,Array,Math,Number,String,RegExp,Promise,setTimeout,clearTimeout});
  return {nodes,bodyClasses,window,values};
}
const user={id:"ARY-TESTACCOUNT01",fullName:"Test User",email:"test@example.com",salt:"00".repeat(16),passwordHash:"00".repeat(32),iterations:250000};
const existing={ [USERS_KEY]:JSON.stringify([user]) };

{
  const app=boot({...existing,[SESSION_KEY]:JSON.stringify({id:user.id})});
  assert.equal(app.nodes.get("aryAuthGate").hidden,true,"valid session must hide the auth gate immediately");
  assert.equal(app.nodes.get("profileRandomId").textContent,user.id,"valid session must restore the existing account ID");
  assert.equal(app.bodyClasses["ary-authenticated"],true,"valid session must restore authenticated page state");
}
{
  const app=boot({...existing});
  assert.equal(app.nodes.get("aryAuthGate").hidden,false);
  assert.equal(app.nodes.get("aryRegisterForm").hidden,true,"existing account must never be sent to registration");
  assert.equal(app.nodes.get("aryLoginForm").hidden,false,"existing account without a session must be sent to login");
}
{
  const app=boot({...existing,[SESSION_KEY]:JSON.stringify({id:"ARY-OLDSESSION"})});
  assert.equal(app.nodes.get("aryRegisterForm").hidden,true,"stale session must not trigger duplicate registration");
  assert.match(app.nodes.get("aryAuthMessage").textContent,/Akun lama tetap tersimpan/);
}
{
  const app=boot({},true);
  assert.equal(app.nodes.get("aryRegisterForm").hidden,true,"blocked storage must not show a new-account registration form");
  assert.equal(app.nodes.get("aryLoginForm").hidden,false);
  assert.match(app.nodes.get("aryAuthMessage").textContent,/jangan daftar ulang/i);
}
{
  const app=boot({});
  assert.equal(app.nodes.get("aryRegisterForm").hidden,false,"registration is shown only when no local account or session exists");
  assert.equal(app.nodes.get("aryLoginForm").hidden,true);
}
console.log("ARYANZZ V95 auth-gate session restoration and duplicate-registration regression tests passed.");