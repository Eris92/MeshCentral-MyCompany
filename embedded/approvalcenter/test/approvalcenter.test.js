"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var core = require("../core.js");
var createModule = require("../module.js").createModule;

async function run() {
    var temporary = fs.mkdtempSync(path.join(os.tmpdir(), "approvalcenter-test-"));
    fs.mkdirSync(path.join(temporary, "approvalcenter"), { recursive: true });
    var events = [];
    var admin = { _id: "user/domain/admin", name: "admin", siteadmin: 0xFFFFFFFF, links: {} };
    var requester = { _id: "user/domain/requester", name: "requester", links: { "ugrp/domain/level1": {} } };
    var level1 = { _id: "user/domain/level1", name: "level1", links: { "ugrp/domain/level1": {} } };
    var level2 = { _id: "user/domain/level2", name: "level2", links: { "ugrp/domain/level2": {} } };
    var level3 = { _id: "user/domain/level3", name: "level3", links: { "ugrp/domain/level3": {} } };
    var allLevels = { _id: "user/domain/all", name: "all-levels", links: { "ugrp/domain/level1": {}, "ugrp/domain/level2": {}, "ugrp/domain/level3": {} } };
    var webServer = {
        userGroups: { "ugrp/domain/level1": { _id: "ugrp/domain/level1", name: "Level 1" }, "ugrp/domain/level2": { _id: "ugrp/domain/level2", name: "Level 2" }, "ugrp/domain/level3": { _id: "ugrp/domain/level3", name: "Level 3" } },
        users: { "user/domain/admin": admin, "user/domain/requester": requester, "user/domain/level1": level1, "user/domain/level2": level2, "user/domain/level3": level3, "user/domain/all": allLevels },
        DispatchEvent: function (targets, source, event) { events.push(event); }
    };
    var parent = { fs: fs, path: path, pluginPath: temporary, parent: { webserver: webServer } };
    var service = createModule({ version: "test", viewmode: 105 }, parent, {});
    var executionCount = 0;
    core.ensureApprovalBus(parent).registerProvider({
        type: "sample",
        title: "Sample",
        columns: [{ key: "device", label: "Device" }],
        finalStatusOnSuccess: "completed",
        validate: function (payload) { return { payload: payload, approvalLevels: payload.approvalLevels, resourceKey: payload.device, summary: "Sample " + payload.device, fields: { device: payload.device } }; },
        api: { payloadSchema: { type: "object" }, resources: function () { return { values: ["pc-1"] }; } },
        execute: function () { executionCount++; return Promise.resolve({ message: "done" }); }
    });
    try {
        await service.initialize();
        var first = await service.submit("sample", admin, { device: "pc-1" }, "first");
        var second = await service.submit("sample", admin, { device: "pc-1" }, "second");
        var history = await service.list(admin, { type: "sample", status: "", page: 1, perPage: 20 });
        assert.strictEqual(history.total, 2);
        assert.strictEqual(history.rows.filter(function (row) { return row.status === "replaced"; }).length, 1);
        assert.strictEqual(history.rows.filter(function (row) { return row.status === "pending"; }).length, 1);
        assert.strictEqual(second.status, "pending");
        var overview = await service.overview(admin);
        var overviewCard = overview.filter(function (card) { return card.provider.type === "sample"; })[0];
        assert.strictEqual(overviewCard.pending.length, 1);
        assert.strictEqual(overviewCard.pending[0].fields.device, "pc-1");
        assert.strictEqual(Object.prototype.hasOwnProperty.call(overviewCard, "recent"), false);
        await service.saveProviderSettings(admin, "sample", "", "0");
        assert.strictEqual((await service.overview(admin)).filter(function (card) { return card.provider.type === "sample"; }).length, 0);
        assert.strictEqual((await service.getSettings(admin)).providers.filter(function (provider) { return provider.type === "sample"; })[0].enabled, false);
        await service.saveProviderSettings(admin, "sample", "", "1");
        var decisions = await Promise.allSettled([
            service.decide(admin, second.id, "approve", "ok"),
            service.decide(admin, second.id, "approve", "duplicate")
        ]);
        assert.strictEqual(decisions.filter(function (item) { return item.status === "fulfilled"; }).length, 1);
        assert.strictEqual(decisions.filter(function (item) { return item.status === "rejected"; }).length, 1);
        await new Promise(function (resolve) { setTimeout(resolve, 100); });
        history = await service.list(admin, { type: "sample", status: "", page: 1, perPage: 20 });
        assert.strictEqual(history.rows.filter(function (row) { return row.id === second.id; })[0].status, "completed");
        assert.strictEqual(executionCount, 1);
        await service.saveProviderSettings(admin, "sample", { 1: "ugrp/domain/level1", 2: "ugrp/domain/level2", 3: "ugrp/domain/level3" }, "1");
        var layered = await service.submit("sample", requester, { device: "pc-levels", approvalLevels: [1, 2, 3] }, "three levels");
        assert.strictEqual(layered.approvalLevel, 1);
        await assert.rejects(function () { return service.decide(requester, layered.id, "approve", "self"); }, /own request/i);
        var afterLevel1 = await service.decide(level1, layered.id, "approve", "L1");
        assert.strictEqual(afterLevel1.status, "pending");
        assert.strictEqual(afterLevel1.approvalLevel, 2);
        assert.strictEqual(afterLevel1.approvalProgress, "1/3");
        await assert.rejects(function () { return service.decide(allLevels, layered.id, "approve", "wrong highest level"); }, /level 2/i);
        assert.strictEqual(executionCount, 1);
        await assert.rejects(function () { return service.decide(level1, layered.id, "approve", "wrong level"); }, /level 2/i);
        var afterLevel2 = await service.decide(level2, layered.id, "approve", "L2");
        assert.strictEqual(afterLevel2.status, "pending");
        assert.strictEqual(afterLevel2.approvalLevel, 3);
        assert.strictEqual(afterLevel2.approvalProgress, "2/3");
        var afterLevel3 = await service.decide(level3, layered.id, "approve", "L3");
        assert.strictEqual(afterLevel3.status, "approved");
        await new Promise(function (resolve) { setTimeout(resolve, 100); });
        var layeredFinal = await service.getRequest(admin, layered.id, []);
        assert.strictEqual(layeredFinal.status, "completed");
        assert.strictEqual(layeredFinal.approvalDecisions.length, 3);
        assert.strictEqual(layeredFinal.approvalProgress, "3/3");
        assert.strictEqual(layeredFinal.approver1, "level1");
        assert.strictEqual(layeredFinal.approver2, "level2");
        assert.strictEqual(layeredFinal.approver3, "level3");
        assert.strictEqual(layeredFinal.approverNote1, "L1");
        assert.strictEqual(layeredFinal.approverNote2, "L2");
        assert.strictEqual(layeredFinal.approverNote3, "L3");
        assert.strictEqual(executionCount, 2);
        assert.ok(events.some(function (event) { return event.action === "approvalrequestsubmitted"; }));
        assert.ok(first.id !== second.id);
        var apiToken = service.createApiClient(admin, { name: "Automated test", userId: admin._id, scopes: service.apiScopes, providerTypes: ["sample"] });
        assert.ok(/^ac1_/.test(apiToken.token));
        assert.strictEqual(JSON.stringify(service.getSettings(admin)).indexOf(apiToken.token), -1);
        var apiContext = service.authenticateApiToken(apiToken.token);
        service.authorizeApi(apiContext, "requests:submit", "sample");
        var apiFirst = await service.submit("sample", apiContext.user, { device: "pc-api" }, "API", { idempotencyKey: "submit-0001", apiClientId: apiContext.client.id, apiClientName: apiContext.client.name });
        var apiRetry = await service.submit("sample", apiContext.user, { device: "pc-api" }, "API", { idempotencyKey: "submit-0001", apiClientId: apiContext.client.id, apiClientName: apiContext.client.name });
        assert.strictEqual(apiRetry.id, apiFirst.id);
        var apiDecision = await service.decide(apiContext.user, apiFirst.id, "approve", "External approval", { idempotencyKey: "decision-0001", apiClientId: apiContext.client.id, apiClientName: apiContext.client.name });
        var apiDecisionRetry = await service.decide(apiContext.user, apiFirst.id, "approve", "External approval", { idempotencyKey: "decision-0001", apiClientId: apiContext.client.id, apiClientName: apiContext.client.name });
        assert.strictEqual(apiDecisionRetry.id, apiDecision.id);
        await new Promise(function (resolve) { setTimeout(resolve, 100); });
        assert.strictEqual((await service.getRequest(admin, apiFirst.id, [])).status, "completed");
        assert.deepStrictEqual(await service.getProviderResources("sample", apiContext.user, {}), { values: ["pc-1"] });
        service.revokeApiClient(admin, apiContext.client.id);
        assert.throws(function () { service.authenticateApiToken(apiToken.token); }, /valid bearer token/i);
        console.log("Approval Center contract tests passed.");
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
