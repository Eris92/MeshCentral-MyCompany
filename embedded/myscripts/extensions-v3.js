"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");
var core = require("./core.js");
var extendPrevious = require("./extensions-v2.js").extendModule;

function clean(value, limit) {
    return String(value == null ? "" : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .slice(0, limit || 1000);
}

module.exports.extendModule = function (base, config, parent, source) {
    base = extendPrevious(base, config, parent, source);

    var root = path.join(parent.pluginPath, "myscripts");
    var dataRoot = path.join(root, "data");
    var automationRoot = path.join(dataRoot, "automation");
    var automationStorePath = path.join(dataRoot, "automations.json");
    var originalCreateAutomation = base.createAutomation;

    function siteAdmin(user) {
        return core.isSiteAdmin(user);
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

    function normalizedId(value) {
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

    base.createAutomation = function (user, payload) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage automations.");
        payload = payload && typeof payload === "object" ? payload : {};

        var id = payload.id ? normalizedId(payload.id) : "";
        var before = id ? base.listAutomations(user).filter(function (item) { return item.id === id; })[0] : null;
        var result = originalCreateAutomation(user, payload);

        result.enabled = payload.enabled !== false;
        result.updatedAt = new Date().toISOString();
        if (before) {
            result.createdAt = before.createdAt || result.createdAt;
            result.createdBy = before.createdBy || result.createdBy;
        }

        var rows = base.listAutomations(user).filter(function (item) { return item.id !== result.id; });
        rows.push(result);
        writeJson(automationStorePath, rows);
        writeJson(path.join(automationRoot, result.id + ".json"), result);
        changeTaskState(result.id, result.enabled);
        return result;
    };

    base.setAutomationEnabled = function (user, id, enabled) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage automations.");
        id = normalizedId(id);
        var rows = base.listAutomations(user);
        var item = rows.filter(function (entry) { return entry.id === id; })[0];
        if (!item) throw new Error("Automation not found.");

        enabled = enabled === true || /^(1|true|yes|tak)$/i.test(String(enabled || ""));
        changeTaskState(id, enabled);
        item.enabled = enabled;
        item.updatedAt = new Date().toISOString();
        writeJson(automationStorePath, rows);
        writeJson(path.join(automationRoot, id + ".json"), item);
        return item;
    };

    return base;
};
