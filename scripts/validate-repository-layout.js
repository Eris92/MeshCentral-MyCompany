"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

var allowedRootPowerShell = new Set([
    "Install-MyCompany-FromGit.ps1",
    "Install-MyCompany-FromGit_RUN.ps1"
]);

var errors = [];

function exists(relative) {
    return fs.existsSync(path.join(root, relative));
}

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

["tools/install", "scripts", "test", "docs", "public", "web", "core", "modules"].forEach(function (relative) {
    if (!exists(relative)) errors.push("Missing repository directory: " + relative);
});

["tools/install/Install-MyCompany-FromGit.ps1", "tools/install/Install-MyCompany-FromGit_RUN.ps1", "docs/REPOSITORY-LAYOUT.md"].forEach(function (relative) {
    if (!exists(relative)) errors.push("Missing canonical layout file: " + relative);
});

fs.readdirSync(root, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isFile() || !/\.ps1$/i.test(entry.name)) return;
    if (!allowedRootPowerShell.has(entry.name)) {
        errors.push("PowerShell implementation must not live in repository root: " + entry.name);
    }
});

allowedRootPowerShell.forEach(function (name) {
    if (!exists(name)) return;
    var source = read(name);
    if (source.indexOf("tools\\install") < 0 && source.indexOf("tools/install") < 0) {
        errors.push("Root PowerShell file must be a compatibility launcher only: " + name);
    }
});

var architecture = read("docs/REPOSITORY-LAYOUT.md");
[
    "server/modules/approvalcenter/index.js",
    "public/modules/approvalcenter/index.js",
    "public/portal/",
    "public/native/",
    "public/shared/",
    "web/admin/"
].forEach(function (value) {
    if (architecture.indexOf(value) < 0) errors.push("Repository layout documentation is incomplete: " + value);
});

var serverApproval = exists("modules/ApprovalCenter/index.js") ? read("modules/ApprovalCenter/index.js") : "";
var browserApprovalPath = exists("public/modules/approvalcenter.js")
    ? "public/modules/approvalcenter.js"
    : exists("public/approvalcenter.js") ? "public/approvalcenter.js" : "";
if (!serverApproval || serverApproval.indexOf("module.exports.createModule") < 0) {
    errors.push("Approval Center backend module is missing or invalid.");
}
if (!browserApprovalPath || read(browserApprovalPath).indexOf("window.MyCompanyModules.approvalcenter") < 0) {
    errors.push("Approval Center browser renderer is missing or invalid.");
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Repository layout validation: OK");
console.log("Approval Center backend/frontend separation: OK");
