"use strict";

var assert = require("assert");
var path = require("path");
var factory = require("../server/modules/portal/safe.js");

var settingsValue = { modules: { portal: { views: {
    overview: { enabled: true, allowAll: true, groupIds: [] },
    devices: { enabled: true, groupIds: ["ugrp/domain/helpdesk"] },
    approvals: { enabled: false, groupIds: [] }
} } } };
var context = {
    fs: require("fs"),
    nativePath: path,
    pluginRoot: path.resolve(__dirname, ".."),
    parent: { parent: { datapath: path.resolve(__dirname, "fixtures") }, userGroups: {
        "ugrp/domain/helpdesk": { _id: "ugrp/domain/helpdesk", name: "Helpdesk" }
    } },
    settings: {
        read: function () { return settingsValue; },
        update: function (callback) { settingsValue = callback(settingsValue); return Promise.resolve(settingsValue); }
    },
    device: { visibleNodes: function () { throw new Error("Denied users must not reach device inventory."); } }
};
var module = factory.createModule(context);
var helpdesk = { _id: "user/domain/alice", links: { "ugrp/domain/helpdesk": {} } };
var outsider = { _id: "user/domain/bob", links: {} };
var admin = { _id: "user/domain/admin", siteadmin: 0xFFFFFFFF, links: {} };

assert.strictEqual(module.canAccessView(outsider, "overview"), true);
assert.strictEqual(module.canAccessView(outsider, "devices"), false);
assert.strictEqual(module.canAccessView(helpdesk, "devices"), true);
assert.strictEqual(module.canAccessView(admin, "devices"), true);
assert.strictEqual(module.canAccessView(admin, "approvals"), false);

Promise.resolve(module.apiGet("devices", {}, outsider)).then(function () {
    throw new Error("Restricted device view unexpectedly allowed.");
}, function (error) {
    assert.match(String(error && error.message || error), /access denied/i);
    console.log("Portal view access checks passed.");
});
