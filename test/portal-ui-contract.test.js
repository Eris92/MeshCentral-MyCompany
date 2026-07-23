"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

var nav = read("public/portal/standalone/scripts/navigation.js");
var deviceCss = read("public/native/device-tabs.css");
var contractCss = read("public/vendor/sirk-portal/portal-ui-contract.css");
var contractJs = read("public/vendor/sirk-portal/portal-ui-contract.js");
var moduleShell = read("public/shared/module-shell.js");
var sharedPage = read("public/shared/ui/page.js");
var management = read("public/modules/automation/index.js");
var adminLayout = read("web/admin/admin-layout.js");
var standalone = read("public/portal/standalone/index.html");

[
    "public/modules/commands/index.js",
    "public/modules/approvals/index.js",
    "public/modules/jira/index.js",
    "public/modules/security/index.js"
].forEach(function (file) {
    assert(
        read(file).indexOf("window.SirkPlatformModuleShell.create") >= 0,
        file + " must mount through SirkPlatformModuleShell"
    );
});

[
    "mc-portal-module-shell",
    "mc-portal-module-toolbar",
    "mc-portal-module-workspace",
    "mc-portal-module-layout",
    "mc-portal-module-primary",
    "mc-portal-module-secondary",
    "mc-portal-module-details"
].forEach(function (className) {
    assert(
        sharedPage.indexOf(className) >= 0 || moduleShell.indexOf(className) >= 0,
        "Shared Portal shell is missing " + className
    );
});

[
    "--mc-ui-primary-width: 184px",
    "--mc-ui-secondary-width: 236px",
    "--mc-ui-secondary-edit-width: 440px",
    "--mc-ui-collapsed-width: 56px",
    ".mc-portal-nav-item",
    ".mc-portal-nav-icon",
    ".mc-portal-nav-label",
    ".mc-portal-card",
    ".mc-portal-button",
    ".mc-portal-table-wrap",
    ".mc-portal-table"
].forEach(function (value) {
    assert(contractCss.indexOf(value) >= 0, "Canonical Portal CSS is missing: " + value);
});

[
    "decorateNavigation",
    "decorateTables",
    "decorateActions",
    "decorateToolbar",
    "decorateShell",
    "decorateSettingsFrame",
    "observer.observe(root, { childList: true, subtree: true })",
    "ensureFrameStyle"
].forEach(function (value) {
    assert(contractJs.indexOf(value) >= 0, "Canonical Portal runtime is missing: " + value);
});

assert(
    contractJs.indexOf("observer.observe(document.documentElement") < 0,
    "Canonical UI observer must stay scoped to #sirkPortalRoot"
);
assert(
    contractJs.indexOf('adminRoot.id = "sirkPortalRoot"') >= 0,
    "Embedded Settings must receive an isolated Portal style root"
);

[
    "vendor/sirk-portal/portal-ui-contract.css",
    "vendor/sirk-portal/portal-ui-contract.js"
].forEach(function (value) {
    assert(nav.indexOf(value) >= 0, "Portal must load the canonical contract: " + value);
});

[
    "preserveActiveDeviceWorkspace",
    "restoreActiveDeviceWorkspace",
    "moveChildren",
    "flattenManagementHost",
    "installLayoutStyle",
    "15000",
    'content.style.visibility = "hidden"'
].forEach(function (value) {
    assert(nav.indexOf(value) < 0, "Legacy Portal layout mutation must not return: " + value);
});

[
    "is-management-collapsed",
    "is-management-edit-mode",
    "sirk-management-workspace",
    "mc-shared-primary",
    "color-mix"
].forEach(function (value) {
    assert(deviceCss.indexOf(value) < 0, "Device tabs CSS must not style another module: " + value);
});

assert(
    management.indexOf('window.SirkPlatformModuleShell.create') >= 0,
    "Management must expose the canonical module shell"
);
assert(
    management.indexOf('preset: "myscripts"') >= 0,
    "Automation must use the canonical shared shell preset"
);
assert(
    adminLayout.indexOf("mc-portal-module-shell") >= 0 &&
    adminLayout.indexOf("mc-portal-module-layout") >= 0 &&
    adminLayout.indexOf("mc-portal-module-primary") >= 0 &&
    adminLayout.indexOf("mc-portal-module-secondary") >= 0 &&
    adminLayout.indexOf("mc-portal-module-details") >= 0,
    "Settings administration must use the same canonical shell and columns"
);
assert(
    adminLayout.indexOf('layout.classList.toggle("is-collapsed"') >= 0,
    "Settings collapse must resize the real shared layout"
);
assert(
    standalone.indexOf("portal-module-shell.css?v=__VERSION__") >= 0,
    "Standalone Portal must load its scoped module shell stylesheet"
);

console.log("Canonical SirK Portal UI contract: OK");
