"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var errors = [];

function absolute(relative) { return path.join(root, relative); }
function exists(relative) { return fs.existsSync(absolute(relative)); }
function read(relative) { return fs.readFileSync(absolute(relative), "utf8").replace(/^\uFEFF/, ""); }
function need(source, value, message) { if (source.indexOf(value) < 0) errors.push(message); }
function reject(source, pattern, message) { if (pattern.test(source)) errors.push(message); }

[
    "public/portal/standalone/index.html",
    "public/portal/standalone/login.html",
    "public/portal/standalone/scripts/core.js",
    "public/portal/standalone/scripts/app.js",
    "public/portal/standalone/scripts/navigation.js",
    "public/portal/standalone/scripts/device-workspace.js",
    "public/portal/standalone/scripts/terminal-connect.js",
    "public/portal/standalone/scripts/login.js",
    "public/portal/standalone/scripts/native-login.js",
    "public/portal/standalone/scripts/view-mode.js",
    "public/portal/standalone/styles/base.css",
    "public/portal/standalone/styles/login.css",
    "public/portal/standalone/styles/native-login.css",
    "public/native/device-tabs.js",
    "plugin-main-standalone.js"
].forEach(function (relative) {
    if (!exists(relative)) errors.push("Missing standalone asset: " + relative);
});

var bootstrap = read("plugin-main-standalone.js");
[
    'path.join(__dirname, "public", "portal")',
    '"portal-standalone.js": "standalone/scripts/app.js"',
    '"portal-device-tabs.js": "../native/device-tabs.js"',
    '"portal-view-mode.js": "standalone/scripts/view-mode.js"',
    '"sirk-native-login.js": "standalone/scripts/native-login.js"',
    '"sirk-native-login.css": "standalone/styles/native-login.css"',
    "sirk/api/v1/approvals"
].forEach(function (value) { need(bootstrap, value, "Standalone bootstrap missing: " + value); });
reject(bootstrap, /MyCompany|MYCOMPANY|myCompany|mycompany|public\/shared-ui/, "Standalone bootstrap contains removed legacy naming or paths.");

var html = read("public/portal/standalone/index.html");
[
    'id="sirkPortalRoot"',
    'id="sirkStandaloneRoot"',
    "standalone-core.js",
    "portal-standalone.js",
    "portal-device-workspace.js",
    "portal-device-tabs.js",
    "portal-view-mode.js",
    "portal-standalone-nav.js",
    "__SIRK_PLATFORM_ASSET_BASE__",
    "__SIRK_PLATFORM_PORTAL_VERSION__"
].forEach(function (value) { need(html, value, "Standalone HTML missing: " + value); });
reject(html, /MyCompany|MYCOMPANY|myCompany|mycompany|portal-link-visibility.js/, "Standalone HTML contains removed legacy naming or asset references.");

var login = read("public/portal/standalone/scripts/login.js");
[
    "__SIRK_PLATFORM_LOGIN_ASSET_BASE__",
    "__SIRK_PLATFORM_PORTAL_VERSION__",
    "sirk-native-login.css",
    "sirk-native-login.js",
    "sirkPortal.returnHash"
].forEach(function (value) { need(login, value, "Login bridge missing: " + value); });
reject(login, /MyCompany|MYCOMPANY|myCompany|mycompany|sirk-login.(?:js|css)/, "Login bridge contains removed legacy naming or flat assets.");

var nativeLogin = read("public/portal/standalone/scripts/native-login.js");
need(nativeLogin, "__SIRK_PLATFORM_PORTAL_BRANDING__", "Native login renderer must use SIRK Platform branding.");
need(nativeLogin, "sirk-login-active", "Native login renderer must expose the active state.");
reject(nativeLogin, /MyCompany|MYCOMPANY|myCompany|mycompany/, "Native login renderer contains removed legacy naming.");

var viewMode = read("public/portal/standalone/scripts/view-mode.js");
need(viewMode, "SirkPlatformRuntime", "View mode must use SirkPlatformRuntime.");
need(viewMode, "sirkPortal.focusMode", "View mode must use the canonical preference key.");
need(viewMode, 'document.getElementById("sirkStandaloneRoot")', "View mode observer must be scoped to the Portal root.");
reject(viewMode, /MyCompany|MYCOMPANY|myCompany|mycompany|observe\(document\.documentElement/, "View mode contains removed legacy naming or a global observer.");

["core.js", "app.js", "navigation.js", "device-workspace.js", "terminal-connect.js"].forEach(function (name) {
    var source = read("public/portal/standalone/scripts/" + name);
    reject(source, /MyCompany|MYCOMPANY|myCompany|mycompany/, "Standalone script contains removed legacy naming: " + name);
});

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}
console.log("Standalone SIRK Portal validation: OK");
console.log("Canonical login and view-mode validation: OK");
