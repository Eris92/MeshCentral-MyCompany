"use strict";

var crypto = require("crypto");
var Datastore = require("@seald-io/nedb");
var core = require("./core.js");

var API_SCOPES = ["providers:read", "requests:read", "requests:submit", "requests:decide"];

function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000);
}

function safePlainObject(value) {
    try { return JSON.parse(JSON.stringify(value == null ? {} : value)); }
    catch (error) { return {}; }
}

function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function apiError(statusCode, code, message) {
    var error = new Error(message);
    error.statusCode = statusCode;
    error.apiCode = code;
    return error;
}

function tokenHash(value) {
    return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function randomTokenPart(bytes) {
    return crypto.randomBytes(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

module.exports.createModule = function (config, parent, source) {
    var fs = parent.fs;
    var path = parent.path;
    var root = path.join(parent.pluginPath, "approvalcenter");
    var dataRoot = path.join(root, "data");
    var databasePath = path.join(dataRoot, "requests.db");
    var settingsPath = path.join(dataRoot, "settings.json");
    var bus = core.ensureApprovalBus(parent);
    var database = null;
    var readyPromise = null;
    var resourceLocks = Object.create(null);
    var settingsCache = null;

    function repairDatabaseFile() {
        if (!fs.existsSync(databasePath)) return;
        var text;
        try { text = fs.readFileSync(databasePath, "utf8"); } catch (error) { return; }
        var lines = text.split(/\r?\n/), records = [], active = Object.create(null), changed = false;
        lines.forEach(function (line, index) {
            if (!line.trim()) return;
            try {
                var value = JSON.parse(line);
                if (!value || !value._id || !value.activeKey) return;
                var terminal = ["completed", "rejected", "failed", "replaced"].indexOf(String(value.status || "")) >= 0 || (value.status === "approved" && Number(value.executionFinishedAt) > 0);
                if (terminal) { delete value.activeKey; lines[index] = JSON.stringify(value); changed = true; return; }
                if (value.status === "pending") records.push({ line: index, value: value });
            } catch (error) { }
        });
        records.sort(function (a, b) { return Number(b.value.updatedAt || b.value.createdAt || 0) - Number(a.value.updatedAt || a.value.createdAt || 0); });
        records.forEach(function (item) { var key = String(item.value.activeKey || ""); if (!key || !active[key]) { active[key] = item; return; } item.value.status = "replaced"; item.value.approver = { id: "system", name: "system" }; item.value.approverNote = "Duplicate active request repaired automatically."; item.value.updatedAt = Date.now(); item.value.decidedAt = item.value.updatedAt; delete item.value.activeKey; lines[item.line] = JSON.stringify(item.value); changed = true; });
        if (!changed) return;
        var temporary = databasePath + ".repair-" + process.pid + ".tmp";
        fs.writeFileSync(temporary, lines.join("\n"), "utf8");
        try { fs.renameSync(temporary, databasePath); } catch (error) { fs.copyFileSync(temporary, databasePath); fs.unlinkSync(temporary); }
    }
    var clientConfig = {
        name: String(config.name || "Approval Center"),
        shortName: "approvalcenter",
        version: String(config.version || "3.0.5"),
        viewMode: Number(config.viewmode) || 105,
        pageText: String(config.pageText || "Approval Center"),
        leftMenuAsset: String(config.leftMenuIcon || "assets/LeftMenu.svg").replace(/\\/g, "/").split("/").pop()
    };

    function readSettings() {
        if (settingsCache) return safePlainObject(settingsCache);
        var settings = core.readJson(fs, settingsPath, {});
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
        if (!settings.providers || typeof settings.providers !== "object") settings.providers = {};
        if (!Array.isArray(settings.apiClients)) settings.apiClients = [];
        settings.retentionDays = normalizeRetention(settings.retentionDays);
        settings.apiClients = settings.apiClients.map(normalizeApiClient).filter(Boolean);
        settingsCache = settings;
        return safePlainObject(settingsCache);
    }

    function writeSettings(settings) {
        settingsCache = safePlainObject(settings);
        core.writeJsonAtomic(fs, path, settingsPath, settings);
    }

    function normalizeRetention(value) {
        value = parseInt(value, 10);
        return isFinite(value) && value >= 1 && value <= 36500 ? value : 365;
    }

    function getProvider(type) {
        return bus.getProvider(String(type || "").toLowerCase());
    }

    function normalizeApiClient(value) {
        value = value && typeof value === "object" ? value : {};
        var id = cleanText(value.id, 40).toLowerCase();
        var hash = cleanText(value.tokenHash, 128).toLowerCase();
        if (!/^[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{64}$/.test(hash)) return null;
        var scopes = Array.isArray(value.scopes) ? value.scopes.map(String).filter(function (scope, index, list) { return API_SCOPES.indexOf(scope) >= 0 && list.indexOf(scope) === index; }) : [];
        var providerTypes = Array.isArray(value.providerTypes) ? value.providerTypes.map(function (type) { return cleanText(type, 64).toLowerCase(); }).filter(function (type, index, list) { return /^[a-z][a-z0-9_-]{1,63}$/.test(type) && list.indexOf(type) === index; }) : [];
        return {
            id: id,
            name: cleanText(value.name, 120),
            userId: cleanText(value.userId, 300),
            tokenHash: hash,
            tokenPrefix: cleanText(value.tokenPrefix, 24),
            scopes: scopes,
            providerTypes: providerTypes,
            createdAt: Number(value.createdAt) || 0
        };
    }

    function providerEnabled(type, settings) {
        settings = settings || readSettings();
        var providerSettings = settings.providers && settings.providers[type];
        return !providerSettings || providerSettings.enabled !== false;
    }

    function parseProviderEnabled(value, fallback) {
        if (value === undefined || value === null || value === "") return fallback;
        if (value === false || value === 0) return false;
        return !/^(0|false|off|no)$/i.test(String(value));
    }

    function publicApiClient(value) {
        return {
            id: value.id,
            name: value.name,
            userId: value.userId,
            tokenPrefix: value.tokenPrefix,
            scopes: value.scopes.slice(),
            providerTypes: value.providerTypes.slice(),
            createdAt: value.createdAt
        };
    }

    function getUsers() {
        var webServer = core.getWebServer(parent);
        return webServer && webServer.users || {};
    }

    function findUser(userId) {
        userId = String(userId || "");
        var users = getUsers();
        if (users[userId]) return users[userId];
        var ids = Object.keys(users);
        for (var index = 0; index < ids.length; index++) {
            if (String(users[ids[index]] && users[ids[index]]._id || ids[index]) === userId) return users[ids[index]];
        }
        return null;
    }

    function providerMetadata(provider) {
        var columns = Array.isArray(provider && provider.columns) ? provider.columns : [];
        columns = columns.map(function (column) {
            return { key: cleanText(column && column.key, 80), label: cleanText(column && column.label, 120) };
        }).filter(function (column) { return /^[A-Za-z0-9_.-]+$/.test(column.key) && column.label; });
        return {
            type: String(provider.type || "").toLowerCase(),
            title: cleanText(provider.title || provider.type, 100),
            tabTitle: cleanText(provider.tabTitle || provider.title || provider.type, 100),
            description: cleanText(provider.description || "", 500),
            settingsTitle: cleanText(provider.settingsTitle || ((provider.title || provider.type) + " approvers"), 120),
            enabled: providerEnabled(String(provider.type || "").toLowerCase()),
            installUrl: cleanText(provider.installUrl || "", 500),
            version: cleanText(provider.version || "", 40),
            columns: columns,
            api: {
                payloadSchema: safePlainObject(provider.api && provider.api.payloadSchema || {}),
                resources: !!(provider.api && typeof provider.api.resources === "function"),
                resourceDescription: cleanText(provider.api && provider.api.resourceDescription || "", 500)
            }
        };
    }

    function providers() {
        return Object.keys(bus.providers).sort().map(function (type) {
            return providerMetadata(bus.providers[type].descriptor);
        });
    }

    function approverGroupId(type) {
        var settings = readSettings();
        var providerSettings = settings.providers[type] || {};
        var groups = approverGroupIds(type)[1];
        return groups[0] || "";
    }

    function approverGroupIds(type) {
        var settings = readSettings(), providerSettings = settings.providers[type] || {}, values = providerSettings.approverGroupIds || {};
        function normalize(value) {
            value = Array.isArray(value) ? value : (value ? [value] : []);
            return value.map(function (item) { return cleanText(item, 300); }).filter(function (item, index, list) { return item && list.indexOf(item) === index; });
        }
        return {
            1: normalize(values[1] || values["1"] || providerSettings.approverGroupId),
            2: normalize(values[2] || values["2"]),
            3: normalize(values[3] || values["3"])
        };
    }

    function normalizeApprovalLevels(value, allowEmpty) {
        value = Array.isArray(value) ? value : [];
        var levels = value.map(function (level) { return Number(level); }).filter(function (level, index, list) { return level >= 1 && level <= 3 && list.indexOf(level) === index; }).sort();
        return levels.length || allowEmpty === true ? levels : [1];
    }

    function requestApprovalLevels(request) {
        return normalizeApprovalLevels(request && request.requiredApprovalLevels, !!(request && request.allowNoApproval === true));
    }

    function requestApprovalLevel(request) {
        var levels = requestApprovalLevels(request), current = Number(request && request.approvalLevel);
        return levels.indexOf(current) >= 0 ? current : (levels[0] || 0);
    }

    function approvalDecisionForLevel(request, level) {
        var decisions = Array.isArray(request && request.approvalDecisions) ? request.approvalDecisions : [];
        for (var index = decisions.length - 1; index >= 0; index--) {
            if (Number(decisions[index] && decisions[index].level) === Number(level)) return decisions[index];
        }
        return null;
    }

    function approvalSummary(request) {
        var levels = requestApprovalLevels(request), approved = 0;
        levels.forEach(function (level) { if (approvalDecisionForLevel(request, level) && approvalDecisionForLevel(request, level).decision === "approve") approved++; });
        var result = { completed: approved, total: levels.length, progress: approved + "/" + levels.length };
        levels.forEach(function (level) {
            var decision = approvalDecisionForLevel(request, level), approver = decision && decision.approver || {};
            result["approver" + level] = String(approver.name || approver.id || "");
            result["approverNote" + level] = String(decision && decision.note || "");
        });
        // Older records only have the last approver fields. Keep them visible after upgrade.
        if (levels.length && (!Array.isArray(request && request.approvalDecisions) || !request.approvalDecisions.length)) {
            var legacyLevel = levels[levels.length - 1], legacyApprover = request && request.approver || {};
            if (legacyApprover.name || legacyApprover.id) {
                result["approver" + legacyLevel] = String(legacyApprover.name || legacyApprover.id);
                result["approverNote" + legacyLevel] = String(request.approverNote || "");
                if (request.status === "approved" || request.status === "completed") result.completed = result.total;
                result.progress = result.completed + "/" + result.total;
            }
        }
        return result;
    }

    function highestApprovableLevel(user, type, levels) {
        var groups = approverGroupIds(type), highest = 0;
        (levels || [1]).forEach(function (level) { if (groups[Number(level)].some(function (groupId) { return core.isUserInGroup(user, groupId); })) highest = Math.max(highest, Number(level)); });
        return highest;
    }

    function canApprove(user, type, level, requiredLevels) {
        if (core.isSiteAdmin(user)) return true;
        return highestApprovableLevel(user, type, requiredLevels || [level]) === Number(level);
    }

    function canApproveAny(user, type) {
        if (core.isSiteAdmin(user)) return true;
        var groups = approverGroupIds(type);
        return [1, 2, 3].some(function (level) { return groups[level].some(function (groupId) { return core.isUserInGroup(user, groupId); }); });
    }

    function hasConfiguredApprovers(type, levels) {
        var groups = approverGroupIds(type);
        if (Array.isArray(levels) && levels.length === 0) return false;
        return (levels || [1]).every(function (level) { return groups[Number(level)] && groups[Number(level)].length > 0; });
    }

    function approvalLevelsFor(type, validated, payload) {
        var fallback = normalizeApprovalLevels(validated && validated.approvalLevels);
        if (type !== "moverequest") return fallback;
        var settings = readSettings(), providerSettings = settings.providers && settings.providers[type];
        var assignments = providerSettings && providerSettings.meshApproverGroupIds;
        var targetMeshId = payload && (payload.targetMeshId || payload.targetGroupId);
        if (!assignments || !targetMeshId) return fallback;
        var levels = Object.prototype.hasOwnProperty.call(assignments, String(targetMeshId)) ? assignments[String(targetMeshId)] : [];
        if (!Array.isArray(levels)) levels = levels == null ? [] : [levels];
        return normalizeApprovalLevels(levels.map(function (level) { return Number(level); }), true);
    }

    function canDecideRequest(user, request) {
        if (!request || request.status !== "pending") return false;
        if (!core.isSiteAdmin(user) && String(user && user._id || "") === String(request.requester && request.requester.id || "")) return false;
        return canApprove(user, request.type, requestApprovalLevel(request), requestApprovalLevels(request));
    }

    function allowedProviderTypes(user) {
        return providers().map(function (item) { return item.type; }).filter(function (type) { return canApproveAny(user, type); });
    }

    function audit(user, action, request, message) {
        var targets = ["*", "server-users"];
        if (request && request.requester && request.requester.id) targets.push(request.requester.id);
        core.dispatchEvent(parent, source, targets, {
            etype: "user",
            action: action,
            userid: user && user._id,
            username: core.userName(user),
            requestid: request && request._id,
            requesttype: request && request.type,
            msg: cleanText(message, 1000)
        });
    }

    function initialize() {
        if (readyPromise) return readyPromise;
        try {
            core.ensureWritableDirectory(fs, path, dataRoot);
            repairDatabaseFile();
            database = new Datastore({ filename: databasePath, autoload: false, timestampData: false });
            readyPromise = database.loadDatabaseAsync().then(function () {
                return database.findAsync({ activeKey: { $exists: true }, status: "pending" }).then(function (rows) {
                    var seen = Object.create(null), repairs = [];
                    rows.sort(function (a, b) { return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0); }).forEach(function (row) {
                        var key = String(row.activeKey || ""); if (!key) return;
                        if (seen[key]) repairs.push(database.updateAsync({ _id: row._id }, { $set: { status: "replaced", approver: { id: "system", name: "system" }, approverNote: "Duplicate active request repaired automatically.", updatedAt: Date.now(), decidedAt: Date.now() }, $unset: { activeKey: true } }));
                        else seen[key] = true;
                    });
                    return Promise.all(repairs);
                });
            }).then(function () {
                return Promise.all([
                    database.ensureIndexAsync({ fieldName: "activeKey", unique: true, sparse: true }),
                    database.ensureIndexAsync({ fieldName: "executionId", unique: true, sparse: true }),
                    database.ensureIndexAsync({ fieldName: "externalIdempotencyKey", unique: true, sparse: true }),
                    database.ensureIndexAsync({ fieldName: "type" }),
                    database.ensureIndexAsync({ fieldName: "status" }),
                    database.ensureIndexAsync({ fieldName: "createdAt" })
                ]);
            }).then(function () {
                return database.updateAsync({ status: "executing" }, {
                    $set: {
                        status: "failed",
                        updatedAt: Date.now(),
                        executionFinishedAt: Date.now(),
                        "result.ok": false,
                        "result.message": "Execution was interrupted by a server restart. Manual verification is required."
                    },
                    $unset: { activeKey: true }
                }, { multi: true });
            });
        } catch (error) {
            readyPromise = Promise.reject(error);
        }
        readyPromise.catch(function (error) { console.log("Approval Center initialization failed:", error && error.message || error); });
        return readyPromise;
    }

    function withResourceLock(key, work) {
        key = String(key || "__global__");
        var previous = resourceLocks[key] || Promise.resolve();
        var current = previous.catch(function () { }).then(work);
        resourceLocks[key] = current;
        return current.finally(function () { if (resourceLocks[key] === current) delete resourceLocks[key]; });
    }

    async function submit(type, user, payload, requesterNote, options) {
        await initialize();
        options = options && typeof options === "object" ? options : {};
        type = String(type || "").toLowerCase();
        var provider = getProvider(type);
        if (!provider) throw new Error("Approval provider is unavailable. Install or reload the required plugin.");
        if (!user || !user._id) throw new Error("Authentication is required.");
        var idempotencyKey = cleanText(options.idempotencyKey, 128).trim();
        var apiClientId = cleanText(options.apiClientId, 40).toLowerCase();
        var externalIdempotencyKey = idempotencyKey && apiClientId ? tokenHash(apiClientId + "\u0000" + type + "\u0000" + idempotencyKey) : "";
        if (externalIdempotencyKey) {
            var existingRequest = await database.findOneAsync({ externalIdempotencyKey: externalIdempotencyKey });
            if (existingRequest) return publicRequest(existingRequest, user);
        }
        if (typeof provider.canSubmit === "function" && await Promise.resolve(provider.canSubmit(user, payload)) !== true) throw new Error("You do not have permission to submit this request.");
        var validated = typeof provider.validate === "function" ? await Promise.resolve(provider.validate(payload, user)) : { payload: payload };
        if (!validated || validated.ok === false) throw new Error(validated && validated.error || "The provider rejected this request.");
        var sanitizedPayload = safePlainObject(validated.payload == null ? payload : validated.payload);
        var requiredApprovalLevels = approvalLevelsFor(type, validated, sanitizedPayload || payload);
        var resourceKey = cleanText(validated.resourceKey || "", 300);
        var activeKey = resourceKey ? type + ":" + resourceKey : "";
        return withResourceLock(activeKey || type + ":" + crypto.randomBytes(8).toString("hex"), async function () {
            if (externalIdempotencyKey) {
                var existingInsideLock = await database.findOneAsync({ externalIdempotencyKey: externalIdempotencyKey });
                if (existingInsideLock) return publicRequest(existingInsideLock, user);
            }
            var now = Date.now();
            var replaced = [];
            if (activeKey) {
                var replacedResult = await database.updateAsync({ activeKey: activeKey, status: "pending" }, {
                    $set: {
                        status: "replaced",
                        updatedAt: now,
                        decidedAt: now,
                        approver: { id: "system", name: "system" },
                        approverNote: "Cancelled and replaced by a newer request."
                    },
                    $unset: { activeKey: true }
                }, { multi: true, returnUpdatedDocs: true });
                replaced = replacedResult.affectedDocuments || [];
                if (!Array.isArray(replaced)) replaced = replaced ? [replaced] : [];
            }
            var autoApproved = !hasConfiguredApprovers(type, requiredApprovalLevels);
            var request = {
                _id: crypto.randomBytes(16).toString("hex"),
                type: type,
                status: autoApproved ? "approved" : "pending",
                requiredApprovalLevels: requiredApprovalLevels,
                allowNoApproval: requiredApprovalLevels.length === 0,
                approvalLevel: requiredApprovalLevels[0] || 0,
                approvalDecisions: [],
                requester: { id: String(user._id), name: core.userName(user) },
                approver: autoApproved ? { id: "system", name: "system" } : { id: "", name: "" },
                requesterNote: cleanText(requesterNote, 2000),
                approverNote: autoApproved ? "No approval groups are assigned; request executed automatically." : "",
                createdAt: now,
                updatedAt: now,
                decidedAt: 0,
                executionStartedAt: 0,
                executionFinishedAt: 0,
                resourceKey: resourceKey,
                summary: cleanText(validated.summary || provider.title || type, 500),
                fields: safePlainObject(validated.fields || {}),
                payload: sanitizedPayload,
                result: { ok: null, message: "" }
            };
            if (activeKey) request.activeKey = activeKey;
            if (externalIdempotencyKey) request.externalIdempotencyKey = externalIdempotencyKey;
            if (apiClientId) request.source = { kind: "api", clientId: apiClientId, name: cleanText(options.apiClientName, 120) };
            try { request = await database.insertAsync(request); }
            catch (error) {
                if (externalIdempotencyKey) {
                    var duplicate = await database.findOneAsync({ externalIdempotencyKey: externalIdempotencyKey });
                    if (duplicate) return publicRequest(duplicate, user);
                }
                if (error && (error.errorType === "uniqueViolated" || /unique constraint/i.test(String(error.message || ""))) && activeKey) {
                    var existingActive = await database.findOneAsync({ activeKey: activeKey, status: "pending" });
                    if (existingActive) return publicRequest(existingActive, user);
                }
                for (var index = 0; index < replaced.length; index++) {
                    await database.updateAsync({ _id: replaced[index]._id, status: "replaced", approverNote: "Cancelled and replaced by a newer request." }, {
                        $set: { status: "pending", updatedAt: Date.now(), activeKey: activeKey, approver: { id: "", name: "" }, approverNote: "", decidedAt: 0 }
                    }, {});
                }
                throw error;
            }
            replaced.forEach(function (oldRequest) { audit(user, "approvalrequestreplaced", oldRequest, "Approval request replaced by a newer request."); });
            audit(user, "approvalrequestsubmitted", request, "Approval request submitted: " + request.summary);
            if (autoApproved) setImmediate(function () { executeRequest(request._id).catch(function (error) { console.log("Approval Center automatic execution failed:", error && error.message || error); }); });
            return publicRequest(request, user);
        });
    }

    function providerFields(request) {
        var result = safePlainObject(request.fields || {});
        var provider = getProvider(request.type);
        if (provider && typeof provider.formatRequest === "function") {
            try { result = safePlainObject(provider.formatRequest(request) || result); } catch (error) { }
        }
        return result;
    }

    function publicRequest(request, user) {
        var requiredApprovalLevels = requestApprovalLevels(request), approvalLevel = requestApprovalLevel(request);
        var approvals = approvalSummary(request);
        return {
            id: request._id,
            type: request.type,
            status: request.status,
            requiredApprovalLevels: requiredApprovalLevels,
            approvalLevel: approvalLevel,
            approvalDecisions: safePlainObject(request.approvalDecisions || []),
            approvalProgress: approvals.progress,
            approvalCompleted: approvals.completed,
            approvalTotal: approvals.total,
            approver1: approvals.approver1 || "",
            approver2: approvals.approver2 || "",
            approver3: approvals.approver3 || "",
            approverNote1: approvals.approverNote1 || "",
            approverNote2: approvals.approverNote2 || "",
            approverNote3: approvals.approverNote3 || "",
            canDecide: canDecideRequest(user, request),
            requester: safePlainObject(request.requester),
            approver: safePlainObject(request.approver),
            requesterNote: request.requesterNote || "",
            approverNote: request.approverNote || "",
            createdAt: request.createdAt || 0,
            updatedAt: request.updatedAt || 0,
            decidedAt: request.decidedAt || 0,
            executionStartedAt: request.executionStartedAt || 0,
            executionFinishedAt: request.executionFinishedAt || 0,
            summary: request.summary || "",
            fields: providerFields(request),
            result: safePlainObject(request.result || {}),
            source: safePlainObject(request.source || { kind: "mesh" })
        };
    }

    function visibilityQuery(user, requestedType) {
        var types = allowedProviderTypes(user);
        var requester = String(user && user._id || "");
        var alternatives = [];
        if (core.isSiteAdmin(user)) alternatives.push({});
        else {
            if (types.length) alternatives.push({ type: { $in: types } });
            if (requester) alternatives.push({ "requester.id": requester });
        }
        if (!alternatives.length) alternatives.push({ _id: "__none__" });
        var visibility = alternatives.length === 1 ? alternatives[0] : { $or: alternatives };
        return requestedType ? { $and: [visibility, { type: requestedType }] } : visibility;
    }

    async function list(user, options) {
        await initialize();
        options = options || {};
        var type = cleanText(options.type, 64).toLowerCase();
        var status = cleanText(options.status, 40).toLowerCase();
        var filter = cleanText(options.filter, 200).trim();
        var page = Math.max(1, parseInt(options.page, 10) || 1);
        var perPage = [20, 50, 100].indexOf(parseInt(options.perPage, 10)) >= 0 ? parseInt(options.perPage, 10) : 20;
        var conditions = [visibilityQuery(user, type)];
        var allowedTypes = Array.isArray(options.allowedTypes) ? options.allowedTypes.map(function (item) { return cleanText(item, 64).toLowerCase(); }).filter(Boolean) : [];
        if (allowedTypes.length) conditions.push({ type: { $in: allowedTypes } });
        if (status) conditions.push({ status: status });
        if (filter) {
            var expression = new RegExp(escapeRegex(filter), "i");
            conditions.push({ $or: [{ summary: expression }, { "requester.name": expression }, { "approver.name": expression }, { requesterNote: expression }, { approverNote: expression }, { "approvalDecisions.approver.name": expression }, { "approvalDecisions.note": expression }] });
        }
        var query = conditions.length === 1 ? conditions[0] : { $and: conditions };
        var total = await database.countAsync(query);
        var pageCount = Math.max(1, Math.ceil(total / perPage));
        if (page > pageCount) page = pageCount;
        var rows = await database.find(query).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).execAsync();
        return { rows: rows.map(function (row) { return publicRequest(row, user); }), total: total, page: page, pageCount: pageCount, perPage: perPage };
    }

    async function getRequest(user, requestId, allowedTypes) {
        await initialize();
        var conditions = [visibilityQuery(user, ""), { _id: String(requestId || "") }];
        if (Array.isArray(allowedTypes) && allowedTypes.length) conditions.push({ type: { $in: allowedTypes } });
        var request = await database.findOneAsync({ $and: conditions });
        if (!request) throw apiError(404, "request_not_found", "Request not found.");
        return publicRequest(request, user);
    }

    async function overview(user) {
        await initialize();
        var metadata = providers().filter(function (provider) { return provider.enabled !== false; });
        var allowed = allowedProviderTypes(user);
        if (!core.isSiteAdmin(user)) metadata = metadata.filter(function (item) { return allowed.indexOf(item.type) >= 0; });
        return Promise.all(metadata.map(async function (provider) {
            var statuses = ["pending", "approved", "executing", "completed", "rejected", "failed", "replaced"];
            var work = statuses.map(function (status) { return database.countAsync({ type: provider.type, status: status }); });
            work.push(database.find({ type: provider.type, status: "pending" }).sort({ createdAt: -1 }).limit(20).execAsync());
            var values = await Promise.all(work), counts = {};
            statuses.forEach(function (status, index) { counts[status] = values[index]; });
            return { provider: provider, counts: counts, pending: values[values.length - 1].map(function (row) { return publicRequest(row, user); }) };
        }));
    }

    async function executeRequest(requestId) {
        await initialize();
        var current = await database.findOneAsync({ _id: String(requestId || "") });
        if (!current || current.status !== "approved" || current.executionId) return null;
        var provider = getProvider(current.type);
        if (!provider || typeof provider.execute !== "function") return null;
        var executionId = crypto.randomBytes(18).toString("hex");
        var claim = await database.updateAsync({ _id: current._id, status: "approved", executionId: { $exists: false } }, {
            $set: { status: "executing", executionId: executionId, executionStartedAt: Date.now(), updatedAt: Date.now() }
        }, { returnUpdatedDocs: true });
        if (claim.numAffected !== 1) return null;
        var claimed = claim.affectedDocuments;
        try {
            var result = await Promise.resolve(provider.execute(safePlainObject(claimed.payload), publicRequest(claimed), executionId));
            result = result && typeof result === "object" ? result : { message: String(result || "Completed.") };
            var finalStatus = provider.finalStatusOnSuccess === "approved" ? "approved" : "completed";
            var finished = await database.updateAsync({ _id: claimed._id, status: "executing", executionId: executionId }, {
                $set: { status: finalStatus, updatedAt: Date.now(), executionFinishedAt: Date.now(), result: { ok: true, message: cleanText(result.message || "Completed.", 8000), data: safePlainObject(result.data || {}) } },
                $unset: { activeKey: true }
            }, { returnUpdatedDocs: true });
            if (finished.numAffected === 1) audit({ _id: claimed.approver && claimed.approver.id, name: claimed.approver && claimed.approver.name }, "approvalrequestexecuted", finished.affectedDocuments, "Approved request executed: " + claimed.summary);
            return finished.affectedDocuments || null;
        } catch (error) {
            var message = cleanText(error && error.message || error || "Execution failed.", 8000);
            var failed = await database.updateAsync({ _id: claimed._id, status: "executing", executionId: executionId }, {
                $set: { status: "failed", updatedAt: Date.now(), executionFinishedAt: Date.now(), result: { ok: false, message: message } },
                $unset: { activeKey: true }
            }, { returnUpdatedDocs: true });
            if (failed.numAffected === 1) audit({ _id: claimed.approver && claimed.approver.id, name: claimed.approver && claimed.approver.name }, "approvalrequestfailed", failed.affectedDocuments, "Approved request failed: " + claimed.summary);
            return failed.affectedDocuments || null;
        }
    }

    async function decide(user, requestId, decision, note, options) {
        await initialize();
        options = options && typeof options === "object" ? options : {};
        requestId = String(requestId || "");
        decision = String(decision || "").toLowerCase();
        var current = await database.findOneAsync({ _id: requestId });
        if (!current) throw new Error("Request not found.");
        if (decision !== "approve" && decision !== "reject") throw new Error("Invalid decision.");
        var idempotencyKey = cleanText(options.idempotencyKey, 128).trim();
        var apiClientId = cleanText(options.apiClientId, 40).toLowerCase();
        var decisionIdempotencyKey = idempotencyKey && apiClientId ? tokenHash(apiClientId + "\u0000decision\u0000" + requestId + "\u0000" + idempotencyKey) : "";
        var priorDecisions = Array.isArray(current.approvalDecisions) ? current.approvalDecisions : [];
        if (decisionIdempotencyKey && priorDecisions.some(function (item) { return item && item.decisionIdempotencyKey === decisionIdempotencyKey && item.decision === decision; })) return publicRequest(current, user);
        if (current.status !== "pending") {
            if (decisionIdempotencyKey && current.decisionIdempotencyKey === decisionIdempotencyKey && current.decision === decision) return publicRequest(current, user);
            throw new Error("This request has already been decided.");
        }
        if (!core.isSiteAdmin(user) && String(user && user._id || "") === String(current.requester && current.requester.id || "")) throw new Error("You cannot approve or reject your own request.");
        var currentLevel = requestApprovalLevel(current);
        if (!canApprove(user, current.type, currentLevel, requestApprovalLevels(current))) throw new Error("You do not have permission for approval level " + currentLevel + ".");
        var levels = requestApprovalLevels(current), nextIndex = levels.indexOf(currentLevel) + 1, hasNextLevel = decision === "approve" && nextIndex < levels.length;
        var status = decision === "reject" ? "rejected" : (hasNextLevel ? "pending" : "approved");
        var now = Date.now(), approver = { id: String(user && user._id || ""), name: core.userName(user) }, cleanNote = cleanText(note, 2000);
        var decisionRecord = { level: currentLevel, decision: decision, approver: approver, note: cleanNote, decidedAt: now };
        if (decisionIdempotencyKey) decisionRecord.decisionIdempotencyKey = decisionIdempotencyKey;
        if (apiClientId) decisionRecord.source = { kind: "api", clientId: apiClientId, name: cleanText(options.apiClientName, 120) };
        var setValues = {
            status: status,
            decision: decision,
            updatedAt: now,
            approver: approver,
            approverNote: cleanNote
        };
        if (hasNextLevel) setValues.approvalLevel = levels[nextIndex];
        else setValues.decidedAt = now;
        if (decisionIdempotencyKey) setValues.decisionIdempotencyKey = decisionIdempotencyKey;
        if (apiClientId) setValues.decisionSource = { kind: "api", clientId: apiClientId, name: cleanText(options.apiClientName, 120) };
        var update = { $set: setValues, $push: { approvalDecisions: decisionRecord } };
        if (!hasNextLevel) update.$unset = { activeKey: true };
        var result = await database.updateAsync({ _id: requestId, status: "pending", $or: [{ approvalLevel: currentLevel }, { approvalLevel: { $exists: false } }] }, update, { returnUpdatedDocs: true });
        if (result.numAffected !== 1) {
            if (decisionIdempotencyKey) {
                var decided = await database.findOneAsync({ _id: requestId, "approvalDecisions.decisionIdempotencyKey": decisionIdempotencyKey });
                if (decided) return publicRequest(decided, user);
            }
            throw new Error("This request was changed by another user.");
        }
        audit(user, decision === "approve" ? "approvalrequestapproved" : "approvalrequestrejected", result.affectedDocuments, "Approval level " + currentLevel + " " + decision + "d: " + result.affectedDocuments.summary);
        if (status === "approved") setImmediate(function () { executeRequest(requestId).catch(function (error) { console.log("Approval Center execution failed:", error && error.message || error); }); });
        return publicRequest(result.affectedDocuments, user);
    }

    async function getProviderResources(type, user, query) {
        type = cleanText(type, 64).toLowerCase();
        var provider = getProvider(type);
        if (!provider) throw apiError(404, "provider_not_found", "Approval provider is unavailable.");
        if (!provider.api || typeof provider.api.resources !== "function") return {};
        return safePlainObject(await Promise.resolve(provider.api.resources(user, query || {})));
    }

    function createApiClient(user, values) {
        if (!core.isSiteAdmin(user)) throw new Error("Only Site Admin can create API tokens.");
        values = values && typeof values === "object" ? values : {};
        var name = cleanText(values.name, 120).trim();
        var userId = cleanText(values.userId, 300).trim();
        if (!name) throw new Error("API client name is required.");
        if (!findUser(userId)) throw new Error("The selected MeshCentral user does not exist.");
        var scopes = Array.isArray(values.scopes) ? values.scopes : String(values.scopes || "").split(",");
        scopes = scopes.map(function (scope) { return String(scope).trim(); }).filter(function (scope, index, list) { return API_SCOPES.indexOf(scope) >= 0 && list.indexOf(scope) === index; });
        if (!scopes.length) throw new Error("Select at least one API scope.");
        var providerTypes = Array.isArray(values.providerTypes) ? values.providerTypes : String(values.providerTypes || "").split(",");
        providerTypes = providerTypes.map(function (type) { return cleanText(type, 64).toLowerCase().trim(); }).filter(function (type, index, list) { return type && list.indexOf(type) === index; });
        var unknown = providerTypes.filter(function (type) { return !getProvider(type); });
        if (unknown.length) throw new Error("Unknown provider: " + unknown.join(", "));
        var id = crypto.randomBytes(8).toString("hex");
        var token = "ac1_" + id + "_" + randomTokenPart(32);
        var client = normalizeApiClient({ id: id, name: name, userId: userId, tokenHash: tokenHash(token), tokenPrefix: token.slice(0, 20), scopes: scopes, providerTypes: providerTypes, createdAt: Date.now() });
        var settings = readSettings();
        settings.apiClients.push(client);
        writeSettings(settings);
        audit(user, "approvalapitokencreated", null, "Approval Center API token created for " + name + ".");
        return { client: publicApiClient(client), token: token };
    }

    function revokeApiClient(user, clientId) {
        if (!core.isSiteAdmin(user)) throw new Error("Only Site Admin can revoke API tokens.");
        clientId = cleanText(clientId, 40).toLowerCase();
        var settings = readSettings(), before = settings.apiClients.length;
        settings.apiClients = settings.apiClients.filter(function (client) { return client.id !== clientId; });
        if (settings.apiClients.length === before) throw new Error("API client not found.");
        writeSettings(settings);
        audit(user, "approvalapitokenrevoked", null, "Approval Center API token revoked: " + clientId + ".");
        return true;
    }

    function authenticateApiToken(token) {
        token = String(token || "").trim();
        var match = token.match(/^ac1_([a-f0-9]{16})_[A-Za-z0-9_-]{32,}$/);
        if (!match) throw apiError(401, "invalid_token", "A valid bearer token is required.");
        var settings = readSettings(), client = settings.apiClients.filter(function (item) { return item.id === match[1]; })[0];
        if (!client) throw apiError(401, "invalid_token", "A valid bearer token is required.");
        var supplied = Buffer.from(tokenHash(token), "hex"), expected = Buffer.from(client.tokenHash, "hex");
        if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw apiError(401, "invalid_token", "A valid bearer token is required.");
        var apiUser = findUser(client.userId);
        if (!apiUser) throw apiError(401, "api_user_unavailable", "The MeshCentral user assigned to this token is unavailable.");
        return { client: publicApiClient(client), user: apiUser };
    }

    function authorizeApi(context, scope, type) {
        if (!context || !context.client || context.client.scopes.indexOf(scope) < 0) throw apiError(403, "scope_denied", "The API token does not grant " + scope + ".");
        type = cleanText(type, 64).toLowerCase();
        if (type && context.client.providerTypes.length && context.client.providerTypes.indexOf(type) < 0) throw apiError(403, "provider_denied", "The API token does not grant access to this provider.");
        return true;
    }

    async function clean(user, type, retentionDays) {
        await initialize();
        if (!core.isSiteAdmin(user)) throw new Error("Only Site Admin can clean approval data.");
        type = cleanText(type, 64).toLowerCase();
        var days = normalizeRetention(retentionDays);
        var cutoff = Date.now() - days * 86400000;
        var query = { createdAt: { $lt: cutoff }, status: { $in: ["approved", "completed", "rejected", "failed", "replaced"] } };
        if (type) query.type = type;
        var removed = await database.removeAsync(query, { multi: true });
        var settings = readSettings(); settings.retentionDays = days; writeSettings(settings);
        audit(user, "approvalrequestcleanup", null, "Approval Center cleanup removed " + removed + " request(s) older than " + days + " day(s).");
        return { removed: removed, retentionDays: days, cutoff: cutoff };
    }

    async function saveProviderSettings(user, type, groupIds, enabled, meshAssignments) {
        if (!core.isSiteAdmin(user)) throw new Error("Only Site Admin can change Approval Center settings.");
        type = cleanText(type, 64).toLowerCase();
        if (!getProvider(type)) throw new Error("Unknown approval provider.");
        groupIds = groupIds && typeof groupIds === "object" ? groupIds : { 1: groupIds };
        function normalize(value) { value = Array.isArray(value) ? value : (value ? [value] : []); return value.map(function (item) { return cleanText(item, 300); }).filter(function (item, index, list) { return item && list.indexOf(item) === index; }); }
        var normalizedGroups = { 1: normalize(groupIds[1] || groupIds["1"]), 2: normalize(groupIds[2] || groupIds["2"]), 3: normalize(groupIds[3] || groupIds["3"]) };
        var existingGroups = core.getUserGroups(parent);
        [1, 2, 3].forEach(function (level) { normalizedGroups[level].forEach(function (groupId) { if (!existingGroups.some(function (group) { return group.id === groupId; })) throw new Error("The selected user group for approval level " + level + " does not exist."); }); });
        var settings = readSettings();
        settings.providers[type] = settings.providers[type] || {};
        settings.providers[type].approverGroupIds = normalizedGroups;
        settings.providers[type].approverGroupId = normalizedGroups[1][0] || "";
        settings.providers[type].enabled = parseProviderEnabled(enabled, providerEnabled(type, settings));
        if (type === "moverequest") settings.providers[type].meshApproverGroupIds = meshAssignments && typeof meshAssignments === "object" ? safePlainObject(meshAssignments) : {};
        writeSettings(settings);
        audit(user, "approvalsettingschanged", null, "Approval settings changed for provider " + type + ".");
        return true;
    }

    function getSettings(user) {
        if (!core.isSiteAdmin(user)) return null;
        var settings = readSettings();
        var webServer = parent && parent.parent && parent.parent.webserver || parent && parent.parent || null;
        var meshes = webServer && webServer.meshes || parent && parent.parent && parent.parent.meshes || {};
        var meshGroups = Object.keys(meshes).map(function (id) { var mesh = meshes[id]; return mesh && mesh.deleted == null && Number(mesh.mtype) === 2 ? { id: String(mesh._id || id), name: String(mesh.name || id) } : null; }).filter(Boolean).sort(function (a, b) { return a.name.localeCompare(b.name); });
        return {
            retentionDays: settings.retentionDays,
            groups: core.getUserGroups(parent),
            meshGroups: meshGroups,
            apiScopes: API_SCOPES.slice(),
            apiClients: settings.apiClients.map(publicApiClient),
            providers: providers().map(function (provider) {
                provider.approverGroupIds = approverGroupIds(provider.type);
                provider.approverGroupId = provider.approverGroupIds[1][0] || "";
                provider.meshApproverGroupIds = (settings.providers[provider.type] && settings.providers[provider.type].meshApproverGroupIds) || {};
                provider.enabled = providerEnabled(provider.type, settings);
                return provider;
            })
        };
    }

    function getAccess(user) {
        var siteAdmin = core.isSiteAdmin(user);
        var types = allowedProviderTypes(user);
        return { allowed: siteAdmin || types.length > 0, siteAdmin: siteAdmin, providerTypes: types };
    }

    function drainProvider(type) {
        initialize().then(function () {
            return database.find({ type: type, status: "approved", executionId: { $exists: false } }).sort({ createdAt: 1 }).execAsync();
        }).then(function (rows) {
            rows.forEach(function (row) { executeRequest(row._id).catch(function (error) { console.log("Approval Center provider drain failed:", error && error.message || error); }); });
        }).catch(function (error) { console.log("Approval Center provider registration failed:", error && error.message || error); });
    }

    var api = {
        version: "1.2.0",
        apiScopes: API_SCOPES.slice(),
        authenticateApiToken: authenticateApiToken,
        authorizeApi: authorizeApi,
        clean: clean,
        createApiClient: createApiClient,
        decide: decide,
        executeRequest: executeRequest,
        getAccess: getAccess,
        getClientConfig: function () { return safePlainObject(clientConfig); },
        getProviderResources: getProviderResources,
        getRequest: getRequest,
        getSettings: getSettings,
        initialize: initialize,
        list: list,
        listProviders: providers,
        onProviderRegistered: drainProvider,
        overview: overview,
        revokeApiClient: revokeApiClient,
        saveProviderSettings: saveProviderSettings,
        submit: submit
    };
    bus.setService(api);
    return api;
};
