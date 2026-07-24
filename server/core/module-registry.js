"use strict";

var fs = require("fs");
var path = require("path");
var BUILTIN = [
    { key: "approvalcenter", name: "Approvals", modulePath: "../modules/approval-center/index.js" },
    { key: "moverequests", name: "Move Requests", modulePath: "../modules/move-requests/index.js" },
    { key: "mycommands", name: "Commands", modulePath: "../modules/commands/index.js" },
    { key: "myjira", name: "Jira Integration", modulePath: "../modules/jira/index.js" },
    { key: "defendertools", name: "Security", modulePath: "../modules/security/index.js" },
    { key: "myscripts", name: "Automation", modulePath: "../modules/automation/index.js" }
];

function discoverExtensions(dataRoot) {
    var directory = path.join(dataRoot, "extensions");
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).filter(function (entry) {
        return entry.isDirectory();
    }).map(function (entry) {
        var extensionRoot = path.join(directory, entry.name);
        var manifestPath = path.join(extensionRoot, "sirk-module.json");
        if (!fs.existsSync(manifestPath)) return null;
        var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        var key = String(manifest.key || entry.name);
        if (!/^[a-z][a-z0-9_-]{1,63}$/i.test(key)) throw new Error("Invalid extension key: " + key);
        var modulePath = path.resolve(extensionRoot, String(manifest.serverEntry || "index.js"));
        if (modulePath.indexOf(extensionRoot + path.sep) !== 0) throw new Error("Extension entry escapes its directory: " + key);
        return { key: key, name: String(manifest.name || key), modulePath: modulePath, external: true, manifest: manifest };
    }).filter(Boolean);
}

module.exports = {
    builtins: BUILTIN,
    discoverExtensions: discoverExtensions,
    descriptors: function (dataRoot) { return BUILTIN.concat(discoverExtensions(dataRoot)); }
};
