"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var css = fs.readFileSync(path.join(__dirname, "..", "public", "portal", "vendor", "sirk-portal.css"), "utf8");

assert(css.indexOf("--sirk-view-radius:10px") >= 0, "global Portal radius token is missing");
assert(css.indexOf(".sirk-standalone-content>.sirk-portal-view-host") >= 0, "Portal view host must own the global surface");
assert(css.indexOf(".sirk-portal-view-host>.sirk-platform-management-host") >= 0, "Management host normalization is missing");
assert(css.indexOf(".sirk-portal-view-host .mc-portal-module-shell") >= 0, "inner module shells must be normalized by the global surface contract");
assert(css.indexOf("border:0!important;border-radius:0!important") >= 0, "inner frames must not draw a second border");

console.log("portal-global-surface.test.js: OK");
