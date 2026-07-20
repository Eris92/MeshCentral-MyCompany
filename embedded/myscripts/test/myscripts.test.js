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
    var frontendSource = fs.readFileSync(path.join(__dirname, "..", "public", "main.js"), "utf8");
    assert.match(frontendSource, /search\.placeholder = "Search"/);
    assert.match(frontendSource, /Search scripts by name, comment or description/);
    assert.match(frontendSource, /node\.name, node\.label, node\.description, node\.path/);
    var temporary = fs.mkdtempSync(path.join(os.tmpdir(), "myscripts-test-"));
    var scripts = path.join(temporary, "myscripts", "scripts", "Examples");
    var approvalScripts = path.join(temporary, "myscripts", "scripts", "ApprovalTests");
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(approvalScripts, { recursive: true });
    var scriptPath = path.join(approvalScripts, "approval-test.ps1");
    var relativePath = "ApprovalTests/approval-test.ps1";
    var source = [
        "# Run approval test | Confirms the approval path without changing the system.",
        "# Approval: true",
        "# Approval_2: true",
        "# Approval_3: true",
        "# VariableRequired: $Message, Message",
        "Write-Output (\"approved:\" + [string]$Message)"
    ].join("\r\n");
    fs.writeFileSync(scriptPath, source, "utf8");
    fs.writeFileSync(path.join(scripts, "Examples.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "utf8");
    fs.writeFileSync(path.join(scripts, "direct-test.ps1"), "# Direct test | Runs directly in the Examples folder.\r\n# Approval: false\r\nWrite-Output direct", "utf8");
    fs.writeFileSync(path.join(approvalScripts, "ApprovalTests.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "utf8");
    fs.writeFileSync(path.join(approvalScripts, "legacy.ps1"), "# Legacy\r\n# Approval: true\r\n# SaveSecretRequired: $Token, Token\r\nWrite-Output ok", "utf8");
    var jiraScripts = path.join(temporary, "myscripts", "scripts", "Jira");
    fs.mkdirSync(jiraScripts, { recursive: true });
    fs.writeFileSync(path.join(jiraScripts, "Protocol.ps1"), "# Protokół | Test kreatora Jira.\r\n# VariableUserRequired: $JiraUser,Użytkownik z Jira\r\n# VariableAssetRequired: $PcName,Sprzęt przypisany do użytkownika\r\nWrite-Output ok", "utf8");
    var settings = path.join(temporary, "myscripts", "settings");
    fs.mkdirSync(settings, { recursive: true });
    fs.writeFileSync(path.join(settings, "users_list.json"), JSON.stringify({ GeneratedAt: "2026-07-17T12:00:00Z", Users: [{ DisplayName: "Żaneta Test", Login: "z.test@example.test" }, { DisplayName: "Adam Test", Login: "a.test@example.test" }, { DisplayName: "Adam Test", Login: "duplicate@example.test" }] }), "utf8");

    var events = [];
    var parent = {
        fs: fs,
        path: path,
        pluginPath: temporary,
        db: { GetAllType: function (type, callback) { callback(null, [{ _id: "user/domain/a", name: "a", realname: "Anna Test" }, { _id: "user/domain/b", name: "b", realname: "Bartek Test" }]); } },
        parent: { webserver: { userGroups: {}, DispatchEvent: function (targets, plugin, event) { events.push(event); } } }
    };
    var bus = core.ensureApprovalBus(parent);
    var submitted = [];
    bus.setService({
        submit: async function (type, user, payload, note) {
            var provider = bus.getProvider(type);
            var validated = await Promise.resolve(provider.validate(payload, user));
            var request = { id: "pending-1", status: "pending", requester: { id: user._id, name: user.name }, requesterNote: note, payload: validated.payload, fields: validated.fields };
            submitted.push(request);
            return request;
        }
    });

    var module = createModule({ version: "test", runTimeoutSeconds: 30, credentialsEnabled: false }, parent, {});
    var admin = { _id: "user/domain/admin", name: "admin", siteadmin: 0xFFFFFFFF };
    try {
        var tree = module.getTree(admin);
        var examples = tree.children.filter(function (item) { return item.name === "Examples"; })[0];
        assert.ok(examples);
        assert.strictEqual(examples.icon, "Examples/Examples.svg");
        var directScript = examples.children.filter(function (item) { return item.path === "Examples/direct-test.ps1"; })[0];
        assert.strictEqual(directScript.requiresApproval, false);
        assert.deepStrictEqual(directScript.approvalLevels, []);
        var approvalTests = tree.children.filter(function (item) { return item.name === "ApprovalTests"; })[0];
        assert.ok(approvalTests);
        var script = approvalTests.children.filter(function (item) { return item.path === relativePath; })[0];
        assert.strictEqual(script.label, "Run approval test");
        assert.match(script.description, /approval path/i);
        assert.deepStrictEqual(script.approvalLevels, [1, 2, 3]);
        assert.strictEqual(script.requiresApproval, true);
        assert.strictEqual(script.variables[0].name, "Message");
        var jira = tree.children.filter(function (item) { return item.name === "Jira"; })[0];
        var protocol = jira.children.filter(function (item) { return item.path === "Jira/Protocol.ps1"; })[0];
        assert.strictEqual(protocol.variables[0].control, "user");
        assert.strictEqual(protocol.variables[1].control, "asset");
        var choices = module.getUserChoices(admin);
        assert.deepStrictEqual(choices.choices.map(function (item) { return item.value; }), ["Adam Test", "Żaneta Test"]);
        assert.strictEqual(choices.generatedAt, "2026-07-17T12:00:00Z");
        var meshUsers = await module.getMeshUsers(admin);
        assert.deepStrictEqual(meshUsers.choices.map(function (item) { return item.value; }), ["admin", "Anna Test", "Bartek Test"]);
        assert.strictEqual(meshUsers.current, "admin");
        assert.deepStrictEqual(module.getAccess(admin), { allowed: true, siteAdmin: true });
        assert.deepStrictEqual(module.getAccess({ _id: "user/domain/plain", name: "plain", siteadmin: 0, links: {} }), { allowed: false, siteAdmin: false });

        var direct = await module.executeDirect(admin, { scriptPath: "Examples/direct-test.ps1", variableValues: {} });
        assert.match(direct.message, /direct/i);

        var pending = await module.submit(admin, { scriptPath: relativePath, variableValues: { Message: "hello" } }, "test note");
        assert.strictEqual(pending.status, "pending");
        assert.deepStrictEqual(submitted[0].payload.scriptPath, relativePath);
        assert.strictEqual(submitted.length, 1);
        assert.ok(!events.some(function (event) { return event.action === "myscriptsexecuted" && event.requestid === "pending-1"; }));

        var provider = bus.getProvider("myscripts");
        var result = await provider.execute(submitted[0].payload, submitted[0]);
        assert.match(result.message, /approved:hello/i);
        assert.ok(events.some(function (event) { return event.action === "myscriptsexecuted"; }));

        var validated = await provider.validate({ scriptPath: relativePath, variableValues: { Message: "unchanged" } }, admin);
        fs.appendFileSync(scriptPath, "\r\nWrite-Output changed", "utf8");
        await expectRejected(function () { return provider.execute(validated.payload, { id: "changed", requester: { id: admin._id, name: admin.name } }); }, /changed after approval/i);
        await expectRejected(function () { return provider.validate({ scriptPath: "ApprovalTests/legacy.ps1", variableValues: {} }, admin); }, /Configure credential/i);
        console.log("My Scripts contract tests passed.");
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
