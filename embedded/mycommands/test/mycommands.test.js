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
    var temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mycommands-test-"));
    var scripts = path.join(temporary, "mycommands", "scripts");
    fs.mkdirSync(scripts, { recursive: true });
    var scriptPath = path.join(scripts, "table.ps1");
    fs.writeFileSync(scriptPath, "# Test table\r\n# Approval_1: true\r\n# Approval_2: true\r\n# Approval_3: true\r\n#VariableRequired: $Name, Name\r\nWrite-Output $Name", "utf8");
    var requester = { _id: "user/domain/requester", name: "requester", domain: "domain", siteadmin: 0xFFFFFFFF };
    var node = { _id: "node/domain/device1", name: "Device 1", meshid: "mesh/domain/source", agent: { id: 10 } };
    var events = [], sends = 0, module;
    var agent = {
        dbNodeKey: node._id,
        authenticated: 2,
        agentInfo: {},
        send: function (text) {
            sends++;
            var command = JSON.parse(text), table = { columns: ["Name", "Enabled"], rows: [{ Name: "Alice", Enabled: true }, { Name: "Bob", Enabled: false }] };
            var encoded = Buffer.from(JSON.stringify(table), "utf8").toString("base64");
            setTimeout(function () { module.captureAgentData({ action: "msg", type: "runcommands", responseid: command.responseid, result: "__MYCOMMANDS_BEGIN__\n__MYCOMMANDS_TABLE_B64__" + encoded + "\n__MYCOMMANDS_END__" }, agent); }, 20);
        }
    };
    var webServer = {
        users: { "user/domain/requester": requester },
        userGroups: {},
        wsagents: { "node/domain/device1": agent },
        GetNodeWithRights: function (domain, user, nodeId, callback) { callback(nodeId === node._id ? node : null, 24, true); },
        CreateNodeDispatchTargets: function () { return ["*", node._id]; },
        DispatchEvent: function (targets, source, event) { events.push(event); }
    };
    var meshServer = { webserver: webServer, config: { domains: { domain: { id: "domain" } } }, DispatchEvent: webServer.DispatchEvent };
    webServer.parent = meshServer;
    var parent = { fs: fs, path: path, pluginPath: temporary, parent: meshServer };
    module = createModule({ version: "test", credentialsEnabled: false, approvalExecutionTimeoutSeconds: 30 }, parent, {});
    var bus = core.ensureApprovalBus(parent);
    try {
        await expectRejected(function () { return module.submitApproval(requester, { nodeid: node._id, pluginaction: "runScript", scriptPath: "table.ps1", variableValues: { Name: "Alice" } }, "note"); }, /Approval Center is not installed/i);
        bus.setService({
            submit: async function (type, user, payload, note) {
                var provider = bus.getProvider(type), validated = await provider.validate(payload, user);
                return { id: "request-1", status: "pending", type: type, requester: { id: user._id, name: user.name }, requesterNote: note, payload: validated.payload, fields: validated.fields };
            }
        });
        var pending = await module.submitApproval(requester, { nodeid: node._id, pluginaction: "runScript", scriptPath: "table.ps1", variableValues: { Name: "Alice" } }, "test note");
        assert.strictEqual(pending.status, "pending");
        var approvalDefinition = await bus.getProvider("mycommands").validate({ nodeid: node._id, pluginaction: "runScript", scriptPath: "table.ps1", variableValues: { Name: "Alice" } }, requester);
        assert.deepStrictEqual(approvalDefinition.approvalLevels, [1, 2, 3]);
        assert.strictEqual(sends, 0, "Submitting must not send a command to the agent.");
        var provider = bus.getProvider("mycommands");
        var result = await provider.execute(pending.payload, pending, "execution-1");
        assert.strictEqual(sends, 1);
        assert.strictEqual(result.data.table.rows.length, 2);
        assert.deepStrictEqual(result.data.table.columns, ["Name", "Enabled"]);
        assert.ok(events.some(function (event) { return event.action === "runcommands"; }));

        var changed = await provider.validate({ nodeid: node._id, pluginaction: "runScript", scriptPath: "table.ps1", variableValues: { Name: "Alice" } }, requester);
        fs.appendFileSync(scriptPath, "\r\nWrite-Output changed", "utf8");
        await expectRejected(function () { return provider.execute(changed.payload, { requester: { id: requester._id, name: requester.name } }, "execution-2"); }, /changed after approval/i);
        assert.strictEqual(sends, 1);
        console.log("My Commands approval tests passed.");
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
