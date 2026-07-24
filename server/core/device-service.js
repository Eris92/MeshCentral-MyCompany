"use strict";
var shared = require("./shared.js");

module.exports.createDeviceService = function (options) {
    var parent = options.parent, source = options.source;

    function getWebServer() { return shared.getWebServer(parent); }

    function getServerCandidates() {
        var web = getWebServer();
        return [
            web,
            web && web.parent,
            parent && parent.parent,
            parent && parent.parent && parent.parent.parent,
            parent && parent.parent && parent.parent.parent && parent.parent.parent.parent
        ].filter(Boolean);
    }

    function getDatabase() {
        var candidates = getServerCandidates();
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].db && typeof candidates[i].db.GetAllTypeNoTypeFieldMeshFiltered === "function") return candidates[i].db;
        }
        return null;
    }

    function resolveNode(user, nodeId, settings) {
        settings = settings || {};
        return new Promise(function (resolve, reject) {
            var domain = shared.getDomain(parent, user, settings.domain);
            var value = String(nodeId || "").trim();
            if (!domain) { reject(new Error("MeshCentral domain is unavailable.")); return; }
            if (value.indexOf("/") < 0) value = "node/" + domain.id + "/" + value;
            var parts = value.split("/");
            if (parts.length !== 3 || parts[0] !== "node" || parts[1] !== domain.id) {
                reject(new Error("Invalid device identifier.")); return;
            }
            var web = settings.webServer || getWebServer();
            if (!web || typeof web.GetNodeWithRights !== "function") {
                reject(new Error("MeshCentral device API is unavailable.")); return;
            }
            web.GetNodeWithRights(domain, user, value, function (node, rights, visible) {
                rights = Number(rights) || 0;
                if (!node || rights === 0 || visible === false) {
                    reject(new Error("You do not have access to this device.")); return;
                }
                if (settings.requireCommandRights === true &&
                    ((rights & 24) !== 24) && ((rights & 0x00020000) === 0)) {
                    reject(new Error("You do not have permission to run commands on this device.")); return;
                }
                resolve({ domain: domain, node: node, nodeId: value, rights: rights, webServer: web });
            });
        });
    }

    function getMeshes() {
        var web = getWebServer(), mesh = parent && parent.parent;
        var sources = [web && web.meshes, mesh && mesh.meshes, mesh && mesh.parent && mesh.parent.meshes];
        for (var i = 0; i < sources.length; i++) if (sources[i] && typeof sources[i] === "object") return sources[i];
        return {};
    }

    function visibleMeshes(user) {
        var web = getWebServer(), all = getMeshes(), visible = {};
        try {
            if (web && typeof web.GetAllMeshWithRights === "function") {
                var value = web.GetAllMeshWithRights(user) || [];
                if (Array.isArray(value)) value.forEach(function (mesh) { if (mesh && mesh._id) visible[mesh._id] = mesh; });
                else Object.keys(value).forEach(function (id) { var mesh = value[id]; if (mesh) visible[mesh._id || id] = mesh; });
            }
        } catch (error) {}
        if (!Object.keys(visible).length) Object.keys(all).forEach(function (id) {
            var mesh = all[id];
            try {
                if (!web || typeof web.IsMeshViewable !== "function" || web.IsMeshViewable(user, mesh)) visible[mesh && mesh._id || id] = mesh;
            } catch (error) {}
        });
        return visible;
    }

    function connectivity(nodeId, node) {
        var candidates = getServerCandidates();
        for (var i = 0; i < candidates.length; i++) {
            if (typeof candidates[i].GetConnectivityState !== "function") continue;
            try {
                var state = candidates[i].GetConnectivityState(nodeId);
                if (state) {
                    if (state.connectivity != null) return Number(state.connectivity) || 0;
                    if (state.conn != null) return Number(state.conn) || 0;
                }
            } catch (error) {}
        }
        var web = getWebServer();
        var agents = web && (web.wsagents || web.parent && web.parent.wsagents) || {};
        if (agents[nodeId] && agents[nodeId].authenticated === 2) return 1;
        return Number(node && (node.conn != null ? node.conn : node.connectivity)) || 0;
    }

    function publicMeshRows(meshes) {
        return Object.keys(meshes).map(function (id) {
            var mesh = meshes[id] || {};
            return {
                id: String(mesh._id || id),
                name: shared.cleanText(mesh.name || mesh.mname || mesh.desc || id, 300)
            };
        }).sort(function (a, b) { return a.name.localeCompare(b.name, "pl", { sensitivity: "base" }); });
    }

    function publicNode(node) {
        var id = String(node && (node._id || node.nodeid || node.id) || "");
        return {
            id: id,
            meshId: String(node && (node.meshid || node.meshId || node.groupid) || ""),
            name: shared.cleanText(node && (node.name || node.hostname || node.host || id.split("/").pop()) || "Unknown device", 300),
            os: shared.cleanText(node && (node.osdesc || node.osDescription || node.os || node.platform || node.agent && node.agent.name) || "", 500),
            ip: shared.cleanText(node && (node.ip || node.ipaddr || node.ipAddress || node.host) || "", 200),
            lastSeen: node && (node.lastseen || node.lastSeen || node.lastconnect || node.lastConnect) || null,
            agentVersion: shared.cleanText(node && (node.agentversion || node.agentVersion || node.agent && (node.agent.ver || node.agent.version)) || "", 100),
            conn: connectivity(id, node)
        };
    }

    function memoryNodes(meshIds) {
        var candidates = getServerCandidates();
        var result = Object.create(null);
        candidates.forEach(function (candidate) {
            [candidate.nodes, candidate.meshNodes, candidate.allNodes].forEach(function (collection) {
                if (!collection || typeof collection !== "object") return;
                Object.keys(collection).forEach(function (key) {
                    var node = collection[key];
                    var meshId = String(node && (node.meshid || node.meshId || node.groupid) || "");
                    var id = String(node && (node._id || node.nodeid || node.id) || key);
                    if (id && meshIds.indexOf(meshId) >= 0) result[id] = node;
                });
            });
        });
        return Object.keys(result).map(function (id) { return result[id]; });
    }

    function visibleNodes(user) {
        var meshes = visibleMeshes(user);
        var meshIds = Object.keys(meshes);
        var domain = shared.getDomain(parent, user);
        var domainId = String(domain && domain.id != null ? domain.id : user && user.domain || "");
        var responseBase = { meshes: publicMeshRows(meshes), nodes: [] };
        if (!meshIds.length || !domain) return Promise.resolve(responseBase);

        var db = getDatabase();
        if (!db) {
            responseBase.nodes = memoryNodes(meshIds).map(publicNode).sort(function (a, b) { return a.name.localeCompare(b.name, "pl", { sensitivity: "base" }); });
            return Promise.resolve(responseBase);
        }

        return new Promise(function (resolve, reject) {
            try {
                db.GetAllTypeNoTypeFieldMeshFiltered(
                    meshIds,
                    null,
                    domainId,
                    "node",
                    null,
                    0,
                    0,
                    function (error, rows) {
                        if (error) { reject(error); return; }
                        var nodes = Array.isArray(rows) ? rows : [];
                        if (!nodes.length) nodes = memoryNodes(meshIds);
                        responseBase.nodes = nodes.map(publicNode).sort(function (a, b) {
                            return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
                        });
                        resolve(responseBase);
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    function sendRunCommands(context, command, responseId, sessionId) {
        return new Promise(function (resolve, reject) {
            var node = context.node, type = Number(command.type) || 1;
            if (!node.agent || node.agent.id == null) { reject(new Error("Device agent information is unavailable.")); return; }
            if ((node.agent.id > 0 && node.agent.id < 5) || (node.agent.id > 41 && node.agent.id < 44)) {
                if (type === 0) type = 1;
            } else if (type === 0) type = 3;
            var agentCommand = { action: "runcommands", type: type, cmds: command.cmd,
                runAsUser: Number(command.runAsUser) || 0, sessionid: sessionId || null,
                reply: true, responseid: responseId };
            var web = context.webServer;
            var agents = web.wsagents || web.parent && web.parent.wsagents ||
                parent.parent && parent.parent.wsagents || {};
            var agent = agents[context.nodeId];
            if (agent && agent.authenticated === 2 && agent.agentInfo) {
                try { agent.send(JSON.stringify(agentCommand)); resolve({ state: "sent", nodeId: context.nodeId }); }
                catch (error) { reject(new Error("Could not send command: " + error.message)); }
                return;
            }
            var multi = web.multiServer || web.parent && web.parent.multiServer ||
                parent.parent && parent.parent.multiServer;
            if (multi) {
                try {
                    multi.DispatchMessage({ action: "agentCommand", nodeid: context.nodeId, command: agentCommand });
                    resolve({ state: "queued", nodeId: context.nodeId });
                } catch (error) { reject(new Error("Could not route command: " + error.message)); }
                return;
            }
            reject(new Error("Device agent is not connected."));
        });
    }

    function auditCommand(context, user, command) {
        shared.dispatch(parent, source, ["*", "server-users", context.nodeId, user && user._id], {
            etype: "node", action: "runcommands", nodeid: context.nodeId,
            domain: String(context.domain && context.domain.id || ""),
            userid: user && user._id, username: shared.userName(user),
            msg: 'My Company: user "' + shared.userName(user) + '" started "' +
                String(command.label || "command") + '".', plugin: "SirkPlatform"
        });
    }

    return {
        auditCommand: auditCommand,
        getMeshes: getMeshes,
        getWebServer: getWebServer,
        resolveNode: resolveNode,
        sendRunCommands: sendRunCommands,
        visibleMeshes: visibleMeshes,
        visibleNodes: visibleNodes
    };
};