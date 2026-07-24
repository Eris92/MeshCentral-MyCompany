"use strict";

var shared = require("./shared.js");

function asBoolean(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    if (/^(true|yes|tak|on)$/i.test(String(value || ""))) return true;
    if (/^(false|no|nie|off)$/i.test(String(value || ""))) return false;
    return fallback;
}

function text(value, limit) {
    return shared.cleanText(value, limit || 1000).trim();
}

function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
    return Array.isArray(value) ? value : [];
}

var HEALTH_STATES = ["ok", "warning", "critical"];
var HEALTH_NAMES = ["ad", "entra", "jira", "defender", "zabbix"];

function normalizeHealth(value) {
    value = object(value);
    var status = String(value.status || "ok").toLowerCase();
    return {
        status: HEALTH_STATES.indexOf(status) >= 0 ? status : "ok",
        messagePl: text(value.messagePl, 300),
        messageEn: text(value.messageEn, 300)
    };
}

module.exports.createIntegrationService = function (options) {
    var settings = options.settings;
    var secrets = options.secrets;
    var parent = options.parent;
    var secretNamespace = "integration-secrets";

    function readSettings() {
        var current = settings.read();
        return shared.copy(current.integrations || {});
    }

    function readSecrets() {
        return secrets.get(secretNamespace);
    }

    function get(name) {
        var publicValue = readSettings()[name] || {};
        var secretValue = readSecrets();
        var result = shared.copy(publicValue);

        if (name === "ad") result.password = secretValue.adPassword || "";
        if (name === "entra") result.clientSecret = secretValue.entraClientSecret || "";
        if (name === "jira") result.token = secretValue.jiraToken || "";
        if (name === "defender") result.clientSecret = secretValue.defenderClientSecret || "";
        if (name === "zabbix") {
            result.password = secretValue.zabbixPassword || "";
            result.token = secretValue.zabbixToken || "";
        }

        return result;
    }

    function configured() {
        var current = readSettings();
        var secretValue = readSecrets();
        return {
            adPassword: !!secretValue.adPassword,
            entraClientSecret: !!secretValue.entraClientSecret,
            jiraToken: !!secretValue.jiraToken,
            defenderClientSecret: !!secretValue.defenderClientSecret,
            zabbixPassword: !!secretValue.zabbixPassword,
            zabbixToken: !!secretValue.zabbixToken,
            ad: !!(
                current.ad && current.ad.domain && current.ad.login && secretValue.adPassword
            ),
            entra: !!(
                current.entra && current.entra.tenantId && current.entra.clientId && secretValue.entraClientSecret
            ),
            jira: !!(
                current.jira && current.jira.url && current.jira.email &&
                current.jira.projectKey && secretValue.jiraToken
            ),
            defender: !!(
                current.defender && current.defender.tenantId &&
                current.defender.clientId && secretValue.defenderClientSecret
            ),
            zabbix: !!(
                current.zabbix && current.zabbix.url &&
                (secretValue.zabbixToken || (current.zabbix.username && secretValue.zabbixPassword))
            )
        };
    }

    function healthSummary() {
        var current = readSettings();
        var readiness = configured();
        var weight = { ok: 0, warning: 1, critical: 2 };
        var status = "ok";
        var items = HEALTH_NAMES.map(function (name) {
            var health = normalizeHealth(object(current[name]).health);
            var isConfigured = readiness[name] === true;
            if (!isConfigured) {
                health = {
                    status: "critical",
                    messagePl: "Integracja nie jest w pełni skonfigurowana.",
                    messageEn: "The integration is not fully configured."
                };
            }
            if (weight[health.status] > weight[status]) status = health.status;
            return {
                key: name,
                configured: isConfigured,
                status: health.status,
                messagePl: health.messagePl,
                messageEn: health.messageEn
            };
        });
        return { status: status, items: items };
    }

    function publicSettings(user) {
        if (!shared.isSiteAdmin(user)) return null;
        return {
            groups: shared.getUserGroups(parent),
            values: readSettings(),
            configured: configured()
        };
    }

    function normalizeGroups(value, knownGroups) {
        return array(value).map(String).filter(function (id, index, list) {
            return knownGroups.indexOf(id) >= 0 && list.indexOf(id) === index;
        });
    }

    function normalizePublic(payload, knownGroups) {
        payload = object(payload);
        var result = {};
        var ad = object(payload.ad);
        var entra = object(payload.entra);
        var jira = object(payload.jira);
        var defender = object(payload.defender);
        var zabbix = object(payload.zabbix);

        result.ad = {
            domain: text(ad.domain, 300),
            login: text(ad.login, 500),
            health: normalizeHealth(ad.health)
        };
        result.entra = {
            tenantId: text(entra.tenantId, 200),
            clientId: text(entra.clientId, 200),
            health: normalizeHealth(entra.health)
        };
        result.jira = {
            url: text(jira.url, 1000).replace(/\/+$/, ""),
            email: text(jira.email, 500),
            projectKey: text(jira.projectKey, 100),
            assetFieldId: text(jira.assetFieldId, 100),
            hostnameAttribute: text(jira.hostnameAttribute, 200) || "Hostname",
            workspaceId: text(jira.workspaceId, 200),
            cloudId: text(jira.cloudId, 200),
            aql: text(jira.aql, 4000) || "objectType = Computer",
            maxResults: Math.max(10, Math.min(500, Number(jira.maxResults) || 100)),
            verifyTls: asBoolean(jira.verifyTls, true),
            cmdbEnabled: asBoolean(jira.cmdbEnabled, true),
            approvalTransitionId: text(jira.approvalTransitionId, 100),
            closeTransitionId: text(jira.closeTransitionId, 100),
            health: normalizeHealth(jira.health)
        };
        result.defender = {
            tenantId: text(defender.tenantId, 200),
            clientId: text(defender.clientId, 200),
            incidentMode: ["active", "all"].indexOf(String(defender.incidentMode || "").toLowerCase()) >= 0 ? String(defender.incidentMode).toLowerCase() : "active",
            timeRange: ["none", "7d", "30d", "90d", "180d", "365d", "month", "year", "custom"].indexOf(String(defender.timeRange || "").toLowerCase()) >= 0 ? String(defender.timeRange).toLowerCase() : "30d",
            dateField: ["lastUpdateDateTime", "createdDateTime"].indexOf(String(defender.dateField || "")) >= 0 ? String(defender.dateField) : "lastUpdateDateTime",
            customFromUtc: text(defender.customFromUtc, 100),
            customToUtc: text(defender.customToUtc, 100),
            showIncidentId: text(defender.showIncidentId, 100),
            nameContains: text(defender.nameContains, 500),
            mdcaApiBaseUrl: text(defender.mdcaApiBaseUrl, 1000) || "https://portal.cloudappsecurity.com/cas/api",
            permissions: {
                incidents: normalizeGroups(object(defender.permissions).incidents, knownGroups),
                email: normalizeGroups(object(defender.permissions).email, knownGroups),
                trusted: normalizeGroups(object(defender.permissions).trusted, knownGroups),
                hunting: normalizeGroups(object(defender.permissions).hunting, knownGroups)
            },
            health: normalizeHealth(defender.health)
        };
        result.zabbix = {
            url: text(zabbix.url, 1000).replace(/\/+$/, ""),
            username: text(zabbix.username, 500),
            verifyTls: asBoolean(zabbix.verifyTls, true),
            health: normalizeHealth(zabbix.health)
        };

        if (result.jira.url && !/^https:\/\//i.test(result.jira.url)) {
            throw new Error("Jira URL must use HTTPS.");
        }
        if (result.zabbix.url && !/^https?:\/\//i.test(result.zabbix.url)) {
            throw new Error("Zabbix URL must use HTTP or HTTPS.");
        }
        return result;
    }

    function save(user, payload) {
        if (!shared.isSiteAdmin(user)) {
            return Promise.reject(new Error("Only Site Admin can change integrations."));
        }

        payload = object(payload);
        var knownGroups = shared.getUserGroups(parent).map(function (group) { return group.id; });
        var normalized = normalizePublic(payload.integrations, knownGroups);
        var secretInput = object(payload.secrets);

        return settings.update(function (current) {
            current.integrations = normalized;
            return current;
        }).then(function () {
            var currentSecrets = readSecrets();
            [
                "adPassword",
                "entraClientSecret",
                "jiraToken",
                "defenderClientSecret",
                "zabbixPassword",
                "zabbixToken"
            ].forEach(function (key) {
                var value = text(secretInput[key], 20000);
                if (value) currentSecrets[key] = value;
            });
            secrets.set(secretNamespace, currentSecrets);
            return publicSettings(user);
        });
    }

    function importValues(publicValues, secretValues) {
        publicValues = object(publicValues);
        secretValues = object(secretValues);
        return settings.update(function (current) {
            function mergeMissing(target, incoming) {
                target = target && typeof target === "object" && !Array.isArray(target) ? target : {};
                incoming = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
                Object.keys(incoming).forEach(function (key) {
                    var existing = target[key];
                    var value = incoming[key];
                    if (value && typeof value === "object" && !Array.isArray(value)) {
                        target[key] = mergeMissing(existing, value);
                        return;
                    }
                    var empty = existing == null || existing === "" ||
                        (Array.isArray(existing) && existing.length === 0);
                    if (empty && value != null && value !== "") {
                        target[key] = shared.copy(value);
                    }
                });
                return target;
            }
            current.integrations = mergeMissing(current.integrations || {}, publicValues);
            return current;
        }).then(function () {
            var currentSecrets = readSecrets();
            Object.keys(secretValues).forEach(function (key) {
                if (!currentSecrets[key] && secretValues[key]) {
                    currentSecrets[key] = String(secretValues[key]);
                }
            });
            secrets.set(secretNamespace, currentSecrets);
            return true;
        });
    }

    return {
        configured: configured,
        get: get,
        healthSummary: healthSummary,
        importValues: importValues,
        publicSettings: publicSettings,
        readSettings: readSettings,
        save: save
    };
};
