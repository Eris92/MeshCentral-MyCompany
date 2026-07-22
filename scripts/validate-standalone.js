"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var errors = [];

var required = [
    "MyCompany.js", "plugin-main.js", "plugin-main-standalone.js", "plugin-main-1.4.0.js", "MyCompanyAdmin.js",
    "config.json", "package.json", "core/runtime.js", "core/runtime-portal.js", "core/device-service.js",
    "modules/Portal/index-safe.js", "modules/MyScripts/index.js", "modules/ApprovalCenter/index.js",
    "public/portal-standalone.html", "public/portal-standalone.css", "public/portal-standalone-devices.css", "public/portal-standalone.js",
    "public/portal-device-workspace.js", "public/portal-device-workspace.css", "public/portal-link-visibility.js",
    "public/sirk-login.js", "public/sirk-login.css", "public/standalone-core.js", "public/portal-management.js",
    "public/portal-folder-collapse.js", "public/portal-subfolder-icons.js", "public/native-portal-launcher.js",
    "public/approvalcenter.js", "public/shared-ui/script-tools.js", "public/shared-ui/results.js"
];

function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function need(source, value, message) { if (source.indexOf(value) < 0) errors.push(message); }

required.forEach(function (file) { if (!fs.existsSync(path.join(root, file))) errors.push("Missing: " + file); });
required.filter(function (file) { return /\.js$/i.test(file) && fs.existsSync(path.join(root, file)); }).forEach(function (file) {
    try { new Function(read(file)); }
    catch (error) { errors.push("Syntax error in " + file + ": " + error.message); }
});

var config = JSON.parse(read("config.json").replace(/^\uFEFF/, ""));
var pkg = JSON.parse(read("package.json").replace(/^\uFEFF/, ""));
if (config.version !== pkg.version) errors.push("config.json and package.json versions must match.");
if (config.version !== "1.5.23") errors.push("Standalone Portal release must publish version 1.5.23.");

var wrapper = read("plugin-main-standalone.js");
["hook_setupHttpHandlers", 'base + "sirkportal"', 'base + "meshcentral"', 'base + "pluginadmin.ashx"', "portal-standalone.html"].forEach(function (value) {
    need(wrapper, value, "Standalone route contract missing: " + value);
});
need(wrapper, "webserver.app.get(portalPath, servePortal)", "Slashless Portal route must be served directly.");
need(wrapper, "webserver.app.get(portalPathSlash, servePortal)", "Slash Portal route must be served directly.");

var html = read("public/portal-standalone.html");
['id="sirkPortalRoot"', 'id="sirkStandaloneRoot"', "standalone-core.js", "portal-standalone.js", "portal-device-workspace.js", "portal-link-visibility.js"].forEach(function (value) {
    need(html, value, "Standalone document missing: " + value);
});
need(html, 'data-view="management"', "Standalone navigation must include Management.");
need(html, 'data-action="language"', "Standalone navigation must include the language control.");
need(html, 'class="sirk-standalone-native"', "Standalone navigation must include native MeshCentral link.");

var app = read("public/portal-standalone.js");
['core.api("", "bootstrap")', 'core.api("portal", "devices")', 'var STORAGE_LANGUAGE = "sirkPortal.language"', 'name === "language"', "MyCompanyPortalManagement.mount", 'initializeModule("approvalcenter")'].forEach(function (value) {
    need(app, value, "Standalone app contract missing: " + value);
});
if (app.indexOf('initializeModule("myscripts")') >= 0) errors.push("Standalone Portal must not initialize the legacy MyScripts UI.");

var safePortal = read("modules/Portal/index-safe.js");
["showNativeLink", "showLauncher", "loginPanel", "applyLoginIntegration", "mycompany-sirk-login.js", "mycompany-sirk-login.css"].forEach(function (value) {
    need(safePortal, value, "Portal setting/login integration missing: " + value);
});
var adminPortal = read("web/admin-portal.js");
["Show MeshCentral link in SirK Portal", "Show SirK Portal launcher in native Mesh", "Enable SirK Portal login screen"].forEach(function (value) {
    need(adminPortal, value, "Portal admin switch missing: " + value);
});
var visibility = read("public/portal-link-visibility.js");
need(visibility, "showNativeLink", "Standalone Mesh link visibility is not wired.");
var login = read("public/sirk-login.js");
need(login, "sirkNativeLoginHost", "SirK login must preserve the native MeshCentral form.");

var portalBackend = read("modules/Portal/index-safe.js");
need(portalBackend, 'asset === "devices"', "Portal devices API is missing.");
need(portalBackend, "context.device.visibleNodes(user)", "Portal devices API must use the device service.");
var deviceService = read("core/device-service.js");
need(deviceService, "visibleNodes", "Visible device inventory service is missing.");

var standaloneCore = read("public/standalone-core.js");
need(standaloneCore, "__MYCOMPANY_API_BASE__", "Standalone core must use the injected API base.");
need(standaloneCore, 'credentials = "same-origin"', "Standalone API requests must use the MeshCentral session.");

var runtime = read("public/runtime.js");
need(runtime, "native-portal-launcher.js", "Native MeshCentral must load the SirK Portal launcher.");
need(runtime, "config.showLauncher", "Native launcher must honor its independent setting.");
var launcher = read("public/native-portal-launcher.js");
need(launcher, '"left:8px"', "Native SirK Portal launcher must be positioned 8px from the left.");
need(launcher, '"bottom:8px"', "Native SirK Portal launcher must be positioned 8px from the bottom.");

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Standalone SirK Portal architecture: OK");
console.log("Independent navigation controls: OK");
console.log("Optional native login layout: OK");
