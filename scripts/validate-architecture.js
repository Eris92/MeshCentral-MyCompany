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
    "public/mycommands.js",
    "public/shared-ui/toolbar.js",
    "public/shared-ui/toolbar-api.js",
    "public/shared-ui/toolbar-config.js",
    "public/shared-ui/tabs.js",
    "public/shared-ui/layout.js",
    "public/shared-ui/settings.js",
    "public/shared-ui/status-nav.js",
    "public/shared-ui/tree.js",
    "public/shared-ui/catalog.js",
    "public/shared-ui/results.js",
    "public/shared-ui/page.js",
    "seed/MyScripts",
    "seed/MyCommands"
];

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

function validateArchitecture() {
    var errors = [];

    required.forEach(function (relative) {
        if (!fs.existsSync(path.join(root, relative))) {
            errors.push("Missing: " + relative);
        }
    });

    var config = JSON.parse(read("config.json").replace(/^\uFEFF/, ""));
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

    var runtimeSource = read("core/runtime.js");
    if (runtimeSource.indexOf('"seed", "MyScripts"') < 0) {
        errors.push("Runtime must resolve MyScripts from seed/MyScripts.");
    }
    if (runtimeSource.indexOf('"seed", "MyCommands"') < 0) {
        errors.push("Runtime must resolve MyCommands from seed/MyCommands.");
    }

    var myScriptsModule = read("modules/MyScripts/index.js");
    if (myScriptsModule.indexOf('context.pluginRoot, "seed", "MyScripts"') < 0) {
        errors.push("MyScripts must read directly from seed/MyScripts.");
    }

    var myCommandsModule = read("modules/MyCommands/index.js");
    if (myCommandsModule.indexOf('context.pluginRoot, "seed", "MyCommands"') < 0) {
        errors.push("MyCommands must read directly from seed/MyCommands.");
    }
    if (myCommandsModule.indexOf('type: "mycommands"') < 0 ||
        myCommandsModule.indexOf("approvalResults") < 0) {
        errors.push("MyCommands results must use the shared approval workflow.");
    }

    var treeSource = read("public/shared-ui/tree.js");
    if (treeSource.indexOf("iconData") < 0) {
        errors.push("Shared directory tree must render embedded folder icons.");
    }
    if (treeSource.indexOf("mc-tree-folder-body") < 0) {
        errors.push("Shared directory tree must expand folders in the middle column.");
    }
    if (treeSource.indexOf("if (!graphic)") < 0) {
        errors.push("Folder expand arrows must be hidden when a folder graphic exists.");
    }

    var toolbarSource = read("public/shared-ui/toolbar.js");
    if (toolbarSource.indexOf("root.hidden = Object.keys(context.buttons).length === 0") < 0) {
        errors.push("Empty module toolbars must be hidden.");
    }

    ["myscripts", "mycommands"].forEach(function (name) {
        var source = read("public/" + name + ".js");
        if (source.indexOf("window.SharedCatalogView.mount") < 0) {
            errors.push(name + " must use the shared Results and folder catalog navigation.");
        }
        if (source.indexOf("window.SharedResultsView.mountStatus") < 0 ||
            source.indexOf("window.SharedResultsView.mountTable") < 0) {
            errors.push(name + " must use shared status filters and result tables.");
        }
        if (source.indexOf("tabs: []") < 0) {
            errors.push(name + " must not render top tabs.");
        }
        ["search", "collapse", "link"].forEach(function (button) {
            if (source.indexOf(button + ": { side: \"left\"") < 0) {
                errors.push(name + " must show the left toolbar button: " + button);
            }
        });
        ["favorites", "manage", "refresh", "clear", "settings"].forEach(function (button) {
            if (source.indexOf(button + ": false") < 0) {
                errors.push(name + " must disable top button: " + button);
            }
        });
        if (source.indexOf("search: shell.state.search") < 0 ||
            source.indexOf("q: shell.state.search") < 0) {
            errors.push(name + " Search must filter folders and result tables.");
        }
    });

    var catalogSource = read("public/shared-ui/catalog.js");
    if (catalogSource.indexOf("mc-catalog-navigation") < 0 ||
        catalogSource.indexOf("▤ Results") < 0) {
        errors.push("Shared catalog must integrate Results with the folder navigation.");
    }
    if (catalogSource.indexOf("mc-catalog-separator") >= 0) {
        errors.push("Shared catalog must not use the hard Results separator.");
    }

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
