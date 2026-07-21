"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
var required = [
    "MyCompany.js",
    "plugin-main.js",
    "MyCompanyAdmin.js",
    "config.json",
    "core/runtime.js",
    "core/approval-service.js",
    "modules/ApprovalCenter/index.js",
    "modules/MoveRequests/index.js",
    "modules/MyCommands/index.js",
    "modules/MyScripts/index.js",
    "modules/MyJira/index.js",
    "modules/DefenderTools/index.js",
    "public/shared-ui/toolbar.js",
    "public/shared-ui/toolbar-api.js",
    "public/shared-ui/toolbar-config.js",
    "public/shared-ui/tabs.js",
    "public/shared-ui/layout.js",
    "public/shared-ui/settings.js",
    "public/shared-ui/status-nav.js",
    "public/shared-ui/page.js",
    "seed/MyScripts",
    "seed/MyCommands"
];
var errors = [];
required.forEach(function (relative) {
    if (!fs.existsSync(path.join(root, relative))) errors.push("Missing: " + relative);
});
var config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8").replace(/^\uFEFF/, ""));
if (config.shortName !== "MyCompany") errors.push("config.shortName must be MyCompany.");
if (config.version !== "1.3.0") errors.push("config.version must be 1.3.0.");
var entrypoints = fs.readdirSync(root).filter(function (name) { return name.toLowerCase() === "mycompany.js"; });
if (entrypoints.length !== 1 || entrypoints[0] !== "MyCompany.js") errors.push("Exactly one case-insensitive MyCompany.js entrypoint is required.");
if (fs.existsSync(path.join(root, ".gitmodules"))) errors.push(".gitmodules is not allowed.");
if (fs.existsSync(path.join(root, "legacy"))) errors.push("legacy source directory is not allowed.");
if (errors.length) {
    errors.forEach(function (error) { console.error(error); });
    process.exit(1);
}
console.log("Architecture validation: OK");
