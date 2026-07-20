"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
[
    "core.js",
    "module.js",
    "extensions.js",
    "extensions-v2.js",
    "extensions-v3.js",
    "plugin-v2.js",
    "plugin-v3.js",
    "plugin-v4.js",
    "plugin-v5.js",
    "plugin-v6.js",
    "myscripts.js",
    "public/core.js",
    "public/main.js",
    "public/enhancements.js",
    "public/ui-fixes.js",
    "public/ui-polish.js",
    "public/ui-final.js",
    "public/ui-actions.js",
    "public/defender-integration.js",
    "public/reports-integration.js",
    "public/ui-layout-v3.js",
    "public/ui-stability-v4.js"
].forEach(function (relative) {
    var result = childProcess.spawnSync(process.execPath, ["--check", path.join(root, relative)], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, relative + " failed syntax validation:\n" + (result.stderr || result.stdout || ""));
});

var packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
var config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
var installConfig = JSON.parse(fs.readFileSync(path.join(root, "install-config.json"), "utf8"));
assert.strictEqual(packageJson.version, config.version, "package.json and config.json versions differ");
assert.strictEqual(config.version, installConfig.version, "config.json and install-config.json versions differ");
assert.match(fs.readFileSync(path.join(root, "myscripts.js"), "utf8"), /plugin-v6\.js/);
assert.ok(fs.readFileSync(path.join(root, "plugin-v6.js"), "utf8").indexOf('set("v", "' + config.version + '")') >= 0, "Final frontend asset cache version differs from config version");

assert.ok(!fs.existsSync(path.join(root, "data", "credentials.json")), "Runtime credential store must not be committed");
assert.ok(!fs.existsSync(path.join(root, "data", "script-secrets.json")), "Runtime script secrets must not be committed");
assert.ok(!fs.existsSync(path.join(root, "data", "folder-permissions.json")), "Runtime folder permissions must not be committed");

var uiFixes = fs.readFileSync(path.join(root, "public", "ui-fixes.js"), "utf8");
var uiCss = fs.readFileSync(path.join(root, "public", "ui-fixes.css"), "utf8");
var uiPolish = fs.readFileSync(path.join(root, "public", "ui-polish.js"), "utf8");
var uiPolishCss = fs.readFileSync(path.join(root, "public", "ui-polish.css"), "utf8");
var uiActions = fs.readFileSync(path.join(root, "public", "ui-actions.js"), "utf8");
var uiActionsCss = fs.readFileSync(path.join(root, "public", "ui-actions.css"), "utf8");
var uiLayoutV3 = fs.readFileSync(path.join(root, "public", "ui-layout-v3.js"), "utf8");
var uiLayoutV3Css = fs.readFileSync(path.join(root, "public", "ui-layout-v3.css"), "utf8");
var uiStabilityV4 = fs.readFileSync(path.join(root, "public", "ui-stability-v4.js"), "utf8");
var uiStabilityV4Css = fs.readFileSync(path.join(root, "public", "ui-stability-v4.css"), "utf8");
var defenderIntegration = fs.readFileSync(path.join(root, "public", "defender-integration.js"), "utf8");
var reportsIntegration = fs.readFileSync(path.join(root, "public", "reports-integration.js"), "utf8");
var backendCore = fs.readFileSync(path.join(root, "core.js"), "utf8");
var backendWrapper = fs.readFileSync(path.join(root, "plugin-v3.js"), "utf8");
var incidentsScript = fs.readFileSync(path.join(root, "scripts", "Defender", "Incidents.ps1"), "utf8");
var listUsersReport = fs.readFileSync(path.join(root, "scripts", "Raporty", "Active Directory", "List AD users.ps1"), "utf8");
var recentUsersReport = fs.readFileSync(path.join(root, "scripts", "Raporty", "Active Directory", "Users created recently.ps1"), "utf8");

assert.match(uiFixes, /MyScriptsManageButton/);
assert.match(uiFixes, /MyScriptsSearchToggle/);
assert.match(uiFixes, /renderAutomationWorkspace/);
assert.match(uiFixes, /renderMonitoringWorkspace/);
assert.match(uiFixes, /Zabbix API/);
assert.match(uiFixes, /colorResultRows/);
assert.match(uiFixes, /history\.replaceState/);
assert.match(uiCss, /myscripts-search\[hidden\]/);
assert.match(uiCss, /myscripts-result-status-completed/);
assert.match(uiPolish, /prepareDeepLink/);
assert.match(uiPolish, /deepLinkAppliedPath/);
assert.match(uiPolish, /normalizeFavorites/);
assert.match(uiPolishCss, /myscripts-favorite-button\.active/);
assert.match(uiActions, /setActionVisible/);
assert.match(uiActions, /claimAction/);
assert.match(uiActions, /placeActions/);
assert.match(uiActionsCss, /flex: 1 1 auto/);
assert.match(uiLayoutV3, /favoritesOnly/);
assert.match(uiLayoutV3, /folderMenuCollapsed/);
assert.match(uiLayoutV3, /selectedRoot/);
assert.match(uiLayoutV3, /data-mesh-user-group-id/);
assert.match(uiLayoutV3Css, /--myscripts-script-width: 275px/);
assert.match(uiStabilityV4, /selectedPathByRoot/);
assert.match(uiStabilityV4, /openDeepLink/);
assert.match(uiStabilityV4, /button\.click\(\)/);
assert.match(uiStabilityV4, /renderJiraWorkspace/);
assert.match(uiStabilityV4, /MyScriptsEmbeddedJira/);
assert.match(uiStabilityV4, /stabilizeToolbar/);
assert.match(uiStabilityV4Css, /myscripts-folder-body/);
assert.match(uiStabilityV4Css, /margin: 0 0 5px/);
assert.match(uiStabilityV4Css, /myscripts-toolbar-button-stable/);
assert.match(uiStabilityV4Css, /myscripts-jira-workspace/);
assert.match(backendCore, /candidate\.userGroups/);
assert.match(backendCore, /candidate\.usergroups/);
assert.match(defenderIntegration, /Microsoft Defender \/ Graph/);
assert.match(defenderIntegration, /SecurityIncident\.Read\.All/);
assert.match(incidentsScript, /MYSCRIPTS_ENTRA_TENANT_ID/);
assert.match(incidentsScript, /security\/incidents/);
assert.match(reportsIntegration, /Preview full report result/);
assert.match(reportsIntegration, /myscripts-result-view-button/);
assert.match(listUsersReport, /meshTable/);
assert.match(recentUsersReport, /meshTable/);
assert.match(backendWrapper, /automation-enable/);
assert.match(backendWrapper, /\/ENABLE/);
assert.match(fs.readFileSync(path.join(root, "extensions.js"), "utf8"), /Task Scheduler/);

console.log("My Scripts static checks passed.");
