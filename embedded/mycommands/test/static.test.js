"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
[
    "core.js",
    "module.js",
    "extensions.js",
    "plugin-v2.js",
    "mycommands.js",
    "public/core.js",
    "public/main.js",
    "public/enhancements.js",
    "public/fixes.js",
    "public/ui-fixes.js"
].forEach(function (relative) {
    var result = childProcess.spawnSync(process.execPath, ["--check", path.join(root, relative)], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, relative + " failed syntax validation:\n" + (result.stderr || result.stdout || ""));
});

var packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
var config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
var installConfig = JSON.parse(fs.readFileSync(path.join(root, "install-config.json"), "utf8"));
assert.strictEqual(packageJson.version, config.version, "package.json and config.json versions differ");
assert.strictEqual(config.version, installConfig.version, "config.json and install-config.json versions differ");
assert.ok(!fs.existsSync(path.join(root, "data", "folder-permissions.json")), "Runtime folder permissions must not be committed");
assert.ok(!fs.existsSync(path.join(root, "data", "settings.json")), "Runtime settings must not be committed");
assert.match(fs.readFileSync(path.join(root, "extensions.js"), "utf8"), /MultiHost/);
assert.match(fs.readFileSync(path.join(root, "public", "enhancements.js"), "utf8"), /Debug \/ raw output/);
assert.match(fs.readFileSync(path.join(root, "public", "fixes.js"), "utf8"), /Copy link with variables/);
assert.match(fs.readFileSync(path.join(root, "public", "ui-fixes.js"), "utf8"), /mycommands-scripts-page/);
assert.match(fs.readFileSync(path.join(root, "public", "ui-fixes.css"), "utf8"), /grid-template-columns: minmax\(130px, 190px\)/);

console.log("My Commands static checks passed.");
