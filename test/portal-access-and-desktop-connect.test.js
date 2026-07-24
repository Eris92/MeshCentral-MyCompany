"use strict";
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var admin = read("views/SIRK-Portal.handlebars");
var portal = read("public/portal/standalone/index.html");
assert(admin.indexOf("Dostęp dla wszystkich użytkowników") >= 0);
assert(admin.indexOf('dispatchEvent(new Event("change"') >= 0);
assert(portal.indexOf('select.value="3"') >= 0);
assert(portal.indexOf('select.value="2"') >= 0);
assert(portal.indexOf("Zapytaj o zgodę + Bar") >= 0);
assert(portal.indexOf("Zapytaj o zgodę") >= 0);
assert(portal.indexOf("Pasek Prywatności") >= 0);
assert(portal.indexOf("Number(amt.state)===2") >= 0);
assert(portal.indexOf("pendingConsent") >= 0);
console.log("Portal allowAll save and Desktop connection controls: OK");
