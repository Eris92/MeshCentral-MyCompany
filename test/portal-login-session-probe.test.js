"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var source = fs.readFileSync(path.join(__dirname, "..", "public", "portal", "standalone", "scripts", "login.js"), "utf8");

assert.ok(source.indexOf("../../pluginadmin.ashx") >= 0, "Login flow must probe the same-domain plugin endpoint.");
assert.ok(source.indexOf('endpoint.searchParams.set("pin", "SIRKPortal")') >= 0, "Session probe must use the canonical plugin pin.");
assert.ok(source.indexOf('endpoint.searchParams.set("asset", "bootstrap")') >= 0, "Session probe must request the authenticated bootstrap.");
assert.ok(source.indexOf('credentials: "same-origin"') >= 0, "Session probe must include the MeshCentral session cookie.");
assert.ok(/result\.user\s*&&\s*String\(result\.user\.name/.test(source), "Redirect must require an authenticated user from bootstrap.");
assert.ok(source.indexOf("finishLogin();") >= 0, "Authenticated bootstrap must finish the login flow.");

console.log("Portal login session probe: OK");
