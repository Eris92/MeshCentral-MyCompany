"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var tabs = read("public/portal-device-tabs.js");
var css = read("public/portal-device-tabs.css");
var main = read("plugin-main.js");
var admin = read("MyCompanyAdmin.js");
var standalone = read("public/portal-standalone.html");
[
    'name: "ALL | Wszystkie"',
    'className = "sirk-device-tab-close"',
    'className = "sirk-device-tab-store"',
    'document.getElementById("sirkStandaloneContent")',
    'content.closest(".sirk-standalone-main")',
    'main.insertBefore(state.bar, content)',
    '.sirk-standalone-sidebar .sirk-device-tabs',
    'moveChildren(state.content, pane.store)',
    'moveChildren(pane.store, state.content)',
    'window.MyCompanyDeviceTabs',
    'disconnectPane(pane)'
].forEach(function (value) { assert(tabs.indexOf(value) >= 0, "Missing persistent standalone device tab contract: " + value); });
assert(tabs.indexOf("DocumentFragment") < 0, "Device tabs must not store live workspaces in consumable DocumentFragment objects");
assert(tabs.indexOf('root.querySelector(\'[data-view="devices"]\')') < 0, "Standalone tabs must not resolve the sidebar navigation button as the Devices workspace");
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
