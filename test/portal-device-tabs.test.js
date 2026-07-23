"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var tabs = read("public/portal-device-tabs.js");
var css = read("public/portal-device-tabs.css");
var main = read("plugin-main.js");
var admin = read("MyCompanyAdmin.js");
var standalone = read("public/portal-standalone.html");
var standaloneCore = read("public/standalone-core.js");
[
    'var STORAGE_KEY = "mycompany.sirkportal.deviceTabs"',
    'var CHILD_PARAM = "sirkWorkspaceChild"',
    'var NODE_PARAM = "sirkWorkspaceNode"',
    'function startChildWorkspace()',
    'document.documentElement.classList.add("sirk-device-workspace-child")',
    'function createHostFrame(pane)',
    'frame.className = "sirk-device-isolated-frame"',
    'frame.src = workspaceUrl(pane)',
    'frame.allow = "clipboard-read; clipboard-write; fullscreen"',
    'function createStore(key)',
    'function stashActive()',
    'function showPane(key)',
    'function activateAll()',
    'function closeTab(key)',
    'window.addEventListener("click", intercept, true)',
    'localStorage.setItem(STORAGE_KEY',
    'mode: "isolated-iframes"',
    'window.MyCompanyDeviceTabs'
].forEach(function (value) { assert(tabs.indexOf(value) >= 0, "Missing isolated device workspace contract: " + value); });
assert(tabs.indexOf("DocumentFragment") < 0, "Device tabs must keep connected iframe containers");
assert(tabs.indexOf("stopBridge") < 0, "Parent tab manager must not stop a session owned by another host iframe");
assert(tabs.indexOf('tab.addEventListener("click"') < 0, "Tab actions must use the stable parent capture handler");
[
    ".sirk-device-tabs",
    "height:32px",
    ".sirk-device-isolated-workspace",
    ".sirk-device-isolated-frame",
    "html.sirk-device-workspace-child",
    ".sirk-device-tab-cache"
].forEach(function (value) { assert(css.indexOf(value) >= 0, "Missing isolated workspace CSS: " + value); });
assert(css.indexOf('#sirkPortalRoot [data-view="devices"]') < 0, "Device workspace CSS must not resize the sidebar navigation button");
assert(main.indexOf('style("mycompany-device-tabs-style", "portal-device-tabs.css")') >= 0, "Device tab CSS must load in native browser bootstrap");
assert(main.indexOf('load("mycompany-device-tabs-script", asset("portal-device-tabs.js"))') >= 0, "Device tab script must load in native browser bootstrap");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.css?v=__VERSION__') >= 0, "Standalone Portal must load device tab CSS");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.js?v=__VERSION__') >= 0, "Standalone Portal must load device tab script");
assert(admin.indexOf('"portal-device-tabs.js"') >= 0 && admin.indexOf('"portal-device-tabs.css"') >= 0, "Admin asset server must expose device tab assets");
assert(standaloneCore.indexOf('root.style.visibility = "hidden"') < 0, "F5 startup must never hide the complete Portal root");
assert(standaloneCore.indexOf('content.style.visibility = "hidden"') < 0, "Device child startup must not blank the complete workspace content");
assert(standaloneCore.indexOf("15000") < 0, "F5 startup must not use a 15 second reveal timeout");
assert(standaloneCore.indexOf('window.setTimeout(reveal, 1200)') >= 0, "Child workspace restore must have a short bounded fallback");
assert(standaloneCore.indexOf('if (!child) {\n                reveal();') >= 0, "Main Portal must reveal immediately without waiting for host restore");
assert(standaloneCore.indexOf('nav.style.visibility = "hidden"') >= 0, "Only the unconfigured navigation list may be hidden during bootstrap");
assert(standaloneCore.indexOf('runtime.state.bootstrap') >= 0, "Navigation must reveal only after bootstrap permissions are available");
console.log("Isolated multi-host Portal device sessions: OK");