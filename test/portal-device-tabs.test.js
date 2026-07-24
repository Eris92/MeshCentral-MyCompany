"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var tabs = read("public/native/device-tabs.js");
var css = read("public/native/device-tabs.css");
var contractCss = read("public/vendor/sirk-portal/portal-ui-contract.css");
var management = read("public/modules/automation/index.js");
var main = read("plugin-main.js");
var admin = read("admin.js");
var standalone = read("public/portal/standalone/index.html");
var standaloneCore = read("public/portal/standalone/scripts/core.js");
[
    'var STORAGE_KEY = "sirkPortal.deviceTabs"',
    'var CHILD_PARAM = "sirkWorkspaceChild"',
    'var NODE_PARAM = "sirkWorkspaceNode"',
    'function startChildWorkspace()',
    'document.documentElement.classList.add("sirk-device-workspace-child")',
    'function createHostFrame(pane)',
    'frame.className = "sirk-device-isolated-frame"',
    'frame.src = workspaceUrl(pane)',
    'frame.allow = "clipboard-read; clipboard-write; fullscreen"',
    'function ensurePane(key, nodeId, name, createFrame)',
    'state.layer.appendChild(pane.element)',
    'function showPane(key)',
    'function activateAll()',
    'function closeTab(key)',
    'window.addEventListener("click", intercept, true)',
    'localStorage.setItem(STORAGE_KEY',
    'mode: "persistent-session-layer"',
    'window.SirkPlatformDeviceTabs'
].forEach(function (value) { assert(tabs.indexOf(value) >= 0, "Missing persistent device workspace contract: " + value); });
assert(tabs.indexOf("DocumentFragment") < 0, "Device tabs must keep connected iframe containers");
assert(tabs.indexOf("stopBridge") < 0, "Parent tab manager must not stop a session owned by another host iframe");
assert(tabs.indexOf('tab.addEventListener("click"') < 0, "Tab actions must use the stable parent capture handler");
[
    ".sirk-device-tabs",
    "height:54px",
    ".sirk-device-session-layer",
    ".sirk-device-session-pane",
    ".sirk-device-isolated-frame",
    "html.sirk-device-workspace-child"
].forEach(function (value) { assert(css.indexOf(value) >= 0, "Missing persistent workspace CSS: " + value); });
assert(css.indexOf('#sirkPortalRoot [data-view="devices"]') < 0, "Device workspace CSS must not resize the sidebar navigation button");
[
    "is-management-collapsed",
    "is-management-edit-mode",
    "sirk-management-workspace",
    "mc-shared-primary",
    "background:color-mix"
].forEach(function (value) { assert(css.indexOf(value) < 0, "Device tabs CSS must not style Management: " + value); });
assert(management.indexOf('tools.toggleEdit(toolbar, module.api.render)') >= 0, "Automation must expose Edit through the shared module shell");
assert(contractCss.indexOf("--mc-ui-collapsed-width: 56px") >= 0, "Canonical contract must define the collapsed primary width");
assert(contractCss.indexOf("--mc-ui-secondary-edit-width: 440px") >= 0, "Canonical contract must define the edit secondary width");
assert(contractCss.indexOf("background: transparent !important") >= 0, "Canonical primary icon containers must stay transparent");
assert(main.indexOf('style("sirk-platform-device-tabs-style", "portal-device-tabs.css")') >= 0, "Device tab CSS must load in native browser bootstrap");
assert(main.indexOf('["sirk-platform-device-tabs", "portal-device-tabs.js"]') >= 0, "Device tab script must load in native browser bootstrap");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.css?v=__VERSION__') >= 0, "Standalone Portal must load device tab CSS");
assert(standalone.indexOf('__ASSET_BASE__/portal-device-tabs.js?v=__VERSION__') >= 0, "Standalone Portal must load device tab script");
assert(admin.indexOf('"portal-device-tabs.js"') >= 0 && admin.indexOf('"portal-device-tabs.css"') >= 0, "Admin asset server must expose device tab assets");
assert(standaloneCore.indexOf('root.style.visibility = "hidden"') >= 0, "Portal must stay hidden until permissions and the requested workspace are ready");
assert(standaloneCore.indexOf('content.style.visibility = "hidden"') < 0, "Startup must not independently blank the Devices content surface");
assert(standaloneCore.indexOf("new MutationObserver") < 0, "Portal startup must not observe and react to the complete DOM tree");
assert(standaloneCore.indexOf("15000") < 0, "Portal startup must not use the old 15 second timeout");
assert(standaloneCore.indexOf("window.setInterval(checkReady, 50)") >= 0, "Portal startup must use bounded deterministic readiness checks");
assert(standaloneCore.indexOf("window.setTimeout(reveal, 3000)") >= 0, "Portal startup must always have a short safety fallback");
assert(standaloneCore.indexOf("function bootstrapReady()") >= 0, "Portal must wait for bootstrap permissions");
assert(standaloneCore.indexOf("function menuReady()") >= 0, "Portal must wait until menu visibility is configured");
assert(standaloneCore.indexOf("function childWorkspaceReady()") >= 0, "Child workspace must restore its selected device tab before reveal");
assert(standaloneCore.indexOf("function parentWorkspaceReady()") >= 0, "Parent Portal must wait for the selected host iframe");
assert(standaloneCore.indexOf('childDocument.getElementById("sirkStandaloneRoot")') >= 0, "Parent Portal must verify that the child workspace finished booting");
console.log("Persistent multi-host Portal startup and isolated device tabs CSS: OK");
