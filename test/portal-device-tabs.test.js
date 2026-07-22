"use strict";
var assert = require("assert"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
var tabs = read("public/portal-device-tabs.js");
var css = read("public/portal-device-tabs.css");
var main = read("plugin-main.js");
var admin = read("MyCompanyAdmin.js");
[
    'name: "ALL | Wszystkie"',
    'className = "sirk-device-tab-close"',
    'state.cache.appendChild',
    'state.view.appendChild(state.panes[key].fragment)',
    'window.dispatchEvent(new Event("resize"))',
    'disconnectPane(pane)',
    'data-view="devices"'
].forEach(function (value) { assert(tabs.indexOf(value) >= 0, "Missing persistent device tab contract: " + value); });
[
    ".sirk-device-tabs",
    "height:32px",
    ".sirk-device-tab.is-active",
    ".sirk-device-tab-close",
    ".sirk-device-tab-cache"
].forEach(function (value) { assert(css.indexOf(value) >= 0, "Missing compact device tab CSS: " + value); });
assert(main.indexOf('style("mycompany-device-tabs-style", "portal-device-tabs.css")') >= 0, "Device tab CSS must load in browser bootstrap");
assert(main.indexOf('load("mycompany-device-tabs-script", asset("portal-device-tabs.js"))') >= 0, "Device tab script must load in browser bootstrap");
assert(admin.indexOf('"portal-device-tabs.js"') >= 0 && admin.indexOf('"portal-device-tabs.css"') >= 0, "Admin asset server must expose device tab assets");
console.log("Persistent Portal device workspace tabs: OK");
