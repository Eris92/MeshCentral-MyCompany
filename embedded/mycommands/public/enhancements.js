(function () {
    "use strict";
    var plugin = window.MyCommands;
    var core = window.MeshPluginCore;
    if (!plugin || !core || plugin.enhancementsInstalled) return;
    plugin.enhancementsInstalled = true;

    var originalInitialize = plugin.initialize;
    var originalRenderScripts = plugin.renderScripts;
    var originalRenderScriptTree = plugin.renderScriptTree;
    var originalRenderCategory = plugin.renderCategory;
    var originalAllowedCategoryKeys = plugin.allowedCategoryKeys;
    var originalRun = plugin.run;

    plugin.state.favorites = plugin.state.favorites || [];
    plugin.state.favoritesOnly = false;
    plugin.state.rawOutput = plugin.state.rawOutput || "";
    plugin.state.multiResult = null;
    plugin.favoritesKey = "mycommands-favorites-v2";

    function loadFavorites() {
        try { var value = JSON.parse(localStorage.getItem(plugin.favoritesKey) || "[]"); plugin.state.favorites = Array.isArray(value) ? value.map(String) : []; } catch (error) { plugin.state.favorites = []; }
    }
    function saveFavorites() { try { localStorage.setItem(plugin.favoritesKey, JSON.stringify(plugin.state.favorites)); } catch (error) { } }
    function isFavorite(path) { return plugin.state.favorites.indexOf(String(path || "")) >= 0; }
    function toggleFavorite(path) { path = String(path || ""); var index = plugin.state.favorites.indexOf(path); if (index >= 0) plugin.state.favorites.splice(index, 1); else plugin.state.favorites.push(path); saveFavorites(); plugin.renderScriptTree(); }
    function encodeVars(value) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(value || {})))); } catch (error) { return ""; } }
    function decodeVars(value) { try { return JSON.parse(decodeURIComponent(escape(atob(value || "")))); } catch (error) { return {}; } }
    function deepLink(item, values, nodes) {
        var url = new URL(location.href);
        url.searchParams.set("viewmode", String(plugin.state.config && plugin.state.config.viewMode || 102));
        if (item && item.path) { url.searchParams.set("commandType", "script"); url.searchParams.set("script", item.path); }
        else if (item && item.id) { url.searchParams.set("commandType", "preset"); url.searchParams.set("command", item.id); }
        if (values && Object.keys(values).length) url.searchParams.set("vars", encodeVars(values)); else url.searchParams.delete("vars");
        if (nodes && nodes.length) url.searchParams.set("nodes", nodes.join(",")); else url.searchParams.delete("nodes");
        return url.href;
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        var area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); try { document.execCommand("copy"); } finally { area.remove(); } return Promise.resolve();
    }
    function button(text, handler, title) { var value = document.createElement("button"); value.type = "button"; value.className = "btn btn-secondary btn-sm mycommands-toolbar-button"; value.textContent = text; value.title = title || text; value.setAttribute("aria-label", value.title); value.addEventListener("click", handler); return value; }
    function findScript(node, path) { if (!node) return null; if (node.type === "script" && node.path === path) return node; var children = node.children || []; for (var i = 0; i < children.length; i++) { var found = findScript(children[i], path); if (found) return found; } return null; }
    function findScripts(node, output) { output = output || []; if (!node) return output; if (node.type === "script") output.push(node); (node.children || []).forEach(function (child) { findScripts(child, output); }); return output; }
    function selectedRequest(values) {
        var selected = plugin.state.selected;
        if (!selected || !selected.item) return null;
        return selected.kind === "script" ? { pluginaction: "runScript", scriptPath: selected.item.path, variableValues: values || {} } : { pluginaction: "runPreset", commandId: selected.item.id, variableValues: values || {} };
    }
    function selectedRequiresApproval() { var selected = plugin.state.selected; return !!(selected && selected.item && selected.item.requiresApproval === true); }

    loadFavorites();

    plugin.allowedCategoryKeys = function () {
        var keys = originalAllowedCategoryKeys.call(plugin);
        if (keys.indexOf("results") < 0) keys.splice(Math.max(1, keys.length - (keys.indexOf("settings") >= 0 ? 1 : 0)), 0, "results");
        return keys;
    };

    plugin.renderCategory = function () {
        if (plugin.state.category === "results") { plugin.renderResults(); return; }
        return originalRenderCategory.call(plugin);
    };

    plugin.renderScripts = function (content) {
        originalRenderScripts.call(plugin, content);
        var toolbar = content.querySelector(".mycommands-script-toolbar");
        if (!toolbar) return;
        var searchHost = toolbar.querySelector(".mycommands-script-search");
        var favorite = button("★", function () { plugin.state.favoritesOnly = !plugin.state.favoritesOnly; favorite.classList.toggle("active", plugin.state.favoritesOnly); plugin.renderScriptTree(); }, "Show favorites");
        favorite.classList.toggle("active", plugin.state.favoritesOnly);
        var copy = button("🔗", function () { var selected = plugin.state.selected && plugin.state.selected.item; if (!selected) { plugin.setStatus("Select a script first.", true); return; } copyText(deepLink(selected, {}, [plugin.state.nodeId].filter(Boolean))).then(function () { plugin.setStatus("Link copied.", false); }); }, "Copy bookmarkable link");
        var multi = button("Hosts", plugin.openMultiHostDialog, "Run on multiple hosts"); multi.id = "MyCommandsMultiHostButton";
        var edit = button("Edit", plugin.openDefinitionEditor, "Edit script definition"); edit.id = "MyCommandsDefinitionButton"; edit.hidden = !(plugin.state.access && plugin.state.access.siteAdmin);
        toolbar.insertBefore(favorite, searchHost || null);
        toolbar.insertBefore(copy, searchHost || null);
        toolbar.insertBefore(multi, searchHost || null);
        toolbar.insertBefore(edit, searchHost || null);
    };

    plugin.renderScriptTree = function () {
        originalRenderScriptTree.call(plugin);
        var scripts = findScripts(plugin.state.scripts, []);
        var rows = document.querySelectorAll("#MyCommandsScriptTree .mycommands-script-row");
        Array.prototype.forEach.call(rows, function (row) {
            var main = row.querySelector("button.mycommands-script"); if (!main) return;
            var name = String(main.textContent || "").replace(/⏳/g, "").trim();
            var candidates = scripts.filter(function (item) { return item.name === name; });
            var item = candidates.length === 1 ? candidates[0] : candidates.filter(function (value) { return String(main.title || "").indexOf(value.path) >= 0; })[0];
            if (!item) return;
            row.setAttribute("data-script-path", item.path);
            if (plugin.state.favoritesOnly && !isFavorite(item.path)) { row.remove(); return; }
            var star = button(isFavorite(item.path) ? "★" : "☆", function (event) { event.stopPropagation(); toggleFavorite(item.path); }, isFavorite(item.path) ? "Remove from favorites" : "Add to favorites");
            star.className = "mycommands-favorite-button";
            row.insertBefore(star, row.firstChild);
            main.title = item.path + (item.summary ? " — " + item.summary : "");
        });
        if (plugin.state.favoritesOnly && !document.querySelector("#MyCommandsScriptTree .mycommands-script-row")) {
            var root = document.getElementById("MyCommandsScriptTree"); if (root) root.textContent = "No favorite scripts in this folder.";
        }
        var selected = plugin.state.selected && plugin.state.selected.item;
        var multi = document.getElementById("MyCommandsMultiHostButton");
        if (multi) multi.disabled = !(selected && selected.path);
        var edit = document.getElementById("MyCommandsDefinitionButton");
        if (edit) edit.disabled = !(selected && selected.path);
    };

    plugin.chooseCommand = function (command) {
        plugin.state.selected = { kind: "preset", item: command };
        if (!command.variables || !command.variables.length) { plugin.executeMany({ pluginaction: "runPreset", commandId: command.id, variableValues: {} }, [plugin.state.nodeId]); return; }
        plugin.renderVariableForm();
    };

    plugin.runSelected = function () {
        var selected = plugin.state.selected; if (!selected || !selected.item) return;
        var values = {}, missing = [];
        (selected.item.variables || []).forEach(function (variable, index) { var input = document.getElementById("MyCommandsVariable-" + index), value = input ? String(input.value || "") : ""; values[variable.name] = value; if (variable.required && !value.trim()) missing.push(variable.label); });
        var error = document.getElementById("MyCommandsVariableError"); if (missing.length) { if (error) error.textContent = "Complete the required fields: " + missing.join(", "); return; }
        var request = selectedRequest(values); if (!request) return;
        if (selectedRequiresApproval()) originalRun.call(plugin, request); else plugin.executeMany(request, [plugin.state.nodeId]);
    };

    plugin.run = function (request) {
        if (request && request.direct === true) { delete request.direct; plugin.executeMany(request, [plugin.state.nodeId]); return; }
        if (request && request.pluginaction !== "runScript") { plugin.executeMany(request, [plugin.state.nodeId]); return; }
        return originalRun.call(plugin, request);
    };

    plugin.executeMany = function (request, nodes) {
        nodes = (nodes || []).filter(Boolean);
        if (!nodes.length) { plugin.setStatus("Select at least one host.", true); return; }
        plugin.state.running = true; plugin.state.multiResult = null; plugin.state.rawOutput = ""; plugin.renderResult();
        core.apiRequest(window.MyCompanyAssetUrl("commands", "execute-many"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "nodeids=" + encodeURIComponent(JSON.stringify(nodes)) + "&request=" + encodeURIComponent(JSON.stringify(request || {})) }).then(function (response) {
            plugin.state.running = false; plugin.state.multiResult = response.result || null;
            plugin.state.rawOutput = (plugin.state.multiResult && plugin.state.multiResult.rows || []).map(function (row) { return "=== " + row.nodeId + " ===\n" + (row.output || row.error || ""); }).join("\n\n");
            plugin.state.output = plugin.state.rawOutput; plugin.renderResult(); plugin.setStatus("Completed: " + ((response.result && response.result.completed) || 0) + ", failed: " + ((response.result && response.result.failed) || 0) + ".", !!(response.result && response.result.failed));
        }).catch(function (error) { plugin.state.running = false; plugin.state.rawOutput = error.message || "Execution failed."; plugin.state.output = plugin.state.rawOutput; plugin.renderResult(); plugin.setStatus(plugin.state.rawOutput, true); });
    };

    plugin.openMultiHostDialog = function () {
        var selected = plugin.state.selected && plugin.state.selected.item; if (!selected || !selected.path) { plugin.setStatus("Select a script first.", true); return; }
        core.apiRequest(window.MyCompanyAssetUrl("commands", "script-metadata") + "&scriptPath=" + encodeURIComponent(selected.path)).then(function (response) {
            if (!response.metadata || response.metadata.multiHost !== true) throw new Error("This script is not enabled for multiple hosts. Use Edit and enable MultiHost.");
            var html = '<div id="MyCommandsMultiDialog"><p>Enter Mesh node IDs or host identifiers, one per line. The current node is included by default.</p><textarea id="MyCommandsMultiNodes" class="form-control" rows="10"></textarea><div id="MyCommandsMultiStatus" class="small text-muted mt-2"></div></div>';
            var submit = function () { var field = document.getElementById("MyCommandsMultiNodes"), nodes = String(field && field.value || "").split(/[\r\n,;]+/).map(function (item) { return item.trim(); }).filter(Boolean); var request = selectedRequest({}); if (selected.variables && selected.variables.length) { plugin.closeDialog(); plugin.renderVariableForm(); plugin.setStatus("Set variables, then use Hosts again with a deep link or single-host run.", true); return false; } plugin.closeDialog(); plugin.executeMany(request, nodes); return false; };
            plugin.showDialog("Run on multiple hosts", html, submit);
            var field = document.getElementById("MyCommandsMultiNodes"); if (field) field.value = plugin.state.nodeId || "";
        }).catch(function (error) { plugin.setStatus(error.message, true); });
    };

    plugin.showDialog = function (title, html, submit) {
        if (typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal")) { window.setModalContent("xxAddAgent", title, html); window.showModal("xxAddAgentModal", "idx_dlgOkButton", submit); }
        else if (typeof window.setDialogMode === "function") window.setDialogMode(2, title, 3, function (ok) { if (ok) submit(); }, html);
    };
    plugin.closeDialog = function () { var cancel = document.getElementById("idx_dlgCancelButton"); if (cancel) cancel.click(); else if (typeof window.setDialogMode === "function") window.setDialogMode(0); };

    plugin.openDefinitionEditor = function () {
        var selected = plugin.state.selected && plugin.state.selected.item; if (!selected || !selected.path || !(plugin.state.access && plugin.state.access.siteAdmin)) return;
        core.apiRequest(window.MyCompanyAssetUrl("commands", "definition") + "&scriptPath=" + encodeURIComponent(selected.path)).then(function (response) {
            var value = response.definition || {}, variables = (value.variables || []).map(function (item) { return item.directive + ": " + item.value; }).join("\n");
            var html = '<div id="MyCommandsDefinitionDialog"><label>Summary</label><input id="MyCommandsDefinitionSummary" class="form-control" type="text"><label class="mt-2">Run as</label><select id="MyCommandsDefinitionRunAs" class="form-select"><option value="0">Agent / SYSTEM</option><option value="1">Interactive user</option><option value="2">Interactive GUI</option></select><label class="form-check mt-2"><input id="MyCommandsDefinitionMulti" class="form-check-input" type="checkbox"> <span class="form-check-label">Allow multi-host execution</span></label><fieldset class="mt-2"><legend class="fs-6">Approval levels</legend><label><input type="checkbox" data-approval="1"> 1</label> <label><input type="checkbox" data-approval="2"> 2</label> <label><input type="checkbox" data-approval="3"> 3</label></fieldset><label class="mt-2">Variables (one per line: Directive: value)</label><textarea id="MyCommandsDefinitionVariables" class="form-control" rows="8"></textarea><p class="small text-muted mt-2">Supported directives: Variable, VariableRequired, VariableSwitch, VariableSwitchRequired, VariableSelect, VariableSelectRequired.</p><div id="MyCommandsDefinitionStatus" class="small text-muted"></div></div>';
            var submit = function () {
                var definition = { summary: document.getElementById("MyCommandsDefinitionSummary").value, runAsUser: Number(document.getElementById("MyCommandsDefinitionRunAs").value), multiHost: document.getElementById("MyCommandsDefinitionMulti").checked, approvalLevels: Array.prototype.map.call(document.querySelectorAll("#MyCommandsDefinitionDialog [data-approval]:checked"), function (item) { return Number(item.getAttribute("data-approval")); }), variables: String(document.getElementById("MyCommandsDefinitionVariables").value || "").split(/\r?\n/).map(function (line) { var index = line.indexOf(":"); return index > 0 ? { directive: line.slice(0, index).trim(), value: line.slice(index + 1).trim() } : null; }).filter(Boolean) };
                var status = document.getElementById("MyCommandsDefinitionStatus"); if (status) status.textContent = "Saving...";
                core.apiRequest(window.MyCompanyAssetUrl("commands", "definition"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "scriptPath=" + encodeURIComponent(selected.path) + "&definition=" + encodeURIComponent(JSON.stringify(definition)) }).then(function () { plugin.closeDialog(); plugin.state.scripts = null; plugin.loadScripts(true).then(plugin.renderScriptTree); plugin.setStatus("Script definition saved.", false); }).catch(function (error) { if (status) status.textContent = error.message; }); return false;
            };
            plugin.showDialog("Edit script definition", html, submit);
            document.getElementById("MyCommandsDefinitionSummary").value = value.summary || "";
            document.getElementById("MyCommandsDefinitionRunAs").value = String(value.runAsUser || 0);
            document.getElementById("MyCommandsDefinitionMulti").checked = value.multiHost === true;
            document.getElementById("MyCommandsDefinitionVariables").value = variables;
            (value.approvalLevels || []).forEach(function (level) { var box = document.querySelector('#MyCommandsDefinitionDialog [data-approval="' + level + '"]'); if (box) box.checked = true; });
        }).catch(function (error) { plugin.setStatus(error.message, true); });
    };

    function parseStructured(raw) {
        var text = String(raw || "").trim(), parsed = null;
        try { parsed = JSON.parse(text); } catch (error) { }
        if (parsed) {
            var table = parsed.meshTable === true ? parsed : (parsed.data && parsed.data.table ? parsed.data.table : (Array.isArray(parsed) ? { rows: parsed } : null));
            if (table) return { table: plugin.normalizeTable(table), raw: text };
        }
        var lines = text.split(/\r?\n/).filter(function (line) { return line.trim(); });
        if (lines.length > 1) {
            var delimiter = lines[0].indexOf(";") >= 0 ? ";" : (lines[0].indexOf(",") >= 0 ? "," : "");
            if (delimiter) {
                var columns = lines[0].split(delimiter).map(function (item) { return item.trim().replace(/^"|"$/g, ""); });
                var rows = lines.slice(1).map(function (line) { var values = line.split(delimiter), row = {}; columns.forEach(function (column, index) { row[column] = (values[index] || "").trim().replace(/^"|"$/g, ""); }); return row; });
                return { table: { columns: columns, rows: rows }, raw: text };
            }
        }
        return { table: null, raw: text };
    }

    plugin.renderResult = function () {
        var root = document.getElementById("MyCommandsResult"); if (!root) return; root.innerHTML = "";
        var status = document.createElement("div"); status.id = "MyCommandsRunStatus"; status.className = "mycommands-status"; status.textContent = plugin.state.running ? "Command is running..." : ""; root.appendChild(status);
        if (plugin.state.multiResult && Array.isArray(plugin.state.multiResult.rows)) {
            var summary = document.createElement("p"); summary.textContent = "Hosts: " + plugin.state.multiResult.total + ", completed: " + plugin.state.multiResult.completed + ", failed: " + plugin.state.multiResult.failed; root.appendChild(summary);
            plugin.state.table = { columns: ["nodeId", "status", "error", "output"], rows: plugin.state.multiResult.rows };
        }
        var structured = parseStructured(plugin.state.output || plugin.state.rawOutput || "");
        if (!plugin.state.table && structured.table) plugin.state.table = structured.table;
        if (plugin.state.table) { var host = document.createElement("div"); host.className = "mycommands-table-host"; root.appendChild(host); plugin.renderTable(host); }
        var details = document.createElement("details"); details.className = "mycommands-debug"; var label = document.createElement("summary"); label.textContent = "Debug / raw output"; details.appendChild(label); var output = document.createElement("textarea"); output.className = "mycommands-output"; output.readOnly = true; output.value = plugin.state.rawOutput || plugin.state.output || ""; output.placeholder = "Select a command or script to see its raw output."; details.appendChild(output); root.appendChild(details);
    };

    plugin.renderResults = function () {
        var content = document.getElementById("MyCommandsContent"); if (!content) return; content.innerHTML = "Loading results...";
        core.apiRequest(window.MyCompanyAssetUrl("commands", "results")).then(function (response) {
            content.innerHTML = ""; var rows = response.rows || [];
            if (!rows.length) { content.textContent = "No command results."; return; }
            var table = document.createElement("table"); table.className = "style1 mycommands-results-table";
            var head = table.createTHead().insertRow(); ["Date", "Action", "Hosts", "Approval", "Status", "Result", "Debug"].forEach(function (text) { var th = document.createElement("th"); th.textContent = text; head.appendChild(th); });
            var body = table.createTBody(); rows.forEach(function (item) {
                var row = body.insertRow(), levels = item.approvalLevels || item.requiredLevels || [], approvals = item.approvals || item.approvedLevels || [], resultRows = item.result && Array.isArray(item.result) ? item.result : (item.result && item.result.rows || []), result = item.result && item.result.message || (resultRows.length ? resultRows.map(function (entry) { return entry.nodeId + ": " + (entry.status || entry.error); }).join("\n") : "");
                [item.createdAt ? new Date(item.createdAt).toLocaleString() : "—", item.scriptPath || item.commandId || (item.fields && item.fields.command) || item.action || "—", (item.nodeIds || []).length || (item.fields && item.fields.device) || 1, levels.length ? approvals.length + "/" + levels.length : "0/0", item.status || "—", String(result || "—").slice(0, 180)].forEach(function (value) { var cell = row.insertCell(); cell.textContent = String(value); });
                var debug = row.insertCell(); var buttonValue = button("View", function () { plugin.state.output = result || JSON.stringify(item, null, 2); plugin.state.rawOutput = JSON.stringify(item, null, 2); plugin.state.table = resultRows.length ? { rows: resultRows } : null; plugin.renderResult(); }, "View result"); debug.appendChild(buttonValue);
            }); content.appendChild(table);
        }).catch(function (error) { content.textContent = error.message || "Could not load results."; });
    };

    plugin.initialize = function () {
        return originalInitialize.call(plugin).then(function (value) {
            var url = new URL(location.href), type = url.searchParams.get("commandType"), scriptPath = url.searchParams.get("script"), commandId = url.searchParams.get("command"), vars = decodeVars(url.searchParams.get("vars"));
            if (type === "script" && scriptPath) {
                return plugin.loadScripts(false).then(function () { var item = findScript(plugin.state.scripts, scriptPath); if (item) { plugin.state.selected = { kind: "script", item: item }; if (plugin.state.ui && plugin.state.ui.showInMenu) plugin.openStandalone(); if (item.variables && item.variables.length) plugin.renderVariableForm(); else if (url.searchParams.get("autorun") === "1") plugin.executeMany({ pluginaction: "runScript", scriptPath: item.path, variableValues: vars }, String(url.searchParams.get("nodes") || plugin.state.nodeId || "").split(",").filter(Boolean)); } });
            }
            if (type === "preset" && commandId) return plugin.loadCatalog().then(function (catalog) { Object.keys(catalog || {}).some(function (key) { var found = (catalog[key].commands || []).filter(function (item) { return item.id === commandId; })[0]; if (found) { plugin.state.selected = { kind: "preset", item: found }; if (found.variables && found.variables.length) plugin.renderVariableForm(); return true; } return false; }); });
            return value;
        });
    };
}());
