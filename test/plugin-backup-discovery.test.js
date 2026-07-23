"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

var discovery = read("server/core/plugin-admin-service-backup-discovery.js");
var admin = read("admin.js");

[
    "candidateRoots()",
    "plugin-backups",
    "plugins-backup",
    "readConfig(container, plugin.shortName)",
    "fs.cpSync(backup.source, target",
    "normalize(plugin)"
].forEach(function (contract) {
    assert(discovery.indexOf(contract) >= 0, "Missing backup discovery contract: " + contract);
});

assert(admin.indexOf('plugin-admin-service-backup-discovery.js') >= 0, "Admin must use backup discovery compatibility layer");
console.log("Plugin backup discovery compatibility: OK");
