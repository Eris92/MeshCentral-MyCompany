"use strict";

var assert = require("assert");
var compat = require("../server/core/express-route-compat.js");

var registrations = [];
var app = {
    get: function (route, handler) {
        registrations.push({ route: route, handler: handler });
    }
};

compat.withExactPortalRedirect(app, function () {
    app.get("/sirkportal", function redirectHandler() {});
    app.get("/sirkportal/", function portalHandler() {});
    app.get("/other", function otherHandler() {});
});

assert.strictEqual(registrations.length, 3);
assert.ok(registrations[0].route instanceof RegExp, "Redirect route must be exact RegExp.");
assert.strictEqual(registrations[0].route.test("/sirkportal"), true);
assert.strictEqual(registrations[0].route.test("/sirkportal/"), false, "Redirect route must not match the slash URL.");
assert.strictEqual(registrations[1].route, "/sirkportal/", "Portal page route must remain unchanged.");
assert.strictEqual(registrations[2].route, "/other", "Unrelated routes must remain unchanged.");
assert.strictEqual(typeof app.get, "function", "Original app.get must be restored.");

console.log("Portal exact redirect route: OK");
