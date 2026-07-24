"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var core = fs.readFileSync(path.join(root, "public", "shared", "core.js"), "utf8");
var runtime = fs.readFileSync(path.join(root, "public", "shared", "runtime.js"), "utf8");
var launcher = fs.readFileSync(path.join(root, "public", "native", "portal-launcher.js"), "utf8");
var config = require(path.join(root, "config.json"));

assert.strictEqual(config.shortName, "SIRKPortal", "MeshCentral plugin pin must remain SIRKPortal.");
assert.ok(core.indexOf('endpoint.searchParams.set("pin", "SIRKPortal")') >= 0,
    "Shared browser API must address the canonical SIRKPortal pin.");
assert.ok(core.indexOf('endpoint.searchParams.set("pin", "SirkPlatform")') < 0,
    "Shared browser API must not use the removed SirkPlatform pin.");
assert.ok(runtime.indexOf('core.api("", "bootstrap")') >= 0,
    "Native runtime must request bootstrap through the shared API.");
assert.ok(launcher.indexOf("showLauncher === true") >= 0,
    "Portal launcher must honor the enabled showLauncher setting.");

console.log("Native Portal launcher bootstrap routing: OK");
