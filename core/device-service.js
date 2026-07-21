"use strict";
var shared = require("./shared.js");

module.exports.createDeviceService = function (options) {
    var parent = options.parent, source = options.source;
    function getWebServer() { return shared.getWebServer(parent); }
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
                String(command.label || "command") + '".', plugin: "MyCompany"
        });
    }
    return { auditCommand: auditCommand, getMeshes: getMeshes, getWebServer: getWebServer,
        resolveNode: resolveNode, sendRunCommands: sendRunCommands, visibleMeshes: visibleMeshes };
};
