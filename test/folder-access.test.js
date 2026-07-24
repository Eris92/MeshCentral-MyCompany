"use strict";

var assert = require("assert");
var folderAccess = require("../server/core/folder-access.js");

var regular = { _id: "user/domain/alice", links: { "ugrp/domain/helpdesk": {} } };
var outsider = { _id: "user/domain/bob", links: {} };
var admin = { _id: "user/domain/admin", siteadmin: 0xFFFFFFFF, links: {} };
var rules = {
    Public: { enabled: true, allowAll: true, groupIds: [] },
    Empty: { enabled: true, allowAll: false, groupIds: [] },
    Restricted: { enabled: true, groupIds: ["ugrp/domain/helpdesk"] },
    Disabled: { enabled: false, groupIds: [] }
};

assert.strictEqual(folderAccess.canAccess(regular, rules, "Public"), true);
assert.strictEqual(folderAccess.canAccess(regular, rules, "Empty"), false);
assert.strictEqual(folderAccess.canAccess(outsider, rules, "Empty"), false);
assert.strictEqual(folderAccess.canAccess(admin, rules, "Empty"), true);
assert.strictEqual(folderAccess.canAccess(regular, rules, "Restricted"), true);
assert.strictEqual(folderAccess.canAccess(outsider, rules, "Restricted"), false);
assert.strictEqual(folderAccess.canAccess(admin, rules, "Restricted"), true);
assert.strictEqual(folderAccess.canAccess(admin, rules, "Disabled"), false);

var tree = { type: "directory", path: "", children: [
    { type: "directory", path: "Public", children: [] },
    { type: "directory", path: "Restricted", children: [] },
    { type: "directory", path: "Disabled", children: [] }
] };
assert.deepStrictEqual(folderAccess.filterTree(tree, rules, outsider).children.map(function (item) { return item.path; }), ["Public"]);
assert.deepStrictEqual(folderAccess.filterTree(tree, rules, admin).children.map(function (item) { return item.path; }), ["Public", "Restricted"]);
assert.throws(function () { folderAccess.requirePath(outsider, rules, "Restricted/Script.ps1"); }, /access denied/i);
assert.strictEqual(folderAccess.requirePath(regular, rules, "Restricted/Script.ps1"), "Restricted");

var normalized = folderAccess.normalizeRules({
    Public: { enabled: false, allowAll: true, groupIds: ["ugrp/domain/helpdesk", "unknown", "ugrp/domain/helpdesk"] },
    Injected: { enabled: true, groupIds: [] }
}, ["Public"], ["ugrp/domain/helpdesk"]);
assert.deepStrictEqual(normalized, { Public: { enabled: false, allowAll: true, groupIds: ["ugrp/domain/helpdesk"] } });

var legacy = {
    Public: { enabled: true, groupIds: [] },
    Restricted: { enabled: true, groupIds: ["ugrp/domain/helpdesk"] },
    ExplicitDenied: { enabled: true, allowAll: false, groupIds: [] }
};
assert.strictEqual(folderAccess.migrateLegacyRules(legacy), true);
assert.strictEqual(legacy.Public.allowAll, true);
assert.strictEqual(legacy.Restricted.allowAll, false);
assert.strictEqual(legacy.ExplicitDenied.allowAll, false);
assert.strictEqual(folderAccess.migrateLegacyRules(legacy), false);

console.log("Folder access checks passed.");
