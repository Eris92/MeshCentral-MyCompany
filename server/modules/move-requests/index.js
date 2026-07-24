"use strict";

var shared = require("../../core/shared.js");

module.exports.createModule = function (context) {
    var unregister = null;

    function access(user) {
        return {
            allowed: !!user,
            siteAdmin: shared.isSiteAdmin(user)
        };
    }

    function meshRows(user) {
        var meshes = context.device.visibleMeshes(user);
        return Object.keys(meshes).map(function (id) {
            var mesh = meshes[id] || {};
            return {
                id: mesh._id || id,
                name: mesh.name || mesh.mname || id
            };
        }).sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
    }

    function normalizeLevelList(value) {
        if (value === 0 || value === "0") return [];
        if (!Array.isArray(value)) value = value == null ? [] : [value];
        return value.map(Number).filter(function (level, index, all) {
            return level >= 1 && level <= 3 && Math.floor(level) === level && all.indexOf(level) === index;
        }).sort();
    }

    function normalizeMeshApprovalLevels(value, allowedMeshIds) {
        value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        allowedMeshIds = Array.isArray(allowedMeshIds) ? allowedMeshIds.map(String) : [];
        var result = {};
        Object.keys(value).forEach(function (meshId) {
            meshId = String(meshId || "");
            if (!meshId || allowedMeshIds.indexOf(meshId) < 0) return;
            result[meshId] = normalizeLevelList(value[meshId]);
        });
        return result;
    }

    function configuredLevels(targetMeshId) {
        var config = context.settings.read().modules.moverequests || {};
        var levels = config.targetMeshApprovalLevels || {};
        if (!Object.prototype.hasOwnProperty.call(levels, targetMeshId)) return [1];
        return normalizeLevelList(levels[targetMeshId]);
    }

    function moveNode(payload, request) {
        var web = context.device.getWebServer();
        if (!web || typeof web.MoveNodeToMesh !== "function") {
            return Promise.resolve({
                message: "Move approved. MeshCentral MoveNodeToMesh API is unavailable in this build.",
                nodeId: payload.nodeId,
                targetMeshId: payload.targetMeshId
            });
        }
        return new Promise(function (resolve, reject) {
            try {
                web.MoveNodeToMesh(
                    payload.nodeId,
                    payload.targetMeshId,
                    request.requester && request.requester.id,
                    function (error) {
                        if (error) reject(new Error(String(error.message || error)));
                        else resolve({
                            message: "Device moved.",
                            nodeId: payload.nodeId,
                            targetMeshId: payload.targetMeshId
                        });
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    var provider = {
        type: "moverequests",
        moduleKey: "moverequests",
        title: "Move Requests",
        tabTitle: "Move Requests",
        description: "Device move requests and approval-aware group changes.",
        columns: ["createdAt", "title", "requester", "status"],
        normalizePayload: function (payload) {
            payload = payload || {};
            return {
                nodeId: shared.cleanText(payload.nodeId, 300),
                nodeName: shared.cleanText(payload.nodeName, 300),
                sourceMeshId: shared.cleanText(payload.sourceMeshId, 300),
                sourceMeshName: shared.cleanText(payload.sourceMeshName, 300),
                targetMeshId: shared.cleanText(payload.targetMeshId, 300),
                targetMeshName: shared.cleanText(payload.targetMeshName, 300)
            };
        },
        getTitle: function (payload) {
            return "Move " + (payload.nodeName || payload.nodeId || "device");
        },
        getSummary: function (payload) {
            return (payload.sourceMeshName || payload.sourceMeshId || "Current group") +
                " → " +
                (payload.targetMeshName || payload.targetMeshId);
        },
        getApprovalLevels: function (payload) {
            return configuredLevels(String(payload && payload.targetMeshId || ""));
        },
        canSubmit: function (user) {
            return !!user;
        },
        getResources: function (user, query) {
            return Promise.resolve(context.device.visibleNodes(user)).then(function (value) {
                var nodeId = String(query && query.nodeId || "");
                var nodes = value && value.nodes || [];
                return {
                    nodes: nodeId ? nodes.filter(function (node) { return String(node._id || node.nodeid || node.id || "") === nodeId; }) : nodes,
                    meshes: value && value.meshes || []
                };
            });
        },
        execute: moveNode
    };

    return {
        key: "moverequests",
        clientConfig: function () {
            var value = context.settings.read().modules.moverequests || {};
            return {
                key: "moverequests",
                name: "Move Requests",
                script: "moverequests.js",
                showInMenu: false,
                hostButtonEnabled: value.hostButtonEnabled !== false,
                toolbar: {
                    refresh: true,
                    clear: true,
                    favorites: false,
                    search: true,
                    manage: false,
                    settings: false
                }
            };
        },
        getAccess: access,
        initialize: function () {
            if (!unregister) unregister = context.approval.registerProvider(provider);
            return Promise.resolve();
        },
        apiGet: function (asset, req, user) {
            if (!user) throw new Error("Permission denied.");
            if (asset === "meshes") {
                return { ok: true, meshes: meshRows(user) };
            }
            if (asset === "requests") {
                var q = Object.assign({}, req && req.query || {}, {
                    type: "moverequests"
                });
                return context.approval.list(user, q).then(function (value) {
                    value.ok = true;
                    return value;
                });
            }
            if (asset === "settings") {
                if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
                var current = context.settings.read().modules.moverequests || {};
                return {
                    ok: true,
                    settings: current,
                    meshes: meshRows(user)
                };
            }
            throw new Error("Unknown Move Requests action.");
        },
        apiPost: function (asset, req, user) {
            var value = req && req.body || {};
            if (asset === "submit") {
                return context.approval.submit("moverequests", user, value, value.note)
                    .then(function (request) {
                        return { ok: true, request: request };
                    });
            }
            if (asset === "settings") {
                if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
                var allowedMeshes = meshRows(user).map(function (mesh) { return mesh.id; });
                return context.settings.update(function (current) {
                    current.modules.moverequests.hostButtonEnabled = value.hostButtonEnabled !== false;
                    current.modules.moverequests.menuEnabled = false;
                    if (Object.prototype.hasOwnProperty.call(value, "targetMeshApprovalLevels")) {
                        current.modules.moverequests.targetMeshApprovalLevels = normalizeMeshApprovalLevels(
                            value.targetMeshApprovalLevels,
                            allowedMeshes
                        );
                    }
                    return current;
                }).then(function () { return { ok: true }; });
            }
            throw new Error("Unknown Move Requests action.");
        }
    };
};
