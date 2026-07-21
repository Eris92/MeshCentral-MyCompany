"use strict";

var shared = require("./shared.js");
var settingsFactory = require("./settings-store.js");
var secretsFactory = require("./secret-store.js");
var approvalFactory = require("./approval-service.js");
var deviceFactory = require("./device-service.js");
var integrationFactory = require("./integration-service.js");

var VERSION = "1.3.1";
var DEFAULTS = {
    schemaVersion: 3,
    modules: {
        myscripts: {
            enabled: true,
            accessGroupIds: [],
            folderPermissions: {}
        },
        mycommands: {
            enabled: true,
            accessGroupIds: [],
            folderPermissions: {},
            showInMenu: false,
            showOnDevice: true,
            maxMultiHostNodes: 200,
            multiHostConcurrency: 8
        },
        myjira: {
            enabled: false,
            accessGroupIds: []
        },
        defendertools: {
            enabled: false
        },
        approvalcenter: {
            enabled: true,
            retentionDays: 365,
            providers: {}
        },
        moverequests: {
            enabled: true,
            hostButtonEnabled: true,
            menuEnabled: false
        }
    },
    integrations: {
        ad: {
            domain: "",
            login: ""
        },
        entra: {
            tenantId: "",
            clientId: ""
        },
        jira: {
            url: "",
            email: "",
            projectKey: "",
            assetFieldId: "",
            hostnameAttribute: "Hostname",
            workspaceId: "",
            cloudId: "",
            aql: "objectType = Computer",
            maxResults: 100,
            verifyTls: true,
            cmdbEnabled: true,
            approvalTransitionId: "",
            closeTransitionId: ""
        },
        defender: {
            tenantId: "",
            clientId: "",
            incidentMode: "active",
            timeRange: "30d",
            dateField: "lastUpdateDateTime",
            customFromUtc: "",
            customToUtc: "",
            showIncidentId: "",
            nameContains: "",
            mdcaApiBaseUrl: "https://portal.cloudappsecurity.com/cas/api",
            permissions: {
                incidents: [],
                email: [],
                trusted: [],
                hunting: []
            }
        },
        zabbix: {
            url: "",
            username: "",
            verifyTls: true
        }
    }
};

module.exports.createRuntime = function (options) {
    var parent = options.parent;
    var pluginRoot = options.pluginRoot;
    var fs = parent.fs || require("fs");
    var nativePath = parent.path || require("path");
    var meshServer = parent.parent;
    var dataBase = meshServer && meshServer.datapath
        ? meshServer.datapath
        : nativePath.dirname(parent.pluginPath);
    var dataRoot = nativePath.join(dataBase, "mycompany-data");

    if (!fs.existsSync(dataRoot)) {
        fs.mkdirSync(dataRoot, { recursive: true });
    }

    var scriptRootAliases = Object.create(null);

    function aliasKey(value) {
        return nativePath.normalize(String(value || "")).toLowerCase();
    }

    scriptRootAliases[aliasKey(
        nativePath.join(dataRoot, "myscripts", "scripts")
    )] = nativePath.join(pluginRoot, "seed", "MyScripts");

    scriptRootAliases[aliasKey(
        nativePath.join(dataRoot, "scripts", "MyCommands")
    )] = nativePath.join(pluginRoot, "seed", "MyCommands");

    var modulePath = Object.create(nativePath);
    modulePath.join = function () {
        var joined = nativePath.join.apply(nativePath, arguments);
        return scriptRootAliases[aliasKey(joined)] || joined;
    };

    var settings = settingsFactory.createSettingsStore({
        fs: fs,
        path: nativePath,
        filePath: nativePath.join(dataRoot, "settings.json"),
        defaults: DEFAULTS
    });

    var secrets = secretsFactory.createSecretStore({
        fs: fs,
        path: nativePath,
        dataPath: nativePath.join(dataRoot, "secrets.json"),
        keyPath: nativePath.join(dataRoot, ".secret.key")
    });

    var integrations = integrationFactory.createIntegrationService({
        parent: parent,
        settings: settings,
        secrets: secrets
    });

    var context = {
        dataRoot: dataRoot,
        fs: fs,
        integrations: integrations,
        parent: parent,
        path: modulePath,
        nativePath: nativePath,
        pluginRoot: pluginRoot,
        scriptRoots: {
            myscripts: nativePath.join(pluginRoot, "seed", "MyScripts"),
            mycommands: nativePath.join(pluginRoot, "seed", "MyCommands")
        },
        settings: settings,
        secrets: secrets,
        source: options.source
    };

    context.device = deviceFactory.createDeviceService({
        parent: parent,
        source: options.source
    });

    context.approval = approvalFactory.createApprovalService({
        fs: fs,
        path: nativePath,
        parent: parent,
        source: options.source,
        settings: settings,
        databasePath: nativePath.join(dataRoot, "requests.json")
    });

    context.isModuleEnabled = settings.isModuleEnabled;

    var modules = {};
    var moduleLoadErrors = {};
    var moduleDescriptors = [
        { key: "approvalcenter", name: "Approval Center", path: "../modules/ApprovalCenter/index.js" },
        { key: "moverequests", name: "Move Requests", path: "../modules/MoveRequests/index.js" },
        { key: "mycommands", name: "My Commands", path: "../modules/MyCommands/index.js" },
        { key: "myjira", name: "My Jira", path: "../modules/MyJira/index.js" },
        { key: "defendertools", name: "Defender XDR", path: "../modules/DefenderTools/index.js" },
        { key: "myscripts", name: "My Scripts", path: "../modules/MyScripts/index.js" }
    ];

    function errorText(error) {
        return String(
            error && (error.stack || error.message) ||
            error ||
            "Unknown module load error."
        );
    }

    function failedModule(descriptor, error) {
        var message = errorText(error);
        return {
            __loadError: message,
            key: descriptor.key,
            clientConfig: function () {
                return {
                    key: descriptor.key,
                    name: descriptor.name,
                    version: VERSION,
                    loadError: message
                };
            },
            getAccess: function () {
                return {
                    allowed: false,
                    siteAdmin: false,
                    error: message
                };
            },
            initialize: function () {
                return Promise.resolve();
            },
            apiGet: function () {
                throw new Error("Module failed to load: " + message);
            },
            apiPost: function () {
                throw new Error("Module failed to load: " + message);
            }
        };
    }

    moduleDescriptors.forEach(function (descriptor) {
        try {
            var factory = require(descriptor.path);
            if (!factory || typeof factory.createModule !== "function") {
                throw new Error("Module factory does not export createModule().");
            }
            var module = factory.createModule(context);
            if (!module || typeof module.key !== "string") {
                throw new Error("Module factory returned an invalid module.");
            }
            modules[descriptor.key] = module;
        } catch (error) {
            var message = errorText(error);
            moduleLoadErrors[descriptor.key] = message;
            console.error("MyCompany module load failed: " + descriptor.key, error);
            modules[descriptor.key] = failedModule(descriptor, error);
        }
    });

    function initialize() {
        return Promise.all(Object.keys(modules).map(function (key) {
            return Promise.resolve(modules[key].initialize());
        }));
    }

    function diagnostics(user) {
        var current = settings.read();
        return Object.keys(modules).map(function (key) {
            var module = modules[key];
            var config = current.modules[key] || { enabled: false };
            return {
                key: key,
                name: module.clientConfig().name,
                enabled: config.enabled !== false,
                builtIn: true,
                ready: !module.__loadError,
                error: module.__loadError || null,
                access: module.getAccess(user)
            };
        });
    }

    function bootstrap(user) {
        var result = {};
        Object.keys(modules).forEach(function (key) {
            result[key] = {
                enabled: settings.isModuleEnabled(key),
                ready: !modules[key].__loadError,
                error: modules[key].__loadError || null,
                config: modules[key].clientConfig(),
                access: modules[key].getAccess(user)
            };
        });
        return {
            ok: true,
            version: VERSION,
            modules: result
        };
    }

    function request(method, moduleName, asset, req, res, user) {
        if (moduleName === "_runtime" && method === "GET") {
            shared.sendJson(res, 200, bootstrap(user));
            return;
        }

        var module = modules[String(moduleName || "").toLowerCase()];
        if (!module) {
            shared.sendJson(res, 404, {
                ok: false,
                error: "Unknown MyCompany module."
            });
            return;
        }

        if (module.__loadError) {
            shared.sendJson(res, 503, {
                ok: false,
                error: "Module failed to load.",
                detail: module.__loadError
            });
            return;
        }

        if (!settings.isModuleEnabled(module.key)) {
            shared.sendJson(res, 403, {
                ok: false,
                error: module.clientConfig().name + " is disabled."
            });
            return;
        }

        var operation;
        try {
            operation = method === "POST"
                ? module.apiPost(asset, req, user)
                : module.apiGet(asset, req, user);
        } catch (error) {
            shared.sendJson(res, 400, {
                ok: false,
                error: String(error && error.message || error)
            });
            return;
        }

        Promise.resolve(operation).then(function (value) {
            shared.sendJson(res, 200, value);
        }).catch(function (error) {
            var message = String(error && error.message || error);
            var status = /permission|access|disabled/i.test(message)
                ? 403
                : /not found|unavailable|missing/i.test(message)
                    ? 404
                    : 400;
            shared.sendJson(res, status, {
                ok: false,
                error: message
            });
        });
    }

    function normalizeGroups(value, knownGroups) {
        value = Array.isArray(value) ? value : [];
        return value.map(String).filter(function (id, index, list) {
            return knownGroups.indexOf(id) >= 0 && list.indexOf(id) === index;
        });
    }

    function saveAdminSettings(user, payload) {
        if (!shared.isSiteAdmin(user)) {
            return Promise.reject(new Error("Permission denied."));
        }

        payload = payload || {};
        var moduleValues = payload.modules || {};
        var moduleOptions = payload.moduleOptions || {};
        var knownGroups = shared.getUserGroups(parent).map(function (group) {
            return group.id;
        });

        return settings.update(function (current) {
            Object.keys(modules).forEach(function (key) {
                if (Object.prototype.hasOwnProperty.call(moduleValues, key)) {
                    current.modules[key].enabled = moduleValues[key] === true;
                }
            });

            current.modules.mycommands.showInMenu = false;
            current.modules.moverequests.menuEnabled = false;

            if (moduleOptions.myjira) {
                current.modules.myjira.accessGroupIds = normalizeGroups(
                    moduleOptions.myjira.accessGroupIds,
                    knownGroups
                );
            }
            return current;
        }).then(function () {
            return integrations.save(user, {
                integrations: payload.integrations || {},
                secrets: payload.secrets || {}
            });
        }).then(function () {
            return adminSnapshot(user);
        });
    }

    function adminSnapshot(user) {
        if (!shared.isSiteAdmin(user)) return null;
        return {
            plugin: {
                name: "My Company",
                version: VERSION
            },
            modules: diagnostics(user),
            moduleSettings: settings.read().modules,
            integrations: integrations.publicSettings(user),
            migration: {
                completed: true,
                disabled: true,
                message: "Legacy migration is disabled. Script libraries are read directly from the MyCompany seed directory."
            },
            moduleLoadErrors: shared.copy(moduleLoadErrors),
            generatedAt: new Date().toISOString()
        };
    }

    function updateModules(user, values) {
        return saveAdminSettings(user, {
            modules: values,
            moduleOptions: {
                myjira: settings.read().modules.myjira
            },
            integrations: integrations.readSettings(),
            secrets: {}
        });
    }

    function captureAgentData(command, agent) {
        if (
            settings.isModuleEnabled("mycommands") &&
            modules.mycommands &&
            !modules.mycommands.__loadError &&
            typeof modules.mycommands.captureAgentData === "function"
        ) {
            modules.mycommands.captureAgentData(command, agent);
        }
    }

    return {
        adminSnapshot: adminSnapshot,
        bootstrap: bootstrap,
        captureAgentData: captureAgentData,
        context: context,
        diagnostics: diagnostics,
        initialize: initialize,
        integrations: integrations,
        migration: {
            status: function () {
                return adminSnapshot({ siteadmin: 0xFFFFFFFF }).migration;
            }
        },
        moduleLoadErrors: moduleLoadErrors,
        modules: modules,
        request: request,
        saveAdminSettings: saveAdminSettings,
        settings: settings,
        updateModules: updateModules,
        version: VERSION
    };
};
