"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var root = path.resolve(__dirname, "..");

var required = [
    "MyCompany.js", "plugin-main.js", "plugin-main-1.4.0.js", "MyCompanyAdmin.js",
    "config.json", "package.json",
    "core/runtime.js", "core/runtime-portal.js", "core/approval-service.js",
    "core/atomic-json.js", "core/settings-store.js", "core/script-library.js",
    "core/script-confirmation-library.js", "core/script-admin-service.js",
    "core/server-script-executor.js",
    "modules/ApprovalCenter/index.js", "modules/MoveRequests/index.js",
    "modules/MyCommands/index.js", "modules/MyScripts/index.js",
    "modules/MyJira/index.js", "modules/DefenderTools/index.js", "modules/Portal/index.js",
    "public/approvalcenter.js", "public/myscripts.js", "public/mycommands.js",
    "public/portal.js", "public/portal-management.js", "public/portal.css",
    "public/runtime.js", "public/module-shell.js", "public/core.js",
    "public/shared-ui/results.js", "public/shared-ui/script-tools.js",
    "public/shared-ui/confirm-execution-form.js", "public/shared-ui/result-layout.js",
    "web/admin-portal.js", "views/MyCompany.handlebars",
    "seed/MyScripts", "seed/MyCommands"
];

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

function need(source, value, message, errors) {
    if (source.indexOf(value) < 0) errors.push(message);
}

function reject(source, value, message, errors) {
    if (source.indexOf(value) >= 0) errors.push(message);
}

function validateSyntax() {
    var errors = [];
    required.filter(function (relative) { return /\.js$/i.test(relative); }).forEach(function (relative) {
        if (!fs.existsSync(path.join(root, relative))) return;
        try { new Function(read(relative)); }
        catch (error) { errors.push("Syntax error in " + relative + ": " + error.message); }
    });
    if (errors.length) throw new Error(errors.join("\n"));
}

function validateArchitecture() {
    var errors = [];
    required.forEach(function (relative) {
        if (!fs.existsSync(path.join(root, relative))) errors.push("Missing: " + relative);
    });

    var config = JSON.parse(read("config.json").replace(/^\uFEFF/, ""));
    var packageConfig = JSON.parse(read("package.json").replace(/^\uFEFF/, ""));
    if (config.shortName !== "MyCompany") errors.push("config.shortName must be MyCompany.");
    if (config.version !== packageConfig.version) errors.push("config.json and package.json versions must match.");
    if (config.version !== "1.4.3") errors.push("Native Portal management release must publish version 1.4.3.");

    var entrypoints = fs.readdirSync(root).filter(function (name) {
        return name.toLowerCase() === "mycompany.js";
    });
    if (entrypoints.length !== 1 || entrypoints[0] !== "MyCompany.js") {
        errors.push("Exactly one case-insensitive MyCompany.js entrypoint is required.");
    }
    if (fs.existsSync(path.join(root, ".gitmodules"))) errors.push(".gitmodules is not allowed.");

    var runtimePortal = read("core/runtime-portal.js");
    ["PORTAL_DEFAULTS", "enabled: false", "runtime.modules.portal", "portalFactory.createModule"].forEach(function (value) {
        need(runtimePortal, value, "Portal runtime integration missing: " + value, errors);
    });

    var portalModule = read("modules/Portal/index.js");
    ["VENDOR_VERSION", "0.3.17", "ensureVendorAssets", "vendorReady", "reloadRequired"].forEach(function (value) {
        need(portalModule, value, "Portal server module missing: " + value, errors);
    });

    var portal = read("public/portal.js");
    [
        'data-sirk-view", "management"',
        'automation: "Automatyzacja"',
        'management: "Zarządzanie"',
        "MyCompanyPortalManagement.mount",
        'core.assetUrl("", "portal-management.js")',
        'mountModule("approvalcenter"',
        "sirk-settings-frame"
    ].forEach(function (value) {
        need(portal, value, "Portal adapter missing: " + value, errors);
    });
    reject(portal, "sirk-management-workspace-0.3.6.js", "Legacy management workspace must not be loaded.", errors);
    reject(portal, 'mountModule("myscripts"', "MyScripts must not be mounted as .mc-shared-page in Portal management.", errors);
    reject(portal, 'automation: "management"', "Automation and Management must remain separate Portal views.", errors);

    var management = read("public/portal-management.js");
    [
        "sirk-management-shell", "sirk-management-toolbar", "sirk-management-workspace",
        'core.api("myscripts"', 'core.post("myscripts"',
        'post("request"', 'api("results"', 'api("script"',
        "openDefinitionEditor", "openCredentialsEditor", "toggleFavorite",
        "confirmedExecution", "SharedResultsView.mountTable", "SharedResultsView.mountResult"
    ].forEach(function (value) {
        need(management, value, "Native management renderer missing: " + value, errors);
    });
    reject(management, "MyCompanyModules.myscripts.mount", "Native management renderer must not mount MyScripts UI.", errors);
    reject(management, "mc-shared-page", "Native management renderer must not create .mc-shared-page.", errors);

    var portalCss = read("public/portal.css");
    [
        ".sirk-management-shell", ".sirk-management-tool", ".sirk-management-workspace",
        ".sirk-management-item", ".sirk-script-action", ".sirk-form-row",
        ".mc-results-table", ".mc-results-debug"
    ].forEach(function (value) {
        need(portalCss, value, "Portal native theme missing: " + value, errors);
    });

    var adminServer = read("MyCompanyAdmin.js");
    ["portal.js", "portal-management.js", "portal.css", "shared-ui/results.js", "shared-ui/script-tools.js"].forEach(function (value) {
        need(adminServer, '"' + value + '"', "Admin asset server missing: " + value, errors);
    });

    var myScriptsServer = read("modules/MyScripts/index.js");
    ["confirmedExecution", "Execution confirmation is required", 'asset === "definition"', 'asset === "script-secrets"'].forEach(function (value) {
        need(myScriptsServer, value, "MyScripts backend missing: " + value, errors);
    });

    var myScripts = read("public/myscripts.js");
    ["confirmExecution", "confirmedExecution", "SharedResultsView.mountTable", "openDefinitionEditor", "openCredentialsEditor"].forEach(function (value) {
        need(myScripts, value, "Native MyScripts UI regression: " + value, errors);
    });

    var adminPortal = read("web/admin-portal.js");
    ["Enable SirK Portal", "Save SirK Portal", "defaultView", "showLauncher"].forEach(function (value) {
        need(adminPortal, value, "Portal admin integration missing: " + value, errors);
    });

    if (errors.length) throw new Error(errors.join("\n"));
}

function validateSettingsWriter() {
    var atomicJson = require(path.join(root, "core", "atomic-json.js"));
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "mycompany-settings-"));
    var filePath = path.join(directory, "settings.json");
    return atomicJson.write(fs, path, filePath, { version: 1, enabled: true }).then(function () {
        return atomicJson.write(fs, path, filePath, { version: 2, enabled: false });
    }).then(function () {
        var value = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (value.version !== 2 || value.enabled !== false) throw new Error("Settings writer returned invalid data.");
    }).finally(function () {
        fs.rmSync(directory, { recursive: true, force: true });
    });
}

Promise.resolve()
    .then(validateSyntax)
    .then(validateArchitecture)
    .then(validateSettingsWriter)
    .then(function () {
        console.log("JavaScript syntax validation: OK");
        console.log("Native Portal management architecture: OK");
        console.log("Settings writer validation: OK");
    })
    .catch(function (error) {
        console.error(error && error.stack || error);
        process.exit(1);
    });
