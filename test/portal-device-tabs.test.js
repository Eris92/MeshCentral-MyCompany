"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var tabs = read("public/portal-device-tabs.js");
var css = read("public/portal-device-tabs.css");
var main = read("plugin-main.js");
var admin = read("MyCompanyAdmin.js");
var standalone = read("public/portal-standalone.html");
[
    'var STORAGE_KEY = "mycompany.sirkportal.deviceTabs"',
    'document.getElementById("sirkStandaloneRoot")',
    'shell.appendChild(state.cache)',
    'function allLabel()',
    'language() === "en" ? "All" : "Wszystkie"',
    'className = "sirk-device-tab-close"',
    'className = "sirk-device-tab-store"',
    'state.panes.all = { key: "all"',
    'function activeKeyFromDom()',
    'function stashVisible()',
    'function activateAll()',
    'function showStored(key)',
    'if (!contentIsDeviceList()) stashVisible()',
    'moveChildren(state.content, pane.store)',
    'moveChildren(pane.store, state.content)',
    'data-device-workspace-key',
    'activate(key)',
    'localStorage.setItem(STORAGE_KEY',
    'function restoreMetadata()',
    'function scheduleRestore()',
    'findDeviceRow(pane.nodeId)',
    'contentIsWorkspace()',
    'window.MyCompanyDeviceTabs',
    'debug: function ()',
    'disconnectPane(pane)',
    'sirkportal:languagechange'
].forEach(function (value) { assert(tabs.indexOf(value) >= 0, "Missing persistent standalone device tab contract: " + value); });
assert(tabs.indexOf('document.getElementById("sirkPortalRoot")') < 0, "Workspace cache must stay inside sirkStandaloneRoot so the native renderer still owns moved device rows");
assert(tabs.indexOf("DocumentFragment") < 0, "Device tabs must not store live workspaces in consumable DocumentFragment objects");
assert(tabs.indexOf("cloneChildren") < 0, "All devices must be stored as live DOM, not a cloned snapshot");
[
    ".sirk-device-tabs",
    "height:32px",
    ".sirk-device-tab.is-active",
    ".sirk-device-tab-close",
    ".sirk-device-tab-cache",
    ".sirk-device-tabs-standalone:not([hidden]) + #sirkStandaloneContent"
].forEach(function (value) { assert(css.indexOf(value) >= 0, "Missing compact device tab CSS: " + value); });
assert(css.indexOf('#sirkPortalRoot [data-view="devices"]') < 0, "Device workspace CSS must not resize the sidebar navigation button");
assert(main.indexOf('style("mycompany-device-tabs-style", "portal-device-tabs.css")') >= 0, "Device tab CSS must load in native browser bootstrap");
assert(main.indexOf('load("mycompany-device-tabs-script", asset("portal-device-tabs.js"))') >= 0, "Device tab script must load in native browser bootstrap");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.css?v=__VERSION__') >= 0, "Standalone Portal must load device tab CSS");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.js?v=__VERSION__') >= 0, "Standalone Portal must load device tab script");
assert(admin.indexOf('"portal-device-tabs.js"') >= 0 && admin.indexOf('"portal-device-tabs.css"') >= 0, "Admin asset server must expose device tab assets");
console.log("Persistent Portal device workspace tabs: OK");