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
    "public/shared-ui/script-tools.js",
    "public/shared-ui/page.js",
    "seed/MyScripts",
    "seed/MyCommands"
];

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

function includes(source, value, error, errors) {
    if (source.indexOf(value) < 0) errors.push(error);
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
    includes(runtimeSource, '"seed", "MyScripts"', "Runtime must resolve MyScripts from seed/MyScripts.", errors);
    includes(runtimeSource, '"seed", "MyCommands"', "Runtime must resolve MyCommands from seed/MyCommands.", errors);

    var librarySource = read("core/script-library.js");
    includes(librarySource, "allowWrite", "Script library must support controlled source editing.", errors);
    includes(librarySource, "saveSource", "Script library must expose source saving.", errors);
    includes(librarySource, "multiHost", "Script library must parse MultiHost metadata.", errors);

    var myScriptsModule = read("modules/MyScripts/index.js");
    includes(myScriptsModule, 'context.pluginRoot, "seed", "MyScripts"', "MyScripts must read directly from seed/MyScripts.", errors);
    includes(myScriptsModule, 'asset === "source"', "MyScripts must expose the Site Admin source editor endpoint.", errors);
    includes(myScriptsModule, "allowWrite: true", "MyScripts source editing must be explicitly enabled.", errors);

    var myCommandsModule = read("modules/MyCommands/index.js");
    includes(myCommandsModule, 'context.pluginRoot, "seed", "MyCommands"', "MyCommands must read directly from seed/MyCommands.", errors);
    includes(myCommandsModule, "approvalResults", "MyCommands results must use the shared approval workflow.", errors);
    includes(myCommandsModule, 'asset === "multi-execute"', "MyCommands must expose multi-device execution.", errors);
    includes(myCommandsModule, "maxMultiHostNodes", "MyCommands multi-device execution must enforce a host limit.", errors);
    includes(myCommandsModule, "multiHostConcurrency", "MyCommands multi-device execution must enforce concurrency.", errors);
    includes(myCommandsModule, 'asset === "source"', "MyCommands must expose the Site Admin source editor endpoint.", errors);

    var treeSource = read("public/shared-ui/tree.js");
    includes(treeSource, "iconData", "Shared directory tree must render embedded folder icons.", errors);
    includes(treeSource, "mc-tree-folder-body", "Shared directory tree must expand folders in the middle column.", errors);
    includes(treeSource, "if (!graphic)", "Folder expand arrows must be hidden when a folder graphic exists.", errors);
    includes(treeSource, "scriptActions", "Shared directory tree must support inline script actions.", errors);
    includes(treeSource, "mc-tree-script-actions", "Inline script actions need a dedicated container.", errors);

    var toolbarSource = read("public/shared-ui/toolbar.js");
    includes(toolbarSource, "root.hidden = Object.keys(context.buttons).length === 0", "Empty module toolbars must be hidden.", errors);
    includes(toolbarSource, "if (context.buttons.search) left.appendChild(searchWrap)", "Search input must follow the last left toolbar button.", errors);
    includes(toolbarSource, "right.hidden = right.childNodes.length === 0", "Empty right toolbar groups must be removed.", errors);

    var toolbarConfig = read("public/shared-ui/toolbar-config.js");
    includes(toolbarConfig, 'refresh: {\n            title: "Refresh"', "Refresh must be a shared toolbar action.", errors);
    includes(toolbarConfig, 'multi: {\n            title: "Multi-device execution"', "Multi-device must be a shared toolbar action.", errors);
    includes(toolbarConfig, "order: 70", "Search must be the last left toolbar action.", errors);

    var cssSource = read("public/shared-ui/shared-ui.css");
    if (
        cssSource.indexOf("grid-template-columns:64px") < 0 ||
        cssSource.indexOf(".mc-shared-layout.is-collapsed .mc-shared-primary .mc-tree-label{display:none}") < 0
    ) {
        errors.push("Collapsed navigation must remain as a 64px icon rail.");
    }
    var toolbarCss = read("public/shared-ui/toolbar.css");
    includes(toolbarCss, ".mc-tree-script-actions", "Inline script actions must be styled.", errors);
    includes(toolbarCss, ".mc-script-editor", "The source editor must be styled.", errors);
    includes(toolbarCss, ".mc-multi-node-list", "The multi-device selector must be styled.", errors);

    var scriptToolsSource = read("public/shared-ui/script-tools.js");
    includes(scriptToolsSource, "favoritesOnly", "Shared script tools must provide Favorites filtering.", errors);
    includes(scriptToolsSource, "linkPickMode", "Copy link must provide original link-pick behavior.", errors);
    includes(scriptToolsSource, "editMode", "Shared script tools must provide Edit mode.", errors);
    includes(scriptToolsSource, "multiPickMode", "Shared script tools must provide command-only multi-pick mode.", errors);
    includes(scriptToolsSource, "scriptActions", "Shared script tools must provide per-script actions.", errors);

    ["myscripts", "mycommands"].forEach(function (name) {
        var source = read("public/" + name + ".js");
        includes(source, "window.SharedCatalogView.mount", name + " must use the shared Results and folder catalog navigation.", errors);
        includes(source, "window.SharedResultsView.mountStatus", name + " must use shared status filters.", errors);
        includes(source, "window.SharedResultsView.mountTable", name + " must use shared result tables.", errors);
        includes(source, "window.SharedScriptTools.create", name + " must use shared Favorites, link and Edit behavior.", errors);
        includes(source, "scriptActions:", name + " must render inline script actions.", errors);
        includes(source, 'manage: {\n                title: "Edit"', name + " must label the pencil action as Edit.", errors);
        includes(source, 'refresh: {\n                side: "left",\n                order: 50', name + " must place Refresh on the left.", errors);
        includes(source, 'search: { side: "left", order: 70 }', name + " Search must be the last left toolbar action.", errors);
        includes(source, "clear: false", name + " must remove the duplicate Clear action.", errors);
        includes(source, "search: shell.state.search", name + " Search must filter script folders.", errors);
        includes(source, "q: shell.state.search", name + " Search must filter result tables.", errors);
        includes(source, "tabs: []", name + " must not render top tabs.", errors);
    });

    var myScriptsUi = read("public/myscripts.js");
    includes(myScriptsUi, "multi: false", "Multi-device toolbar action must be hidden in MyScripts.", errors);

    var myCommandsUi = read("public/mycommands.js");
    includes(myCommandsUi, 'multi: {\n                title: "Multi-device execution"', "Multi-device toolbar action must exist only in MyCommands.", errors);
    includes(myCommandsUi, "openMultiEditor", "MyCommands must open the per-script multi-device selector.", errors);
    includes(myCommandsUi, 'shell.post("multi-execute"', "MyCommands must submit multi-device execution.", errors);

    var catalogSource = read("public/shared-ui/catalog.js");
    includes(catalogSource, "mc-catalog-navigation", "Shared catalog must integrate Results with folder navigation.", errors);
    includes(catalogSource, 'icon.textContent = "▤"', "Results must retain its icon when navigation is collapsed.", errors);
    includes(catalogSource, "scriptActions: options.scriptActions", "Catalog must pass inline actions to the tree.", errors);
    if (catalogSource.indexOf("mc-catalog-separator") >= 0) {
        errors.push("Shared catalog must not use the hard Results separator.");
    }

    if (errors.length) {
        errors.forEach(function (error) { console.error(error); });
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
