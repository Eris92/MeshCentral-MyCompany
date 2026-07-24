"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var modulesRoot = path.join(root, "server", "modules");

fs.readdirSync(modulesRoot, { withFileTypes: true })
    .filter(function (entry) { return entry.isDirectory(); })
    .forEach(function (entry) {
        var modulePath = path.join(modulesRoot, entry.name, "index.js");
        assert.ok(fs.existsSync(modulePath), "Missing module entrypoint: " + entry.name);
        var loaded = require(modulePath);
        assert.strictEqual(typeof loaded.createModule, "function", "Module must export createModule(context): " + entry.name);
    });

[
    "public/vendor/sirk-portal/sirk-portal.css",
    "public/vendor/sirk-portal/portal-ui-contract.css",
    "public/vendor/sirk-portal/portal-ui-contract.js"
].forEach(function (relative) {
    var target = path.join(root, relative);
    assert.ok(fs.existsSync(target), "Missing bundled Portal asset: " + relative);
    assert.ok(fs.statSync(target).size > 32, "Bundled Portal asset is empty: " + relative);
});

console.log("Runtime module loading and bundled Portal assets: OK");
