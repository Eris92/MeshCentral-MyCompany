"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var core = require("../core.js");
var createModule = require("../module.js").createModule;

async function expectRejected(work, pattern) {
    var error = null;
    try { await work(); } catch (caught) { error = caught; }
    assert.ok(error, "Expected the operation to fail.");
    assert.match(String(error.message || error), pattern);
}

async function run() {
    var temporary = fs.mkdtempSync(path.join(os.tmpdir(), "moverequest-test-"));
    var sourceMesh = { _id: "mesh/domain/source", name: "Source", mtype: 2 };
    var targetMesh = { _id: "mesh/domain/target", name: "Target", mtype: 2 };
    var node = { _id: "node/domain/device1", name: "Device 1", meshid: sourceMesh._id };
    var requester = { _id: "user/domain/requester", name: "requester", domain: "domain", siteadmin: 0 };
    var approver = { _id: "user/domain/approver", name: "approver", domain: "domain", siteadmin: 0xFFFFFFFF };
    var events = [], databaseWrites = 0, agentUpdates = 0;
    var database = {
        Set: function () { databaseWrites++; },
        Get: function (id, callback) { callback(null, []); }
    };
    var webServer = {
        meshes: { "mesh/domain/source": sourceMesh, "mesh/domain/target": targetMesh },
        users: { "user/domain/requester": requester, "user/domain/approver": approver },
        wsagents: { "node/domain/device1": { sendUpdatedIntelAmtPolicy: function () { agentUpdates++; } } },
        GetNodeWithRights: function (domain, user, nodeId, callback) { callback(nodeId === node._id ? node : null, 1, true); },
        GetAllMeshWithRights: function () { return [sourceMesh, targetMesh, targetMesh]; },
        GetMeshRights: function () { return 1; },
        cleanDevice: function (value) { return value; },
        CreateMeshDispatchTargets: function (meshId, targets) { return ["*", meshId].concat(targets); }
    };
    var meshServer = {
        webserver: webServer,
        db: database,
        config: { domains: { domain: { id: "domain" } } },
        DispatchEvent: function (targets, source, event) { events.push(event); },
        mqttbroker: { changeDeviceMesh: function () { } },
        mpsserver: { changeDeviceMesh: function () { } }
    };
    webServer.parent = meshServer;
    var parent = { fs: fs, path: path, pluginPath: temporary, parent: meshServer };
    var module = createModule({ version: "test" }, parent, {});
    var bus = core.ensureApprovalBus(parent);
    try {
        await expectRejected(function () { return module.submit(requester, node._id, targetMesh._id, "before service"); }, /Approval Center is not installed/i);
        bus.setService({
            submit: async function (type, user, payload, note) {
                var provider = bus.getProvider(type), validated = await provider.validate(payload, user);
                return { id: "request-1", type: type, status: "pending", requester: { id: user._id, name: user.name }, requesterNote: note, payload: validated.payload, fields: validated.fields };
            }
        });

        var groups = await module.getGroups(requester, node._id);
        assert.deepStrictEqual(groups.groups.map(function (group) { return group.name; }), ["Source", "Target"]);
        var pending = await module.submit(requester, node._id, targetMesh._id, "move it");
        assert.strictEqual(pending.status, "pending");
        assert.strictEqual(node.meshid, sourceMesh._id, "Submitting must not move the device.");
        assert.strictEqual(databaseWrites, 0);

        var provider = bus.getProvider("moverequest");
        assert.strictEqual(provider.finalStatusOnSuccess, "approved");
        var result = await provider.execute(pending.payload, { id: pending.id, requester: pending.requester, approver: { id: approver._id, name: approver.name } });
        assert.match(result.message, /Device moved to Target/i);
        assert.strictEqual(node.meshid, targetMesh._id);
        assert.strictEqual(databaseWrites, 1);
        assert.strictEqual(agentUpdates, 1);
        assert.ok(events.some(function (event) { return event.action === "nodemeshchange"; }));

        await provider.execute(pending.payload, { id: pending.id, approver: { id: approver._id, name: approver.name } });
        assert.strictEqual(databaseWrites, 1, "An idempotent retry must not write the move twice.");
        console.log("Move Request provider tests passed.");
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
