"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var source = fs.readFileSync(path.join(__dirname, "..", "public", "core.js"), "utf8");
var documentMock = { addEventListener: function () {} };
var windowMock = { location: { href: "https://mesh.local/" }, console: console };
vm.runInNewContext(source, { window: windowMock, document: documentMock, URL: URL, Promise: Promise, encodeURIComponent: encodeURIComponent });
var core = windowMock.MeshPluginCore;

function item(tagName, classes) {
  var attributes = {};
  var names = classes || [];
  return {
    tagName: tagName,
    classList: { contains: function (name) { return names.indexOf(name) >= 0; } },
    removeAttribute: function (name) { delete attributes[name]; },
    setAttribute: function (name, value) { attributes[name] = value; },
    getAttribute: function (name) { return attributes[name]; }
  };
}

var classicCalls = 0;
var classic = item("DIV", ["lbbutton"]);
classic.onmouseup = function () { classicCalls++; };
core.preparePluginMenuItem(classic);
assert.strictEqual(typeof classic.onmouseup, "function");
assert.strictEqual(classic.onclick, null);
classic.onkeypress({ key: "Enter" });
assert.strictEqual(classicCalls, 1);

var modernCalls = 0;
var modern = item("A", ["nav-link"]);
modern.onclick = function () { modernCalls++; };
core.preparePluginMenuItem(modern);
assert.strictEqual(typeof modern.onclick, "function");
assert.strictEqual(modern.onmouseup, null);
assert.strictEqual(modern.getAttribute("href"), "#");
modern.onclick();
assert.strictEqual(modernCalls, 1);
assert.strictEqual(core.apiMajor, 3);
assert.strictEqual(core.buildHash, "mesh-plugin-core-3.0.0-20260718");
console.log("Shared Core Classic/Modern tests passed");
