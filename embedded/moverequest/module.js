"use strict";

var core = require("./core.js");

function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000);
}

module.exports.createModule = function (config, parent, source) {
    var meshServer = parent.parent;
    var bus = core.ensureApprovalBus(parent);
    var installUrl = "https://raw.githubusercontent.com/Eris92/MeshCentral-ApprovalCenter/main/config.json";
    var clientConfig = {
        name: String(config.name || "Move Request"),
        shortName: "moverequest",
        version: String(config.version || "2.1.1"),
        approvalCenterInstallUrl: installUrl
    };

    function getWebServer() { return core.getWebServer(parent); }
    function getDatabase() {
        var webServer = getWebServer();
        var candidates = [meshServer && meshServer.db, meshServer && meshServer.parent && meshServer.parent.db, webServer && webServer.parent && webServer.parent.db];
        for (var index = 0; index < candidates.length; index++) if (candidates[index] && typeof candidates[index].Set === "function") return candidates[index];
        return null;
    }
    function getDomain(user) {
        var id = String(user && user.domain || "");
        if (!id && user && user._id) { var parts = String(user._id).split("/"); if (parts.length > 1) id = parts[1]; }
        var webServer = getWebServer();
        var configs = [meshServer && meshServer.config, meshServer && meshServer.parent && meshServer.parent.config, webServer && webServer.parent && webServer.parent.config];
        for (var index = 0; index < configs.length; index++) if (configs[index] && configs[index].domains && configs[index].domains[id]) return configs[index].domains[id];
        return id ? { id: id } : null;
    }
    function getMeshes() {
        var webServer = getWebServer();
        var sources = [webServer && webServer.meshes, meshServer && meshServer.meshes, meshServer && meshServer.parent && meshServer.parent.meshes];
        for (var index = 0; index < sources.length; index++) if (sources[index] && typeof sources[index] === "object") return sources[index];
        return {};
    }
    function getUsers() {
        var webServer = getWebServer();
        return webServer && webServer.users || meshServer && meshServer.users || {};
    }
    function findUser(userId) {
        userId = String(userId || "");
        var users = getUsers();
        if (users[userId]) return users[userId];
        var keys = Object.keys(users);
        for (var index = 0; index < keys.length; index++) if (String(users[keys[index]] && users[keys[index]]._id || keys[index]) === userId) return users[keys[index]];
        return null;
    }
    function resolveNode(user, nodeId) {
        return new Promise(function (resolve, reject) {
            var domain = getDomain(user), webServer = getWebServer(), value = String(nodeId || "").trim();
            if (!user || !user._id) { reject(new Error("Authentication is required.")); return; }
            if (!domain || !webServer) { reject(new Error("MeshCentral node API is unavailable.")); return; }
            if (value.indexOf("/") < 0) value = "node/" + domain.id + "/" + value;
            var parts = value.split("/");
            if (parts.length !== 3 || parts[0] !== "node" || parts[1] !== domain.id) { reject(new Error("Invalid device identifier.")); return; }
            webServer.GetNodeWithRights(domain, user, value, function (node, rights, visible) {
                if (!node || rights === 0 || visible === false) { reject(new Error("You do not have access to this device.")); return; }
                resolve({ domain: domain, webServer: webServer, nodeId: value, node: node, rights: Number(rights) || 0 });
            });
        });
    }
    function visibleMeshes(user) {
        var webServer = getWebServer(), all = getMeshes(), visible = {};
        try {
            if (webServer && typeof webServer.GetAllMeshWithRights === "function") {
                var result = webServer.GetAllMeshWithRights(user) || [];
                if (Array.isArray(result)) result.forEach(function (mesh) { if (mesh && mesh._id) visible[mesh._id] = mesh; });
                else Object.keys(result).forEach(function (id) { var mesh = result[id]; if (mesh) visible[mesh._id || id] = mesh; });
            }
        } catch (error) { }
        if (!Object.keys(visible).length) Object.keys(all).forEach(function (id) {
            var mesh = all[id];
            try { if (!webServer || typeof webServer.IsMeshViewable !== "function" || webServer.IsMeshViewable(user, mesh)) visible[mesh && mesh._id || id] = mesh; } catch (error) { }
        });
        return visible;
    }
    function groupsForNode(context, user) {
        var meshes = visibleMeshes(user), all = getMeshes(), current = String(context.node.meshid || ""), domainId = current.split("/")[1] || String(context.domain.id || "");
        if (!meshes[current] && all[current]) meshes[current] = all[current];
        var rows = [], seenIds = Object.create(null), seenNames = Object.create(null);
        Object.keys(meshes).forEach(function (id) {
            var mesh = meshes[id];
            if (!mesh || mesh.deleted != null) return;
            var meshId = String(mesh._id || id), parts = meshId.split("/");
            if (parts.length !== 3 || parts[0] !== "mesh" || parts[1] !== domainId || (mesh.mtype != null && Number(mesh.mtype) !== 2)) return;
            var name = String(mesh.name || parts[2]).replace(/\s+/g, " ").trim(), idKey = meshId.toLowerCase(), nameKey = name.toLowerCase();
            if (seenIds[idKey] || seenNames[nameKey]) return;
            seenIds[idKey] = true; seenNames[nameKey] = true; rows.push({ id: meshId, name: name });
        });
        return rows.sort(function (left, right) { return left.name.localeCompare(right.name); });
    }
    async function getGroups(user, nodeId) {
        var context = await resolveNode(user, nodeId), meshes = getMeshes(), current = String(context.node.meshid || "");
        return { groups: groupsForNode(context, user), currentMeshId: current, currentMeshName: String(meshes[current] && meshes[current].name || current) };
    }
    async function validateRequest(payload, user) {
        payload = payload && typeof payload === "object" ? payload : {};
        var context = await resolveNode(user, payload.nodeId);
        var groups = groupsForNode(context, user), sourceId = String(context.node.meshid || ""), targetId = String(payload.targetMeshId || "");
        var sourceGroup = groups.filter(function (group) { return group.id === sourceId; })[0];
        var targetGroup = groups.filter(function (group) { return group.id === targetId; })[0];
        if (!sourceGroup || !targetGroup || sourceId === targetId) throw new Error("Choose another valid device group.");
        var deviceName = cleanText(context.node.name || context.nodeId, 200);
        return {
            payload: { nodeId: context.nodeId, sourceMeshId: sourceId, targetMeshId: targetId },
            resourceKey: context.nodeId,
            summary: deviceName + " → " + targetGroup.name,
            fields: { device: deviceName, sourceGroup: sourceGroup.name, targetGroup: targetGroup.name }
        };
    }
    function meshRights(webServer, user, meshId) {
        if (core.isSiteAdmin(user)) return 0xFFFFFFFF;
        if (!webServer || typeof webServer.GetMeshRights !== "function") return 0;
        try { return Number(webServer.GetMeshRights(user, meshId)) || 0; } catch (error) { return 0; }
    }
    async function executeApproved(payload, request) {
        var approver = findUser(request && request.approver && request.approver.id);
        if (!approver && request && Array.isArray(request.requiredApprovalLevels) && request.requiredApprovalLevels.length === 0) {
            approver = findUser(request.requester && request.requester.id);
        }
        if (!approver) throw new Error("The approving MeshCentral user is no longer available.");
        var context = await resolveNode(approver, payload && payload.nodeId), meshes = getMeshes();
        var sourceId = String(payload && payload.sourceMeshId || ""), targetId = String(payload && payload.targetMeshId || "");
        if (String(context.node.meshid || "") === targetId) return { message: "The device is already in the approved target group.", data: { nodeId: context.nodeId, targetMeshId: targetId } };
        if (String(context.node.meshid || "") !== sourceId) throw new Error("The device group changed after the request was submitted.");
        var sourceMesh = meshes[sourceId], targetMesh = meshes[targetId];
        if (!sourceMesh || !targetMesh || targetMesh.deleted != null) throw new Error("The source or target device group is unavailable.");
        if (Number(sourceMesh.mtype) !== Number(targetMesh.mtype)) throw new Error("Device groups are of different types.");
        if ((context.rights & 0x00000001) === 0 || (meshRights(context.webServer, approver, targetId) & 0x00000001) === 0) throw new Error("The approver does not have edit rights to both device groups.");
        var database = getDatabase();
        if (!database) throw new Error("MeshCentral database is unavailable.");

        var oldMeshId = String(context.node.meshid), cleanNode;
        context.node.meshid = targetId;
        try {
            cleanNode = typeof context.webServer.cleanDevice === "function" ? context.webServer.cleanDevice(context.node) : context.node;
            database.Set(cleanNode);
        } catch (error) {
            context.node.meshid = oldMeshId;
            throw new Error("Could not move the device: " + cleanText(error && error.message || error, 500));
        }
        var agent = context.webServer.wsagents && context.webServer.wsagents[context.nodeId];
        if (agent) {
            agent.dbMeshKey = targetId;
            agent.meshid = targetId.split("/")[2];
            if (typeof agent.sendUpdatedIntelAmtPolicy === "function") agent.sendUpdatedIntelAmtPolicy();
        }
        if (meshServer && meshServer.mqttbroker && typeof meshServer.mqttbroker.changeDeviceMesh === "function") meshServer.mqttbroker.changeDeviceMesh(context.nodeId, targetId);
        if (meshServer && meshServer.mpsserver && typeof meshServer.mpsserver.changeDeviceMesh === "function") meshServer.mpsserver.changeDeviceMesh(context.nodeId, targetId);
        if (typeof database.Get === "function") database.Get("lc" + context.nodeId, function (error, rows) {
            if (!error && rows && rows.length === 1 && rows[0].meshid !== targetId) { rows[0].meshid = targetId; database.Set(rows[0]); }
        });
        var targets = ["*", context.nodeId, oldMeshId, targetId];
        if (typeof context.webServer.CreateMeshDispatchTargets === "function") {
            try { targets = context.webServer.CreateMeshDispatchTargets(targetId, [oldMeshId, context.nodeId]); } catch (error) { }
        }
        core.dispatch(parent, source, targets, {
            etype: "node",
            userid: approver._id,
            username: core.userName(approver),
            action: "nodemeshchange",
            nodeid: context.nodeId,
            node: context.node,
            oldMeshId: oldMeshId,
            newMeshId: targetId,
            msgid: 85,
            msgArgs: [context.node.name, targetMesh.name],
            msg: "Moved device " + context.node.name + " to group " + targetMesh.name,
            domain: context.domain.id
        });
        return { message: "Device moved to " + String(targetMesh.name || targetId) + ".", data: { nodeId: context.nodeId, oldMeshId: oldMeshId, targetMeshId: targetId } };
    }
    function formatRequest(request) {
        var fields = Object.assign({}, request.fields || {});
        if (request.result && request.result.message) fields.result = cleanText(request.result.message, 500);
        return fields;
    }

    bus.registerProvider({
        type: "moverequest",
        title: "Move requests",
        tabTitle: "Move Requests",
        settingsTitle: "Move Request approvers",
        description: "Requests to move MeshCentral devices between device groups.",
        version: clientConfig.version,
        installUrl: installUrl,
        finalStatusOnSuccess: "approved",
        columns: [
            { key: "device", label: "Device" },
            { key: "sourceGroup", label: "Source group" },
            { key: "targetGroup", label: "Target group" },
            { key: "result", label: "Result" }
        ],
        api: {
            resourceDescription: "Pass nodeId as a query parameter to list visible target device groups.",
            payloadSchema: {
                type: "object",
                required: ["nodeId", "targetMeshId"],
                additionalProperties: false,
                properties: {
                    nodeId: { type: "string", description: "MeshCentral node ID, for example node/domain/node-id." },
                    targetMeshId: { type: "string", description: "Target device group ID, for example mesh/domain/group-id." }
                }
            },
            resources: function (user, query) {
                var nodeId = String(query && query.nodeId || "").trim();
                if (!nodeId) return { requiredQuery: ["nodeId"] };
                return getGroups(user, nodeId);
            }
        },
        canSubmit: function (user) { return !!(user && user._id); },
        validate: validateRequest,
        execute: executeApproved,
        formatRequest: formatRequest
    });

    return {
        getClientConfig: function () {
            var result = Object.assign({}, clientConfig);
            result.approvalAvailable = !!(bus.service && typeof bus.service.submit === "function");
            return result;
        },
        getGroups: getGroups,
        submit: function (user, nodeId, targetMeshId, note) {
            if (!bus.service || typeof bus.service.submit !== "function") return Promise.reject(new Error("Approval Center is not installed. Install it from: " + installUrl));
            return bus.service.submit("moverequest", user, { nodeId: nodeId, targetMeshId: targetMeshId }, note);
        }
    };
};
