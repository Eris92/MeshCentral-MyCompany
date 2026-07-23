"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function read(relative) { return fs.readFileSync(path.join(root, relative), "utf8"); }

var catalog = JSON.parse(read("marketplace.json"));
var client = read("web/admin/admin-marketplace.js");
var admin = read("admin.js");
var view = read("views/SIRK-Portal.handlebars");

assert.strictEqual(catalog.schemaVersion, 1, "Marketplace schema version is required");
assert(Array.isArray(catalog.plugins) && catalog.plugins.length >= 3, "Marketplace must contain curated plugins");

var names = Object.create(null);
catalog.plugins.forEach(function (plugin) {
    assert(plugin.name && plugin.shortName && plugin.version && plugin.author, "Marketplace identity fields are required");
    assert(/^https:\/\//.test(plugin.configUrl), "Marketplace configUrl must use HTTPS");
    assert(/^https:\/\//.test(plugin.homepage), "Marketplace homepage must use HTTPS");
    assert(!names[String(plugin.shortName).toLowerCase()], "Marketplace shortName must be unique");
    names[String(plugin.shortName).toLowerCase()] = true;
});

[
    'postOperation("add", { configUrl: item.configUrl })',
    'postOperation("enable", { id: added.id })',
    'Zainstalowane',
    'Dostępne',
    'Szukaj w Marketplace',
    'Kod wtyczki działa z uprawnieniami serwera MeshCentral.'
].forEach(function (contract) {
    assert(client.indexOf(contract) >= 0, "Missing Marketplace UI contract: " + contract);
});

assert(admin.indexOf('"admin-marketplace.js": ["web/admin/admin-marketplace.js"') >= 0, "Marketplace UI asset must be exposed");
assert(admin.indexOf('"marketplace.json": ["marketplace.json"') >= 0, "Marketplace catalog asset must be exposed");
assert(view.indexOf("asset=admin-marketplace.js") >= 0, "Marketplace UI must be loaded by the admin view");

console.log("Plugin Marketplace contracts: OK");
