"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var errors = [];

function absolute(relative) { return path.join(root, relative); }
function exists(relative) { return fs.existsSync(absolute(relative)); }
function read(relative) { return fs.readFileSync(absolute(relative), "utf8"); }
function files(relative) {
    if (!exists(relative)) return [];
    return fs.readdirSync(absolute(relative), { withFileTypes: true }).reduce(function (result, entry) {
        var child = path.posix.join(relative.replace(/\\/g, "/"), entry.name);
        return result.concat(entry.isDirectory() ? files(child) : [child]);
    }, []);
}

[
    "server/core", "server/modules", "public/portal", "public/native", "public/shared", "public/modules",
    "web/admin", "assets/icons", "tools/install", "docs", "scripts", "test"
].forEach(function (relative) {
    if (!exists(relative)) errors.push("Missing canonical directory: " + relative);
});

[
    "SIRKPortal.js", "SIRKPortalAdmin.js", "plugin-main.js", "plugin-main-standalone.js", "admin.js",
    "views/SIRK-Portal.handlebars", "server/core/runtime.js", "server/core/runtime-portal.js",
    "server/modules/approval-center/index.js", "public/shared/core.js", "public/shared/runtime.js",
    "public/shared/icon-registry.js", "public/native/mesh-plugin-core.js", "public/portal/index.js",
    "public/portal/standalone/index.html", "public/modules/automation/index.js", "public/modules/approvals/index.js",
    "web/admin/admin.js", "assets/icons/sirk-ui.svg", "tools/install/Install-SIRK-Portal-FromGit.ps1"
].forEach(function (relative) {
    if (!exists(relative)) errors.push("Missing canonical file: " + relative);
});

[
    "SIRK-Portal.js", "SIRK-PortalAdmin.js", "MyCompany.js", "MyCompanyAdmin.js", "views/MyCompany.handlebars",
    "core", "modules", "public/shared-ui", "public/approvalcenter.js", "Install-MyCompany-FromGit.ps1",
    "Install-MyCompany-FromGit_RUN.ps1", "tools/install/Install-MyCompany-FromGit.ps1",
    "tools/install/Install-MyCompany-FromGit_RUN.ps1"
].forEach(function (relative) {
    if (exists(relative)) errors.push("Legacy or unsafe path must not exist: " + relative);
});

var allowedPublicRootFiles = new Set(["INDEX.md"]);
if (exists("public")) {
    fs.readdirSync(absolute("public"), { withFileTypes: true }).forEach(function (entry) {
        if (entry.isFile() && !allowedPublicRootFiles.has(entry.name)) errors.push("Application asset must not live directly in public/: public/" + entry.name);
    });
}

var allowedWebRootFiles = new Set(["INDEX.md"]);
if (exists("web")) {
    fs.readdirSync(absolute("web"), { withFileTypes: true }).forEach(function (entry) {
        if (entry.isFile() && !allowedWebRootFiles.has(entry.name)) errors.push("Admin asset must live in web/admin/: web/" + entry.name);
    });
}

var config = JSON.parse(read("config.json"));
var packageJson = JSON.parse(read("package.json"));
if (config.name !== "SIRK Management Platform") errors.push("Plugin display name must be SIRK Management Platform.");
if (config.shortName !== "SIRKPortal") errors.push("MeshCentral plugin shortName must be SIRKPortal.");
if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(config.shortName)) errors.push("MeshCentral plugin shortName must be JavaScript-safe.");
if (packageJson.name !== "sirk-portal") errors.push("Package name must be sirk-portal.");

var entry = read("SIRKPortal.js");
if (entry.indexOf("module.exports.SIRKPortal") < 0 || entry.indexOf('createPlugin(parent, "SIRKPortal")') < 0) {
    errors.push("Canonical entrypoint must export and initialize SIRKPortal.");
}
var adminEntry = read("SIRKPortalAdmin.js");
if (adminEntry.indexOf('require("./admin.js")') < 0) errors.push("Canonical admin entrypoint must delegate to admin.js.");

var pluginMain = read("plugin-main.js");
if (pluginMain.indexOf("./server/core/runtime-portal.js") < 0) errors.push("Plugin bootstrap must load server/core/runtime-portal.js.");
if (/MyCompanyRuntime|__MYCOMPANY_VERSION__|mycompany-data/.test(pluginMain)) errors.push("Plugin bootstrap contains removed MyCompany compatibility code.");

var standalone = read("plugin-main-standalone.js");
if (standalone.indexOf('public", "portal"') < 0 || standalone.indexOf("sirk/api/v1/approvals") < 0) errors.push("Standalone server must use the canonical Portal root and API route.");
if (/mycompany\/api|approvalcenter\/api|__myCompanyStandaloneRoutes|mycompany\.local/.test(standalone)) errors.push("Standalone server contains removed legacy routes or flags.");

var adminView = read("views/SIRK-Portal.handlebars");
if (adminView.indexOf("SIRK Management Platform") < 0 || adminView.indexOf("SirkPlatformAdminData") < 0 || /MyCompanyAdminData|mycompany-admin/.test(adminView)) errors.push("Administration view contains legacy branding or identifiers.");

var adminSource = read("admin.js");
[
    '"core.js": ["public/shared/core.js"', '"mesh-plugin-core.js": ["public/native/mesh-plugin-core.js"',
    '"portal.js": ["public/portal/index.js"', '"approvalcenter.js": ["public/modules/approvals/index.js"',
    '"shared-ui/toolbar.js": ["public/shared/ui/toolbar.js"'
].forEach(function (fragment) {
    if (adminSource.indexOf(fragment) < 0) errors.push("Asset router is missing canonical mapping: " + fragment);
});
if (/\["public\/(?:core|runtime|module-shell|portal-|my|defender|move|main\.)/.test(adminSource) || adminSource.indexOf("public/shared-ui/") >= 0) errors.push("Asset router contains a removed flat public path.");

var moduleDirectories = fs.readdirSync(absolute("server/modules"), { withFileTypes: true }).filter(function (entry) { return entry.isDirectory(); }).map(function (entry) { return entry.name; });
moduleDirectories.forEach(function (name) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) errors.push("Server module directory must use kebab-case: " + name);
    if (!exists("server/modules/" + name + "/index.js")) errors.push("Server module is missing index.js: " + name);
});

var registrations = Object.create(null);
files("public/modules").filter(function (file) { return /\.js$/i.test(file); }).forEach(function (file) {
    var source = read(file);
    var pattern = /window\.SirkPlatformModules\.([a-z0-9_-]+)\s*=/gi;
    var match;
    while ((match = pattern.exec(source))) {
        var key = match[1].toLowerCase();
        registrations[key] = registrations[key] || [];
        registrations[key].push(file);
    }
    if (/window\.MyCompanyModules/.test(source)) errors.push("Module renderer contains removed MyCompanyModules namespace: " + file);
});
Object.keys(registrations).forEach(function (key) {
    var unique = Array.from(new Set(registrations[key]));
    if (unique.length > 1) errors.push("Duplicate browser renderer for module " + key + ": " + unique.join(", "));
});

var architecture = read("docs/REPOSITORY-LAYOUT.md");
["server/core/", "server/modules/", "public/portal/", "public/native/", "public/shared/", "public/modules/", "web/admin/", "sirk-platform-data"].forEach(function (fragment) {
    if (architecture.indexOf(fragment) < 0) errors.push("Repository layout documentation is incomplete: " + fragment);
});

fs.readdirSync(root, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isFile() || !/\.ps1$/i.test(entry.name)) return;
    if (!["Install-SIRK-Portal-FromGit.ps1", "Install-SIRK-Portal-FromGit_RUN.ps1"].includes(entry.name)) errors.push("Unexpected PowerShell file in repository root: " + entry.name);
});

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Final repository layout validation: OK");
console.log("SIRK Platform naming validation: OK");
console.log("JavaScript-safe MeshCentral plugin identifier: OK");
console.log("Canonical server and public loader validation: OK");
console.log("Legacy path validation: OK");
