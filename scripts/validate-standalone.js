"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var errors = [];

var required = [
    "MyCompany.js",
    "plugin-main.js",
    "plugin-main-standalone.js",
    "plugin-main-1.4.0.js",
    "MyCompanyAdmin.js",
    "config.json",
    "package.json",
    "core/runtime.js",
    "core/runtime-portal.js",
    "modules/Portal/index-safe.js",
    "modules/MyScripts/index.js",
    "modules/ApprovalCenter/index.js",
    "public/portal-standalone.html",
    "public/portal-standalone.css",
    "public/portal-standalone.js",
    "public/standalone-core.js",
    "public/portal-management.js",
    "public/portal-folder-collapse.js",
    "public/portal-subfolder-icons.js",
    "public/approvalcenter.js",
    "public/shared-ui/script-tools.js",
    "public/shared-ui/results.js"
];

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

function need(source, value, message) {
    if (source.indexOf(value) < 0) errors.push(message);
}

required.forEach(function (file) {
    if (!fs.existsSync(path.join(root, file))) errors.push("Missing: " + file);
});

required.filter(function (file) { return /\.js$/i.test(file) && fs.existsSync(path.join(root, file)); }).forEach(function (file) {
    try { new Function(read(file)); }
    catch (error) { errors.push("Syntax error in " + file + ": " + error.message); }
});

var config = JSON.parse(read("config.json").replace(/^\uFEFF/, ""));
var pkg = JSON.parse(read("package.json").replace(/^\uFEFF/, ""));
if (config.version !== pkg.version) errors.push("config.json and package.json versions must match.");
if (config.version !== "1.5.0") errors.push("Standalone Portal release must publish version 1.5.0.");

var wrapper = read("plugin-main-standalone.js");
[
    "hook_setupHttpHandlers",
    'base + "sirkportal/"',
    'base + "meshcentral/"',
    'base + "pluginadmin.ashx"',
    "portal-standalone.html",
    "sirkNative"
].forEach(function (value) {
    need(wrapper, value, "Standalone route contract missing: " + value);
});

var html = read("public/portal-standalone.html");
[
    'id="sirkPortalRoot"',
    'id="sirkStandaloneRoot"',
    "standalone-core.js",
    "portal-standalone.js",
    "shared-ui/shared-ui.css",
    "portal-standalone.css"
].forEach(function (value) {
    need(html, value, "Standalone document missing: " + value);
});

var app = read("public/portal-standalone.js");
[
    'core.api("", "bootstrap")',
    "MyCompanyPortalManagement.mount",
    'initializeModule("approvalcenter")',
    "sirk-standalone-settings-frame",
    "portal-folder-collapse.js",
    "portal-subfolder-icons.js"
].forEach(function (value) {
    need(app, value, "Standalone app contract missing: " + value);
});
if (app.indexOf('initializeModule("myscripts")') >= 0) errors.push("Standalone Portal must not initialize the legacy MyScripts UI.");

var management = read("public/portal-management.js");
[
    'core.api("myscripts"',
    'core.post("myscripts"',
    "SharedResultsView.mountResult",
    "openDefinitionEditor",
    "openCredentialsEditor",
    "confirmedExecution"
].forEach(function (value) {
    need(management, value, "Management backend integration missing: " + value);
});

var standaloneCore = read("public/standalone-core.js");
need(standaloneCore, "__MYCOMPANY_API_BASE__", "Standalone core must use the injected API base.");
need(standaloneCore, 'credentials = "same-origin"', "Standalone API requests must use the MeshCentral session.");

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Standalone SirK Portal architecture: OK");
console.log("Shared MyCompany backend integration: OK");
