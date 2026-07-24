"use strict";

var crypto = require("crypto");
var shared = require("./shared.js");

module.exports.createApprovalService = function (options) {
    var fs = options.fs;
    var path = options.path;
    var parent = options.parent;
    var settings = options.settings;
    var databasePath = options.databasePath;
    var tokenPath = path.join(path.dirname(databasePath), "approval-api-tokens.json");
    var providers = Object.create(null);
    var queue = Promise.resolve();

    function readRows() {
        var value = shared.readJson(fs, databasePath, { requests: [] });
        return Array.isArray(value.requests) ? value.requests : [];
    }

    function writeRows(rows) {
        shared.writeJsonAtomic(fs, path, databasePath, {
            schemaVersion: 3,
            requests: rows
        });
    }

    function transact(work) {
        var operation = queue.then(function () {
            var rows = readRows();
            return Promise.resolve(work(rows)).then(function (result) {
                writeRows(rows);
                return result;
            });
        });
        queue = operation.catch(function () {});
        return operation;
    }

    function config(type) {
        var current = settings.read();
        var value = current.modules && current.modules.approvalcenter &&
            current.modules.approvalcenter.providers &&
            current.modules.approvalcenter.providers[type] || {};
        function groups(level) {
            var list = value.levels && (value.levels[level] || value.levels[String(level)]);
            return Array.isArray(list) ? list.map(String) : [];
        }
        return {
            enabled: value.enabled !== false,
            showTab: value.showTab !== false,
            showOverview: value.showOverview !== false,
            levels: { 1: groups(1), 2: groups(2), 3: groups(3) }
        };
    }

    function registerProvider(provider) {
        var type = String(provider && provider.type || "").toLowerCase();
        if (!/^[a-z][a-z0-9_-]{1,63}$/.test(type)) throw new Error("Invalid approval provider.");
        providers[type] = provider;
        return function () { if (providers[type] === provider) delete providers[type]; };
    }

    function providerEnabled(type) {
        var provider = providers[type];
        if (!provider) return false;
        if (provider.moduleKey && !settings.isModuleEnabled(provider.moduleKey)) return false;
        return config(type).enabled;
    }

    function listProviders() {
        return Object.keys(providers).sort().map(function (type) {
            var provider = providers[type];
            var value = config(type);
            return {
                type: type,
                title: shared.cleanText(provider.title || type, 120),
                tabTitle: shared.cleanText(provider.tabTitle || provider.title || type, 120),
                settingsTitle: shared.cleanText(provider.settingsTitle || (provider.title || type) + " approvers", 160),
                description: shared.cleanText(provider.description || "", 500),
                columns: shared.copy(provider.columns || []),
                enabled: providerEnabled(type),
                showTab: value.showTab,
                showOverview: value.showOverview,
                levels: value.levels
            };
        });
    }

    function requiredLevels(provider, payload) {
        var value = typeof provider.getApprovalLevels === "function"
            ? provider.getApprovalLevels(payload)
            : provider.approvalLevels;
        value = Array.isArray(value) ? value.map(Number) : [1];
        return value.filter(function (level, index, list) {
            return level >= 1 && level <= 3 && list.indexOf(level) === index;
        }).sort();
    }

    function currentLevel(request) {
        var decisions = Array.isArray(request.approvalDecisions) ? request.approvalDecisions : [];
        var levels = Array.isArray(request.requiredApprovalLevels) ? request.requiredApprovalLevels : [1];
        for (var index = 0; index < levels.length; index++) {
            var decided = decisions.some(function (decision) { return Number(decision.level) === Number(levels[index]); });
            if (!decided) return Number(levels[index]);
        }
        return 0;
    }

    function canDecide(user, request) {
        if (!user || request.status !== "pending") return false;
        if (request.requester && request.requester.id === user._id && !shared.isSiteAdmin(user)) return false;
        if (shared.isSiteAdmin(user)) return true;
        var level = currentLevel(request);
        return level > 0 && shared.isUserInAnyGroup(user, config(request.type).levels[level]);
    }

    function canSee(user, request) {
        return shared.isSiteAdmin(user) ||
            !!(user && request.requester && request.requester.id === user._id) ||
            canDecide(user, request);
    }

    function publicRequest(user, request) {
        var result = shared.copy(request);
        delete result.payload;
        result.canDecide = canDecide(user, request);
        result.currentApprovalLevel = currentLevel(request);
        return result;
    }

    function execute(id) {
        var execution;
        return transact(function (rows) {
            var request = rows.find(function (item) { return item.id === id; });
            if (!request) throw new Error("Approval request not found.");
            var provider = providers[request.type];
            if (!provider || typeof provider.execute !== "function") {
                request.status = "failed";
                request.result = { message: "Approval provider is unavailable." };
                request.updatedAt = Date.now();
                return null;
            }
            request.status = "executing";
            request.updatedAt = Date.now();
            execution = { provider: provider, request: shared.copy(request) };
            return true;
        }).then(function () {
            if (!execution) return null;
            return Promise.resolve(execution.provider.execute(
                execution.request.payload,
                execution.request,
                execution.request.executionId
            )).then(function (result) {
                return transact(function (rows) {
                    var request = rows.find(function (item) { return item.id === id; });
                    if (!request) return null;
                    request.status = execution.provider.finalStatusOnSuccess || "completed";
                    request.result = result || { message: "Operation completed." };
                    request.updatedAt = Date.now();
                    return shared.copy(request);
                });
            }).catch(function (error) {
                return transact(function (rows) {
                    var request = rows.find(function (item) { return item.id === id; });
                    if (!request) return null;
                    request.status = "failed";
                    request.result = { message: shared.cleanText(error && error.message || error, 8000) };
                    request.updatedAt = Date.now();
                    return shared.copy(request);
                });
            });
        });
    }

    function submit(type, user, payload, note, submitOptions) {
        type = String(type || "").toLowerCase();
        var provider = providers[type];
        if (!settings.isModuleEnabled("approvalcenter")) return Promise.reject(new Error("Approval Center is disabled."));
        if (!provider || !providerEnabled(type)) return Promise.reject(new Error("Approval provider is unavailable."));
        if (typeof provider.canSubmit === "function" && provider.canSubmit(user) !== true) {
            return Promise.reject(new Error("You do not have permission to submit this request."));
        }
        payload = typeof provider.normalizePayload === "function" ? provider.normalizePayload(payload || {}, user) : shared.copy(payload || {});
        var levels = requiredLevels(provider, payload);
        var now = Date.now();
        var idempotencyKey = shared.cleanText(submitOptions && submitOptions.idempotencyKey, 128).trim();
        var apiClientId = shared.cleanText(submitOptions && submitOptions.apiClientId, 80).trim();
        var externalIdempotencyKey = idempotencyKey && apiClientId
            ? crypto.createHash("sha256").update(apiClientId + "\u0000" + type + "\u0000" + idempotencyKey).digest("hex")
            : "";
        var request = {
            id: shared.randomId(12),
            type: type,
            providerTitle: shared.cleanText(provider.title || type, 160),
            title: shared.cleanText(typeof provider.getTitle === "function" ? provider.getTitle(payload) : provider.title || type, 300),
            summary: shared.cleanText(typeof provider.getSummary === "function" ? provider.getSummary(payload) : "", 2000),
            status: levels.length ? "pending" : "approved",
            requester: { id: user && user._id || "", name: shared.userName(user) },
            requesterNote: shared.cleanText(note, 4000),
            payload: payload,
            requiredApprovalLevels: levels,
            approvalDecisions: [],
            source: submitOptions && submitOptions.source || "ui",
            createdAt: now,
            updatedAt: now,
            executionId: shared.randomId(12)
        };
        if (externalIdempotencyKey) request.externalIdempotencyKey = externalIdempotencyKey;
        if (apiClientId) request.source = { kind: "api", clientId: apiClientId, name: shared.cleanText(submitOptions && submitOptions.apiClientName, 160) };
        return transact(function (rows) {
            if (externalIdempotencyKey) {
                var existing = rows.find(function (item) { return item.externalIdempotencyKey === externalIdempotencyKey; });
                if (existing) return { request: shared.copy(existing), existing: true };
            }
            rows.push(request);
            return { request: shared.copy(request), existing: false };
        }).then(function (result) {
            if (result.existing || levels.length) return result.request;
            return execute(result.request.id);
        });
    }

    function decide(user, id, approved, note, decisionOptions) {
        var executeId = "";
        decisionOptions = decisionOptions || {};
        var idempotencyKey = shared.cleanText(decisionOptions.idempotencyKey, 128).trim();
        var apiClientId = shared.cleanText(decisionOptions.apiClientId, 80).trim();
        var decisionIdempotencyKey = idempotencyKey && apiClientId
            ? crypto.createHash("sha256").update(apiClientId + "\u0000decision\u0000" + String(id || "") + "\u0000" + idempotencyKey).digest("hex")
            : "";
        return transact(function (rows) {
            var request = rows.find(function (item) { return item.id === String(id || ""); });
            if (!request) throw new Error("Approval request not found.");
            var existingDecision = decisionIdempotencyKey && (request.approvalDecisions || []).find(function (item) {
                return item.decisionIdempotencyKey === decisionIdempotencyKey;
            });
            if (existingDecision) return publicRequest(user, request);
            if (!canDecide(user, request)) throw new Error("Permission denied.");
            var level = currentLevel(request);
            var decision = {
                level: level,
                approved: approved === true,
                note: shared.cleanText(note, 4000),
                user: { id: user._id, name: shared.userName(user) },
                decidedAt: Date.now()
            };
            if (decisionIdempotencyKey) decision.decisionIdempotencyKey = decisionIdempotencyKey;
            if (apiClientId) decision.source = { kind: "api", clientId: apiClientId, name: shared.cleanText(decisionOptions.apiClientName, 160) };
            request.approvalDecisions.push(decision);
            request.updatedAt = Date.now();
            if (approved !== true) request.status = "rejected";
            else if (currentLevel(request) === 0) {
                request.status = "approved";
                executeId = request.id;
            }
            return publicRequest(user, request);
        }).then(function (result) {
            return executeId ? execute(executeId).then(function () { return result; }) : result;
        });
    }

    function list(user, query) {
        query = query || {};
        var page = Math.max(1, Number(query.page) || 1);
        var perPage = Math.max(10, Math.min(200, Number(query.perPage) || 50));
        var status = String(query.status || "").toLowerCase();
        var type = String(query.type || "").toLowerCase();
        var allowedTypes = Array.isArray(query.allowedTypes) ? query.allowedTypes.map(String) : [];
        var search = String(query.q || "").toLowerCase();
        var rows = readRows().filter(function (request) {
            if (!canSee(user, request)) return false;
            if (allowedTypes.length && allowedTypes.indexOf(request.type) < 0) return false;
            if (status && request.status !== status) return false;
            if (type && request.type !== type) return false;
            if (search && [request.title, request.summary, request.requester && request.requester.name]
                .join(" ").toLowerCase().indexOf(search) < 0) return false;
            return true;
        }).sort(function (a, b) { return Number(b.createdAt) - Number(a.createdAt); });
        var total = rows.length;
        return Promise.resolve({
            rows: rows.slice((page - 1) * perPage, page * perPage).map(function (request) { return publicRequest(user, request); }),
            page: page,
            perPage: perPage,
            total: total,
            pages: Math.max(1, Math.ceil(total / perPage))
        });
    }

    function getRequest(user, id) {
        var request = readRows().find(function (item) { return item.id === String(id || ""); });
        if (!request || !canSee(user, request)) throw new Error("Approval request not found.");
        return publicRequest(user, request);
    }

    function overview(user) {
        var cards = {};
        listProviders().forEach(function (provider) {
            if (provider.showOverview) cards[provider.type] = {
                type: provider.type,
                title: provider.title,
                description: provider.description,
                pending: 0,
                total: 0
            };
        });
        readRows().forEach(function (request) {
            if (cards[request.type] && canSee(user, request)) {
                cards[request.type].total++;
                if (request.status === "pending") cards[request.type].pending++;
            }
        });
        return Promise.resolve(Object.keys(cards).map(function (key) { return cards[key]; }));
    }

    function readTokens() {
        var value = shared.readJson(fs, tokenPath, { tokens: [] });
        return Array.isArray(value.tokens) ? value.tokens : [];
    }

    function writeTokens(tokens) {
        shared.writeJsonAtomic(fs, path, tokenPath, { schemaVersion: 1, tokens: tokens });
    }

    function listApiTokens(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
        return readTokens().map(function (token) {
            var result = shared.copy(token);
            delete result.hash;
            return result;
        });
    }

    function createApiToken(user, value) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
        value = value || {};
        var plain = "mcac_" + shared.randomId(32);
        var allowedScopes = ["providers:read", "requests:read", "requests:write", "requests:decide"];
        var scopes = Array.isArray(value.scopes) ? value.scopes.map(String) : ["requests:write", "requests:read"];
        scopes = scopes.filter(function (scope, index, all) { return allowedScopes.indexOf(scope) >= 0 && all.indexOf(scope) === index; });
        var token = {
            id: shared.randomId(10),
            name: shared.cleanText(value.name || "API token", 160),
            hash: crypto.createHash("sha256").update(plain).digest("hex"),
            scopes: scopes,
            providers: Array.isArray(value.providers) ? value.providers.map(String) : [],
            createdAt: Date.now(),
            createdBy: user._id,
            enabled: true
        };
        var rows = readTokens();
        rows.push(token);
        writeTokens(rows);
        return { token: plain, metadata: listApiTokens(user).find(function (item) { return item.id === token.id; }) };
    }

    function revokeApiToken(user, id) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
        var rows = readTokens();
        var token = rows.find(function (item) { return item.id === String(id || ""); });
        if (!token) throw new Error("API token not found.");
        token.enabled = false;
        token.revokedAt = Date.now();
        writeTokens(rows);
        return true;
    }

    function authenticateApiToken(plain, scope, type) {
        var hash = crypto.createHash("sha256").update(String(plain || "")).digest("hex");
        var token = readTokens().find(function (item) { return item.enabled !== false && item.hash === hash; });
        if (!token) throw new Error("Invalid API token.");
        if ((token.scopes || []).indexOf(scope) < 0) throw new Error("API token scope is missing.");
        if (type && (token.providers || []).length && token.providers.indexOf(type) < 0) throw new Error("API token cannot use this provider.");
        return token;
    }

    function getProviderResources(type, user, query) {
        type = String(type || "").toLowerCase();
        var provider = providers[type];
        if (!provider || !providerEnabled(type)) return Promise.reject(new Error("Approval provider is unavailable."));
        if (typeof provider.canSubmit === "function" && provider.canSubmit(user) !== true) {
            return Promise.reject(new Error("Permission denied."));
        }
        if (typeof provider.getResources !== "function") return Promise.resolve({});
        return Promise.resolve(provider.getResources(user, query || {}));
    }

    function externalContext(tokenText, scope, type) {
        var token = authenticateApiToken(tokenText, scope, type);
        var user = shared.findUser(parent, token.createdBy);
        if (!user) throw new Error("API token owner no longer exists.");
        return { token: token, user: user };
    }

    function submitExternal(tokenText, type, payload, note, idempotencyKey) {
        var context = externalContext(tokenText, "requests:write", type);
        return submit(type, context.user, payload, note || "External API", {
            source: "api",
            idempotencyKey: idempotencyKey,
            apiClientId: context.token.id,
            apiClientName: context.token.name
        });
    }

    function decideExternal(tokenText, id, decision, note, idempotencyKey) {
        var context = externalContext(tokenText, "requests:decide");
        var request = readRows().find(function (item) { return item.id === String(id || ""); });
        if (!request) throw new Error("Approval request not found.");
        if ((context.token.providers || []).length && context.token.providers.indexOf(request.type) < 0) {
            throw new Error("API token cannot use this provider.");
        }
        decision = String(decision || "").toLowerCase();
        if (decision !== "approve" && decision !== "reject") throw new Error("Invalid decision.");
        return decide(context.user, request.id, decision === "approve", note, {
            idempotencyKey: idempotencyKey,
            apiClientId: context.token.id,
            apiClientName: context.token.name
        });
    }

    function getSettings(user) {
        if (!shared.isSiteAdmin(user)) return null;
        var current = settings.read();
        return {
            groups: shared.getUserGroups(parent),
            providers: listProviders(),
            retentionDays: Number(current.modules.approvalcenter.retentionDays) || 365,
            apiTokens: listApiTokens(user)
        };
    }

    function saveProviderSettings(user, type, values) {
        if (!shared.isSiteAdmin(user)) return Promise.reject(new Error("Permission denied."));
        type = String(type || "").toLowerCase();
        if (!providers[type]) return Promise.reject(new Error("Unknown approval provider."));
        values = values || {};
        var known = shared.getUserGroups(parent).map(function (group) { return group.id; });
        function normalize(list) {
            return (Array.isArray(list) ? list : []).map(String).filter(function (id, index, all) {
                return known.indexOf(id) >= 0 && all.indexOf(id) === index;
            });
        }
        return settings.update(function (current) {
            var module = current.modules.approvalcenter;
            module.providers = module.providers || {};
            module.providers[type] = {
                enabled: values.enabled !== false,
                showTab: values.showTab !== false,
                showOverview: values.showOverview !== false,
                levels: {
                    1: normalize(values.levels && values.levels[1]),
                    2: normalize(values.levels && values.levels[2]),
                    3: normalize(values.levels && values.levels[3])
                }
            };
            return current;
        });
    }

    function initialize() {
        return transact(function (rows) {
            rows.forEach(function (request) {
                if (request.status === "executing") {
                    request.status = "failed";
                    request.result = { message: "Execution was interrupted by server restart." };
                    request.updatedAt = Date.now();
                }
            });
            return true;
        });
    }

    return {
        authenticateApiToken: authenticateApiToken,
        externalContext: externalContext,
        createApiToken: createApiToken,
        decide: decide,
        decideExternal: decideExternal,
        getProviderResources: getProviderResources,
        getRequest: getRequest,
        getSettings: getSettings,
        initialize: initialize,
        list: list,
        listApiTokens: listApiTokens,
        listProviders: listProviders,
        overview: overview,
        providerEnabled: providerEnabled,
        registerProvider: registerProvider,
        revokeApiToken: revokeApiToken,
        saveProviderSettings: saveProviderSettings,
        submit: submit,
        submitExternal: submitExternal
    };
};
