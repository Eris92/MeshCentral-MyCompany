"use strict";

var childProcess = require("child_process");
var core = require("./core.js");
var createOriginalPlugin = require("./plugin-v2.js").myscripts;

function clean(value, limit) {
    return String(value == null ? "" : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .slice(0, limit || 1000);
}

function bool(value) {
    return value === true || /^(1|true|yes|tak)$/i.test(String(value || ""));
}

module.exports.myscripts = function (parent) {
    var obj = createOriginalPlugin(parent);
    var fs = parent.fs;
    var path = parent.path;
    var root = path.join(parent.pluginPath, "myscripts");
    var dataRoot = path.join(root, "data");
    var automationRoot = path.join(dataRoot, "automation");
    var automationStorePath = path.join(dataRoot, "automations.json");
    var originalPost = obj.handleAdminPostReq;

    function sendJson(res, status, value) {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(value));
    }

    function ensureData() {
        fs.mkdirSync(dataRoot, { recursive: true });
        fs.mkdirSync(automationRoot, { recursive: true });
    }

    function readJson(file, fallback) {
        try {
            return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(file, value) {
        ensureData();
        var temporary = file + "." + process.pid + ".tmp";
        fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
        try {
            fs.renameSync(temporary, file);
        } catch (error) {
            fs.copyFileSync(temporary, file);
            fs.unlinkSync(temporary);
        }
    }

    function normalizeId(value) {
        return clean(value, 80).replace(/[^a-zA-Z0-9._-]/g, "-");
    }

    function taskName(id) {
        return "\\SirK Portal\\MyScripts\\" + id;
    }

    function taskExecutable() {
        return process.env.SystemRoot
            ? path.join(process.env.SystemRoot, "System32", "schtasks.exe")
            : "schtasks.exe";
    }

    function changeTaskState(id, enabled) {
        if (process.platform !== "win32") {
            throw new Error("Windows Task Scheduler automation is available only on Windows.");
        }
        var result = childProcess.spawnSync(
            taskExecutable(),
            ["/Change", "/TN", taskName(id), enabled ? "/ENABLE" : "/DISABLE"],
            { encoding: "utf8", windowsHide: true }
        );
        if (result.status !== 0) {
            throw new Error(clean(result.stderr || result.stdout || "Could not change scheduled task state.", 8000));
        }
    }

    function updateStoredAutomation(id, enabled, source) {
        id = normalizeId(id);
        var rows = readJson(automationStorePath, []);
        if (!Array.isArray(rows)) rows = [];
        var item = null;
        rows.forEach(function (entry) {
            if (entry && entry.id === id) item = entry;
        });
        if (!item && source) {
            item = source;
            rows.push(item);
        }
        if (!item) throw new Error("Automation not found.");

        item.enabled = enabled;
        item.updatedAt = new Date().toISOString();
        writeJson(automationStorePath, rows);
        writeJson(path.join(automationRoot, id + ".json"), item);
        return item;
    }

    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var body = req && req.body || {};

        if (asset === "automation-enable") {
            if (!core.isSiteAdmin(user)) {
                sendJson(res, 403, { ok: false, error: "Only Site Admin can manage automations." });
                return;
            }
            try {
                var id = normalizeId(body.id);
                var enabled = bool(body.enabled);
                changeTaskState(id, enabled);
                sendJson(res, 200, { ok: true, automation: updateStoredAutomation(id, enabled) });
            } catch (error) {
                sendJson(res, 400, { ok: false, error: String(error && error.message || error) });
            }
            return;
        }

        if (asset === "automations") {
            var payload = null;
            try {
                payload = JSON.parse(String(body.automation || "{}"));
            } catch (error) {
                payload = null;
            }

            var originalEnd = res.end;
            res.end = function (data, encoding, callback) {
                res.end = originalEnd;
                try {
                    if (payload && res.statusCode >= 200 && res.statusCode < 300) {
                        var response = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data || "{}"));
                        if (response.ok && response.automation && response.automation.id) {
                            var enabled = payload.enabled !== false;
                            changeTaskState(response.automation.id, enabled);
                            response.automation = updateStoredAutomation(response.automation.id, enabled, response.automation);
                            data = JSON.stringify(response);
                        }
                    }
                } catch (error) {
                    res.statusCode = 400;
                    data = JSON.stringify({ ok: false, error: String(error && error.message || error) });
                }
                return originalEnd.call(res, data, encoding, callback);
            };
        }

        return originalPost.call(obj, req, res, user);
    };

    return obj;
};
