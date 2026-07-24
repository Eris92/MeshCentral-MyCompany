"use strict";

var assert = require("assert");
var pluginMain = require("../plugin-main.js");

var hook = pluginMain.createSerializedStartupHook("9.9.9", "SIRKPortal");
var source = hook.toString();

assert.strictEqual(typeof hook, "function");
assert.ok(source.indexOf("9.9.9") >= 0, "Serialized startup hook must embed the version literal.");
assert.ok(source.indexOf("SIRKPortal") >= 0, "Serialized startup hook must embed the plugin pin literal.");
assert.ok(!/\bVERSION\b/.test(source), "Serialized startup hook must not reference server-side VERSION.");
assert.ok(!/\bobj\b/.test(source), "Serialized startup hook must not reference server-side obj.");
assert.ok(!/browserRuntime\s*\(/.test(source), "Serialized hooks must not depend on a closure helper.");

var pluginSource = require("fs").readFileSync(require("path").join(__dirname, "..", "plugin-main.js"), "utf8");
["goPageStart", "goPageEnd", "onDeviceRefreshEnd", "commandResult"].forEach(function (name) {
    var start = pluginSource.indexOf("obj." + name + " = function");
    assert.ok(start >= 0, "Missing hook: " + name);
    var body = pluginSource.slice(start, pluginSource.indexOf("};", start) + 2);
    assert.ok(body.indexOf("window.SirkPlatformRuntime") >= 0, name + " must access runtime directly from window.");
    assert.ok(body.indexOf("browserRuntime") < 0, name + " must not use a closure helper.");
});

console.log("Serialized browser hooks: OK");
