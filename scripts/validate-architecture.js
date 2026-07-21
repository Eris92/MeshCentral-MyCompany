"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var root = path.resolve(__dirname, "..");
var required = [
    "MyCompany.js",
    "plugin-main.js",
    "MyCompanyAdmin.js",
    "config.json",
    "core/runtime.js",
    "core/approval-service.js",
    "core/atomic-json.js",
    "core/settings-store.js",
    "core/script-library.js",
    "modules/ApprovalCenter/index.js",
    "modules/MoveRequests/index.js",
    "modules/MyCommands/index.js",
    "modules/MyScripts/index.js",
    "modules/MyJira/index.js",
    "modules/DefenderTools/index.js",
    "public/approvalcenter.js",
    "public/myscripts.js",
    "public/shared-ui/toolbar.js",
    "public/shared-ui/toolbar-api.js",
    "public/shared-ui/toolbar-config.js",
    "public/shared-ui/tabs.js",
    "public/shared-ui/layout.js",
    "public/shared-ui/settings.js",
    "public/shared-ui/status-nav.js",
    "public/shared-ui/tree.js",
    "public/shared-ui/page.js",
    "seed/MyScripts",
    "seed/MyCommands"
];

function validateArchitecture() {
    var errors = [];

    required.forEach(function (relative) {
        if (!fs.existsSync(path.join(root, relative))) {
            errors.push("Missing: " + relative);
        }
    });

    var config = JSON.parse(
        fs.readFileSync(path.join(root, "config.json"), "utf8")
            .replace(/^\uFEFF/, "")
    );

    if (config.shortName !== "MyCompany") {
        errors.push("config.shortName must be MyCompany.");
    }
    if (config.version !== "1.3.1") {
        errors.push("config.version must be 1.3.1.");
    }

    var entrypoints = fs.readdirSync(root).filter(function (name) {
        return name.toLowerCase() === "mycompany.js";
    });

    if (entrypoints.length !== 1 || entrypoints[0] !== "MyCompany.js") {
        errors.push("Exactly one case-insensitive MyCompany.js entrypoint is required.");
    }
    if (fs.existsSync(path.join(root, ".gitmodules"))) {
        errors.push(".gitmodules is not allowed.");
    }
    if (fs.existsSync(path.join(root, "legacy"))) {
        errors.push("legacy source directory is not allowed.");
    }

    var runtimeSource = fs.readFileSync(
        path.join(root, "core", "runtime.js"),
        "utf8"
    );
    if (runtimeSource.indexOf('"seed", "MyScripts"') < 0) {
        errors.push("Runtime must resolve MyScripts from seed/MyScripts.");
    }
    if (runtimeSource.indexOf('"seed", "MyCommands"') < 0) {
        errors.push("Runtime must resolve MyCommands from seed/MyCommands.");
    }

    var myScriptsModuleSource = fs.readFileSync(
        path.join(root, "modules", "MyScripts", "index.js"),
        "utf8"
    );
    if (myScriptsModuleSource.indexOf('context.pluginRoot, "seed", "MyScripts"') < 0) {
        errors.push("MyScripts must read directly from seed/MyScripts.");
    }

    var treeSource = fs.readFileSync(
        path.join(root, "public", "shared-ui", "tree.js"),
        "utf8"
    );
    if (treeSource.indexOf("iconData") < 0) {
        errors.push("Shared directory tree must render embedded folder icons.");
    }
    if (treeSource.indexOf("mc-tree-folder-body") < 0) {
        errors.push("Shared directory tree must expand folders in the middle column.");
    }
    if (treeSource.indexOf("if (!graphic)") < 0) {
        errors.push("Folder expand arrows must be hidden when a folder graphic exists.");
    }

    var toolbarConfigSource = fs.readFileSync(
        path.join(root, "public", "shared-ui", "toolbar-config.js"),
        "utf8"
    );
    if (!/manage:\s*\{[^}]*side:\s*"left"/.test(toolbarConfigSource)) {
        errors.push("Manage must be in the left toolbar group.");
    }
    if (!/search:\s*\{[^}]*side:\s*"left"/.test(toolbarConfigSource)) {
        errors.push("Search must be in the left toolbar group.");
    }

    var myScriptsClientSource = fs.readFileSync(
        path.join(root, "public", "myscripts.js"),
        "utf8"
    );
    [
        "refreshScripts",
        "clearView",
        "copySelectedLink",
        "toggleManage",
        "toggleFavorites"
    ].forEach(function (functionName) {
        if (myScriptsClientSource.indexOf("function " + functionName) < 0) {
            errors.push("MyScripts toolbar handler is missing: " + functionName);
        }
    });

    if (errors.length) {
        errors.forEach(function (error) {
            console.error(error);
        });
        throw new Error("Architecture validation failed.");
    }
}

function validateSettingsWriter() {
    var atomicJson = require(path.join(root, "core", "atomic-json.js"));
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "mycompany-settings-"));
    var filePath = path.join(directory, "settings.json");

    return atomicJson.write(fs, path, filePath, {
        version: 1,
        enabled: true
    }).then(function () {
        return atomicJson.write(fs, path, filePath, {
            version: 2,
            enabled: false
        });
    }).then(function () {
        var value = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (value.version !== 2 || value.enabled !== false) {
            throw new Error("Settings writer returned invalid data.");
        }

        var leftovers = fs.readdirSync(directory).filter(function (name) {
            return /\.(tmp|bak)$/.test(name);
        });
        if (leftovers.length) {
            throw new Error("Settings writer left temporary files: " + leftovers.join(", "));
        }
    }).finally(function () {
        fs.rmSync(directory, { recursive: true, force: true });
    });
}

Promise.resolve()
    .then(validateArchitecture)
    .then(validateSettingsWriter)
    .then(function () {
        console.log("Architecture validation: OK");
        console.log("Settings writer validation: OK");
    })
    .catch(function (error) {
        console.error(error && error.stack || error);
        process.exit(1);
    });
