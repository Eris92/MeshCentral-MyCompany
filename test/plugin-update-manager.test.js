"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

var service = read("server/core/plugin-admin-service.js");
var admin = read("admin.js");
var view = read("views/SIRK-Portal.handlebars");
var client = read("web/admin/admin-plugin-updates.js");

[
    "remoteConfig(record)",
    "versionGreater(remote.version, plugin.version)",
    "backupPlugin(plugin, \"before-update-\"",
    "callbackCall(\"installPlugin\", [id, { name: remote.version, url: remote.downloadUrl }, null])",
    "The update is not compatible with the current MeshCentral version."
].forEach(function (contract) {
    assert(service.indexOf(contract) >= 0, "Missing plugin update backend contract: " + contract);
});

assert(admin.indexOf('"admin-plugin-updates.js": ["web/admin/admin-plugin-updates.js"') >= 0, "Admin server must expose the update UI asset");
assert(view.indexOf("asset=admin-plugin-updates.js") >= 0, "Admin view must load the update UI asset");

[
    "Sprawdź aktualizacje",
    "Dostępna",
    "Aktualizacja",
    "operation: \"update\"",
    "Przed aktualizacją zostanie utworzony backup."
].forEach(function (contract) {
    assert(client.indexOf(contract) >= 0, "Missing plugin update UI contract: " + contract);
});

console.log("Plugin update manager contracts: OK");
