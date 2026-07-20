(function () {
    "use strict";
    var plugin = window.MyScripts;
    var core = window.MeshPluginCore;
    if (!plugin || !core || plugin.enhancementsInstalled) return;
    plugin.enhancementsInstalled = true;

    var originalInitialize = plugin.initialize;
    var originalBuildContent = plugin.buildContent;
    var originalRenderTree = plugin.renderTree;
    var originalRenderDirectory = plugin.renderDirectory;
    var originalFilterTree = plugin.filterTree;
    var originalRenderOutput = plugin.renderOutput;
    var originalOpenRequestDialog = plugin.openRequestDialog;

    plugin.favoritesKey = "myscripts.favorites.v2";
    plugin.state.favorites = [];
    plugin.state.favoritesOnly = false;
    plugin.state.deepLinkVars = {};

    function loadFavorites() { try { var value = JSON.parse(localStorage.getItem(plugin.favoritesKey) || "[]"); plugin.state.favorites = Array.isArray(value) ? value.map(String) : []; } catch (error) { plugin.state.favorites = []; } }
    function saveFavorites() { try { localStorage.setItem(plugin.favoritesKey, JSON.stringify(plugin.state.favorites)); } catch (error) { } }
    function favorite(path) { return plugin.state.favorites.indexOf(String(path || "")) >= 0; }
    function toggleFavorite(path) { path = String(path || ""); var index = plugin.state.favorites.indexOf(path); if (index >= 0) plugin.state.favorites.splice(index, 1); else plugin.state.favorites.push(path); saveFavorites(); plugin.renderTree(); }
    function encodeVars(value) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(value || {})))); } catch (error) { return ""; } }
    function decodeVars(value) { try { return JSON.parse(decodeURIComponent(escape(atob(value || "")))); } catch (error) { return {}; } }
    function copyText(text) { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); var field = document.createElement("textarea"); field.value = text; field.style.position = "fixed"; field.style.opacity = "0"; document.body.appendChild(field); field.select(); try { document.execCommand("copy"); } finally { field.remove(); } return Promise.resolve(); }
    function button(text, handler, title) { var value = document.createElement("button"); value.type = "button"; value.className = "btn btn-secondary btn-sm myscripts-toolbar-button"; value.textContent = text; value.title = title || text; value.setAttribute("aria-label", value.title); value.addEventListener("click", handler); return value; }
    function selectedScript() { return plugin.state.selectedPath ? plugin.findScript(plugin.state.tree, plugin.state.selectedPath) : null; }
    function scriptLink(script, variables) { var url = new URL(location.href); url.searchParams.set("viewmode", String(plugin.state.config && plugin.state.config.viewMode || 101)); url.searchParams.set("script", script.path); if (variables && Object.keys(variables).length) url.searchParams.set("vars", encodeVars(variables)); else url.searchParams.delete("vars"); return url.href; }
    function showDialog(title, html, submit) { if (typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal")) { window.setModalContent("xxAddAgent", title, html); window.showModal("xxAddAgentModal", "idx_dlgOkButton", submit || function () { return true; }); } else if (typeof window.setDialogMode === "function") window.setDialogMode(2, title, submit ? 3 : 1, function (ok) { if (ok && submit) submit(); }, html); }
    function closeDialog() { var cancel = document.getElementById("idx_dlgCancelButton"); if (cancel) cancel.click(); else if (typeof window.setDialogMode === "function") window.setDialogMode(0); }
    function formatLocal(value) { if (!value) return "—"; try { return new Date(value).toLocaleString(); } catch (error) { return String(value); } }

    loadFavorites();

    plugin.buildContent = function (body) {
        originalBuildContent.call(plugin, body);
        var toolbar = body.querySelector(".myscripts-script-toolbar"); if (!toolbar || toolbar.getAttribute("data-enhanced") === "1") return;
        toolbar.setAttribute("data-enhanced", "1");
        var search = toolbar.querySelector(".myscripts-search");
        var fav = button("★", function () { plugin.state.favoritesOnly = !plugin.state.favoritesOnly; fav.classList.toggle("active", plugin.state.favoritesOnly); plugin.renderTree(); }, "Show favorites"); fav.classList.toggle("active", plugin.state.favoritesOnly);
        var link = button("🔗", function () { var script = selectedScript(); if (!script) { plugin.setStatus("Select a script first.", "myscripts-status-error"); return; } copyText(scriptLink(script, {})).then(function () { plugin.setStatus("Bookmarkable link copied.", "myscripts-status-ok"); }); }, "Copy bookmarkable script link");
        toolbar.insertBefore(fav, search || null); toolbar.insertBefore(link, search || null);
        if (plugin.state.access && plugin.state.access.siteAdmin) {
            var manage = button("Manage", function () { var bar = document.getElementById("MyScriptsManageBar"); if (bar) bar.hidden = !bar.hidden; }, "Script, credentials, automation and monitoring settings"); toolbar.insertBefore(manage, search || null);
            var manageBar = document.createElement("div"); manageBar.id = "MyScriptsManageBar"; manageBar.className = "myscripts-manage-bar"; manageBar.hidden = true;
            manageBar.appendChild(button("Edit script", plugin.openDefinitionEditor, "Edit script directives and variables"));
            manageBar.appendChild(button("Credentials", function () { var tabs = body.querySelectorAll(".myscripts-tabs td"); if (tabs[2]) tabs[2].dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); }, "Edit global credentials and permissions"));
            manageBar.appendChild(button("Automation", plugin.openAutomationManager, "Windows Task Scheduler automations"));
            manageBar.appendChild(button("Monitoring", plugin.openMonitoringManager, "Zabbix maintenance"));
            toolbar.parentNode.insertBefore(manageBar, toolbar.nextSibling);
        }
    };

    plugin.filterTree = function (node, query) {
        var filtered = originalFilterTree.call(plugin, node, query);
        if (!plugin.state.favoritesOnly || !filtered) return filtered;
        function keep(item) {
            if (item.type === "script") return favorite(item.path) ? item : null;
            var value = {}; Object.keys(item).forEach(function (key) { value[key] = item[key]; }); value.children = (item.children || []).map(keep).filter(Boolean); return value.children.length ? value : null;
        }
        return keep(filtered);
    };

    plugin.renderTree = function () {
        originalRenderTree.call(plugin);
        Array.prototype.forEach.call(document.querySelectorAll("#MyScriptsRoots .myscripts-root"), function (root) { var label = root.textContent.trim(); root.title = label; root.setAttribute("aria-label", label); });
        var script = selectedScript();
        var manage = document.getElementById("MyScriptsManageBar"); if (manage) Array.prototype.forEach.call(manage.querySelectorAll("button"), function (item, index) { if (index === 0 || index === 2) item.disabled = !script; });
    };

    plugin.renderDirectory = function (host, directory, root) {
        var before = host.children.length;
        originalRenderDirectory.call(plugin, host, directory, root);
        var scripts = (directory.children || []).filter(function (item) { return item.type === "script"; });
        var rows = Array.prototype.slice.call(host.querySelectorAll(":scope > .myscripts-script")).slice(before);
        rows.forEach(function (row) {
            var main = row.querySelector(".myscripts-script-button"); if (!main) return;
            var label = String(main.textContent || "").replace(/⏳|🔑/g, "").trim();
            var script = scripts.filter(function (item) { return (item.label || item.name) === label; })[0]; if (!script) return;
            row.setAttribute("data-script-path", script.path);
            var star = button(favorite(script.path) ? "★" : "☆", function (event) { event.stopPropagation(); toggleFavorite(script.path); }, favorite(script.path) ? "Remove from favorites" : "Add to favorites"); star.className = "myscripts-favorite-button"; row.insertBefore(star, row.firstChild);
            main.addEventListener("click", function () { plugin.state.selectedPath = script.path; });
            if (!(plugin.state.access && plugin.state.access.siteAdmin)) { var secret = main.querySelector(".myscripts-secret-button"); if (secret) secret.remove(); }
        });
    };

    function parseStructured(message) {
        var text = String(message || "").trim(), parsed = null;
        try { parsed = JSON.parse(text); } catch (error) { }
        if (parsed) {
            if (parsed.meshPortal === true) return { portal: parsed, raw: text };
            var table = parsed.meshTable === true ? parsed : (parsed.data && parsed.data.table ? parsed.data.table : (Array.isArray(parsed) ? { rows: parsed } : null));
            if (table) return { table: table, raw: text };
        }
        var lines = text.split(/\r?\n/).filter(function (line) { return line.trim(); });
        if (lines.length > 1) {
            var delimiter = lines[0].indexOf(";") >= 0 ? ";" : (lines[0].indexOf(",") >= 0 ? "," : "");
            if (delimiter) {
                var columns = lines[0].split(delimiter).map(function (item) { return item.trim().replace(/^"|"$/g, ""); });
                var rows = lines.slice(1).map(function (line) { var values = line.split(delimiter), row = {}; columns.forEach(function (column, index) { row[column] = String(values[index] || "").trim().replace(/^"|"$/g, ""); }); return row; });
                return { table: { title: "Result", columns: columns, rows: rows }, raw: text };
            }
        }
        return { raw: text };
    }
    function renderTable(host, table) {
        var rows = Array.isArray(table && table.rows) ? table.rows : [], columns = Array.isArray(table && table.columns) ? table.columns.slice() : [];
        if (!columns.length && rows.length) columns = Object.keys(rows[0] || {});
        var wrap = document.createElement("div"); wrap.className = "myscripts-output-table-wrap"; var result = document.createElement("table"); result.className = typeof window.setModalContent === "function" ? "table table-hover table-striped align-middle myscripts-output-table" : "style1 myscripts-output-table";
        var head = result.createTHead().insertRow(); columns.forEach(function (column) { var th = document.createElement("th"); th.textContent = column; head.appendChild(th); });
        var body = result.createTBody(); rows.forEach(function (source) { var row = body.insertRow(); columns.forEach(function (column) { plugin.appendOutputValue(row.insertCell(), source && source[column]); }); }); wrap.appendChild(result); host.appendChild(wrap);
    }
    plugin.renderOutput = function (host, message, emptyText, stateClass) {
        if (!host) return;
        var data = parseStructured(message); host.innerHTML = ""; host.className = "myscripts-output" + (stateClass ? " " + stateClass : "");
        if (!data.raw) { var empty = document.createElement("span"); empty.className = "myscripts-output-empty"; empty.textContent = emptyText || "Select a script to see its result."; host.appendChild(empty); return; }
        var main = document.createElement("div"); main.className = "myscripts-output-main"; host.appendChild(main);
        if (data.table) { var title = document.createElement("h3"); title.textContent = data.table.title || "Result"; main.appendChild(title); renderTable(main, data.table); }
        else originalRenderOutput.call(plugin, main, message, emptyText, stateClass);
        var debug = document.createElement("details"); debug.className = "myscripts-debug"; var summary = document.createElement("summary"); summary.textContent = "Debug / raw output"; debug.appendChild(summary); var pre = document.createElement("pre"); pre.className = "myscripts-result-full"; pre.textContent = data.raw; debug.appendChild(pre); host.appendChild(debug);
    };

    plugin.loadResults = function () {
        var panel = document.getElementById("MyScriptsResultsPanel"); if (!panel) return; panel.innerHTML = "";
        var state = plugin.state.results || (plugin.state.results = { filter: "", status: "", page: 1, perPage: 20 });
        var toolbar = document.createElement("div"); toolbar.className = "myscripts-results-toolbar";
        var filter = document.createElement("input"); filter.type = "search"; filter.placeholder = "Filter"; filter.value = state.filter; filter.className = "myscripts-results-filter"; toolbar.appendChild(filter);
        var statusFilter = document.createElement("select"); [["", "All statuses"], ["pending", "Pending"], ["executing", "Executing"], ["completed", "Completed"], ["failed", "Failed"], ["rejected", "Rejected"], ["replaced", "Replaced"]].forEach(function (pair) { var option = document.createElement("option"); option.value = pair[0]; option.textContent = pair[1]; statusFilter.appendChild(option); }); statusFilter.value = state.status; toolbar.appendChild(statusFilter);
        var refresh = document.createElement("input"); refresh.type = "button"; refresh.value = "Refresh"; refresh.className = "btn btn-primary btn-sm"; toolbar.appendChild(refresh); panel.appendChild(toolbar);
        var status = document.createElement("span"); status.className = "myscripts-status"; status.textContent = "Loading results..."; panel.appendChild(status);
        var tableHost = document.createElement("div"); tableHost.className = "myscripts-results-host"; panel.appendChild(tableHost);
        function render(rows) {
            tableHost.innerHTML = ""; var query = state.filter.toLowerCase(), filtered = rows.filter(function (item) { var fields = item.fields || {}, text = [item.createdAt, fields.script, item.summary, item.status, item.requester && item.requester.name, item.approver && item.approver.name, item.result && item.result.message].join(" ").toLowerCase(); return (!query || text.indexOf(query) >= 0) && (!state.status || item.status === state.status); });
            var pageCount = Math.max(1, Math.ceil(filtered.length / state.perPage)); if (state.page > pageCount) state.page = pageCount; var visible = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
            if (!visible.length) { tableHost.textContent = "No script requests or results."; return; }
            var table = document.createElement("table"); table.className = "style1 myscripts-results-table"; var head = table.createTHead().insertRow(); ["DateTime", "Script", "Requester", "Approver", "Approval", "Status", "Result", "View"].forEach(function (label) { var th = document.createElement("th"); th.textContent = label; head.appendChild(th); });
            var body = table.createTBody(); visible.forEach(function (item) {
                var row = body.insertRow(), fields = item.fields || {}, resultData = item.result || {}, progress = item.approvalProgress || { text: "0/0" }, message = resultData.message || (item.status === "pending" ? "Waiting for approval." : item.status === "executing" ? "Executing..." : "—");
                [formatLocal(item.createdAt), fields.script || item.summary || "—", item.requester && item.requester.name || "—", item.approver && item.approver.name || "—", progress.text || ((progress.approved || 0) + "/" + (progress.total || 0)), item.status || "—", String(message).slice(0, 180)].forEach(function (value) { var cell = row.insertCell(); cell.textContent = String(value); });
                var viewCell = row.insertCell(); var view = button("View", function () { var html = '<div id="MyScriptsEnhancedResult"></div>'; showDialog("Script result", html); var host = document.getElementById("MyScriptsEnhancedResult"); plugin.renderOutput(host, message, "No output.", ""); }, "View structured result and debug output"); viewCell.appendChild(view);
            }); tableHost.appendChild(table);
            var pager = document.createElement("div"); pager.className = "myscripts-results-pager"; var previous = button("Previous", function () { if (state.page > 1) { state.page--; render(rows); } }); previous.disabled = state.page <= 1; var label = document.createElement("span"); label.textContent = "Page " + state.page + " of " + pageCount + " (" + filtered.length + ")"; var next = button("Next", function () { if (state.page < pageCount) { state.page++; render(rows); } }); next.disabled = state.page >= pageCount; pager.appendChild(previous); pager.appendChild(label); pager.appendChild(next); tableHost.appendChild(pager);
        }
        filter.oninput = function () { state.filter = filter.value.trim(); state.page = 1; render(plugin.state.resultRows || []); }; statusFilter.onchange = function () { state.status = statusFilter.value; state.page = 1; render(plugin.state.resultRows || []); }; refresh.onclick = plugin.loadResults;
        core.apiRequest(plugin.url("results")).then(function (result) { plugin.state.resultRows = result.rows || []; status.textContent = ""; render(plugin.state.resultRows); }).catch(function (error) { status.textContent = error.message || "Could not load script results."; status.className = "myscripts-status myscripts-status-error"; });
    };

    plugin.openDefinitionEditor = function () {
        var script = selectedScript(); if (!script || !(plugin.state.access && plugin.state.access.siteAdmin)) { plugin.setStatus("Select a script first.", "myscripts-status-error"); return; }
        core.apiRequest(plugin.url("definition", { scriptPath: script.path })).then(function (response) {
            var value = response.definition || {};
            var html = '<div id="MyScriptsDefinitionDialog"><label>Label</label><input id="MyScriptsDefinitionLabel" class="form-control" type="text"><label class="mt-2">Description</label><textarea id="MyScriptsDefinitionDescription" class="form-control" rows="3"></textarea><fieldset class="mt-2"><legend class="fs-6">Approval levels</legend><label><input type="checkbox" data-approval="1"> 1</label> <label><input type="checkbox" data-approval="2"> 2</label> <label><input type="checkbox" data-approval="3"> 3</label></fieldset><label class="mt-2">Variables (Directive: value)</label><textarea id="MyScriptsDefinitionVariables" class="form-control" rows="8"></textarea><label class="mt-2">Saved credentials (SaveSecret: value)</label><textarea id="MyScriptsDefinitionSecrets" class="form-control" rows="5"></textarea><div id="MyScriptsDefinitionStatus" class="small text-muted mt-2"></div></div>';
            var submit = function () {
                function parse(id) { return String(document.getElementById(id).value || "").split(/\r?\n/).map(function (line) { var index = line.indexOf(":"); return index > 0 ? { directive: line.slice(0, index).trim(), value: line.slice(index + 1).trim() } : null; }).filter(Boolean); }
                var definition = { label: document.getElementById("MyScriptsDefinitionLabel").value, description: document.getElementById("MyScriptsDefinitionDescription").value, approvalLevels: Array.prototype.map.call(document.querySelectorAll("#MyScriptsDefinitionDialog [data-approval]:checked"), function (box) { return Number(box.getAttribute("data-approval")); }), variables: parse("MyScriptsDefinitionVariables"), secretVariables: parse("MyScriptsDefinitionSecrets") };
                var status = document.getElementById("MyScriptsDefinitionStatus"); status.textContent = "Saving...";
                core.apiRequest(plugin.url("definition"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "scriptPath=" + encodeURIComponent(script.path) + "&definition=" + encodeURIComponent(JSON.stringify(definition)) }).then(function () { closeDialog(); plugin.loadScripts(); plugin.setStatus("Script definition saved.", "myscripts-status-ok"); }).catch(function (error) { status.textContent = error.message; }); return false;
            };
            showDialog("Edit script definition", html, submit);
            document.getElementById("MyScriptsDefinitionLabel").value = value.label || script.label || script.name;
            document.getElementById("MyScriptsDefinitionDescription").value = value.description || "";
            document.getElementById("MyScriptsDefinitionVariables").value = (value.variables || []).map(function (item) { return item.directive + ": " + item.value; }).join("\n");
            document.getElementById("MyScriptsDefinitionSecrets").value = (value.secretVariables || []).map(function (item) { return item.directive + ": " + item.value; }).join("\n");
            (value.approvalLevels || []).forEach(function (level) { var box = document.querySelector('#MyScriptsDefinitionDialog [data-approval="' + level + '"]'); if (box) box.checked = true; });
        }).catch(function (error) { plugin.setStatus(error.message, "myscripts-status-error"); });
    };

    plugin.openAutomationManager = function () {
        if (!(plugin.state.access && plugin.state.access.siteAdmin)) return;
        var script = selectedScript();
        var html = '<div id="MyScriptsAutomationDialog"><p>Automations are created as Windows Task Scheduler tasks running as SYSTEM.</p><label>Name</label><input id="MyScriptsAutomationName" class="form-control" type="text"><label class="mt-2">Schedule</label><select id="MyScriptsAutomationType" class="form-select"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="HOURLY">Hourly</option><option value="ONCE">Once</option></select><label class="mt-2">Time (HH:mm)</label><input id="MyScriptsAutomationTime" class="form-control" type="time" value="03:00"><label class="mt-2">Date for once (YYYY/MM/DD)</label><input id="MyScriptsAutomationDate" class="form-control" type="text"><label class="mt-2">Weekly days (MON,TUE,...)</label><input id="MyScriptsAutomationDays" class="form-control" type="text" value="MON"><label class="mt-2">Hourly interval</label><input id="MyScriptsAutomationInterval" class="form-control" type="number" min="1" max="23" value="1"><div id="MyScriptsAutomationList" class="mt-3">Loading...</div><div id="MyScriptsAutomationStatus" class="small text-muted mt-2"></div></div>';
        var submit = function () { if (!script) { document.getElementById("MyScriptsAutomationStatus").textContent = "Select a script before creating an automation."; return false; } var payload = { name: document.getElementById("MyScriptsAutomationName").value || script.label || script.name, scriptPath: script.path, variables: {}, schedule: { type: document.getElementById("MyScriptsAutomationType").value, time: document.getElementById("MyScriptsAutomationTime").value || "03:00", date: document.getElementById("MyScriptsAutomationDate").value, days: document.getElementById("MyScriptsAutomationDays").value || "MON", interval: Number(document.getElementById("MyScriptsAutomationInterval").value) || 1 } }; var status = document.getElementById("MyScriptsAutomationStatus"); status.textContent = "Creating scheduled task..."; core.apiRequest(plugin.url("automations"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "automation=" + encodeURIComponent(JSON.stringify(payload)) }).then(function () { status.textContent = "Automation created."; plugin.loadAutomationList(); }).catch(function (error) { status.textContent = error.message; }); return false; };
        showDialog("Automation", html, submit); document.getElementById("MyScriptsAutomationName").value = script ? (script.label || script.name) : ""; plugin.loadAutomationList();
    };
    plugin.loadAutomationList = function () { var host = document.getElementById("MyScriptsAutomationList"); if (!host) return; core.apiRequest(plugin.url("automations")).then(function (response) { host.innerHTML = ""; var rows = response.rows || []; if (!rows.length) { host.textContent = "No automations."; return; } rows.forEach(function (item) { var row = document.createElement("div"); row.className = "myscripts-automation-row"; var text = document.createElement("span"); text.textContent = item.name + " — " + item.scriptPath + " — " + (item.schedule && item.schedule.type || ""); row.appendChild(text); row.appendChild(button("Delete", function () { core.apiRequest(plugin.url("automation-delete"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "id=" + encodeURIComponent(item.id) }).then(plugin.loadAutomationList); }, "Delete scheduled task")); host.appendChild(row); }); }).catch(function (error) { host.textContent = error.message; }); };

    plugin.openMonitoringManager = function () {
        if (!(plugin.state.access && plugin.state.access.siteAdmin)) return;
        var html = '<div id="MyScriptsMonitoringDialog"><section><h3>Zabbix API</h3><label>URL</label><input id="MyScriptsZabbixUrl" class="form-control" type="url"><label class="mt-2">API token (leave blank to keep current)</label><input id="MyScriptsZabbixToken" class="form-control" type="password"><label class="form-check mt-2"><input id="MyScriptsZabbixVerifyTls" class="form-check-input" type="checkbox" checked> <span class="form-check-label">Verify TLS certificate</span></label><button id="MyScriptsZabbixSave" type="button" class="btn btn-secondary btn-sm mt-2">Save Zabbix settings</button></section><section class="mt-3"><h3>Maintenance</h3><label>Name</label><input id="MyScriptsMaintenanceName" class="form-control" type="text" value="SirK Portal maintenance"><label class="mt-2">Zabbix host IDs (comma separated)</label><input id="MyScriptsMaintenanceHosts" class="form-control" type="text"><label class="mt-2">Start</label><input id="MyScriptsMaintenanceStart" class="form-control" type="datetime-local"><label class="mt-2">End</label><input id="MyScriptsMaintenanceEnd" class="form-control" type="datetime-local"><label class="form-check mt-2"><input id="MyScriptsMaintenanceCollect" class="form-check-input" type="checkbox"> <span class="form-check-label">Collect data during maintenance</span></label><button id="MyScriptsMaintenanceCreate" type="button" class="btn btn-secondary btn-sm mt-2">Create maintenance</button><div id="MyScriptsMaintenanceList" class="mt-3">Loading...</div></section><div id="MyScriptsMonitoringStatus" class="small text-muted mt-2"></div></div>';
        showDialog("Monitoring / Zabbix", html);
        var now = new Date(), later = new Date(now.getTime() + 3600000); function localDate(value) { var offset = value.getTimezoneOffset() * 60000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
        document.getElementById("MyScriptsMaintenanceStart").value = localDate(now); document.getElementById("MyScriptsMaintenanceEnd").value = localDate(later);
        document.getElementById("MyScriptsZabbixSave").onclick = function () { var status = document.getElementById("MyScriptsMonitoringStatus"), settings = { url: document.getElementById("MyScriptsZabbixUrl").value, token: document.getElementById("MyScriptsZabbixToken").value, verifyTls: document.getElementById("MyScriptsZabbixVerifyTls").checked }; status.textContent = "Saving..."; core.apiRequest(plugin.url("zabbix-settings"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "settings=" + encodeURIComponent(JSON.stringify(settings)) }).then(function () { status.textContent = "Zabbix settings saved."; plugin.loadMaintenanceList(); }).catch(function (error) { status.textContent = error.message; }); };
        document.getElementById("MyScriptsMaintenanceCreate").onclick = function () { var status = document.getElementById("MyScriptsMonitoringStatus"), start = new Date(document.getElementById("MyScriptsMaintenanceStart").value), end = new Date(document.getElementById("MyScriptsMaintenanceEnd").value), maintenance = { name: document.getElementById("MyScriptsMaintenanceName").value, hostids: document.getElementById("MyScriptsMaintenanceHosts").value.split(/[\s,;]+/).filter(Boolean), activeSince: Math.floor(start.getTime() / 1000), activeTill: Math.floor(end.getTime() / 1000), maintenanceType: document.getElementById("MyScriptsMaintenanceCollect").checked ? 0 : 1 }; status.textContent = "Creating maintenance..."; core.apiRequest(plugin.url("zabbix-maintenance"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "maintenance=" + encodeURIComponent(JSON.stringify(maintenance)) }).then(function () { status.textContent = "Maintenance created."; plugin.loadMaintenanceList(); }).catch(function (error) { status.textContent = error.message; }); };
        core.apiRequest(plugin.url("zabbix-settings")).then(function (response) { var settings = response.settings || {}; document.getElementById("MyScriptsZabbixUrl").value = settings.url || ""; document.getElementById("MyScriptsZabbixVerifyTls").checked = settings.verifyTls !== false; document.getElementById("MyScriptsZabbixToken").placeholder = settings.tokenConfigured ? "Configured" : "Required"; plugin.loadMaintenanceList(); }).catch(function (error) { document.getElementById("MyScriptsMonitoringStatus").textContent = error.message; });
    };
    plugin.loadMaintenanceList = function () { var host = document.getElementById("MyScriptsMaintenanceList"); if (!host) return; core.apiRequest(plugin.url("zabbix-maintenance")).then(function (response) { host.innerHTML = ""; var rows = response.rows || []; if (!rows.length) { host.textContent = "No Zabbix maintenance entries."; return; } rows.forEach(function (item) { var row = document.createElement("div"); row.className = "myscripts-maintenance-row"; var text = document.createElement("span"); text.textContent = item.name + " — " + new Date(Number(item.active_since) * 1000).toLocaleString() + " → " + new Date(Number(item.active_till) * 1000).toLocaleString(); row.appendChild(text); row.appendChild(button("Delete", function () { core.apiRequest(plugin.url("zabbix-maintenance-delete"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "ids=" + encodeURIComponent(JSON.stringify([item.maintenanceid])) }).then(plugin.loadMaintenanceList); }, "Delete maintenance")); host.appendChild(row); }); }).catch(function (error) { host.textContent = error.message; }); };

    plugin.openRequestDialog = function (script, direct) { originalOpenRequestDialog.call(plugin, script, direct); var values = plugin.state.deepLinkVars || {}; window.setTimeout(function () { Object.keys(values).forEach(function (key) { var control = document.querySelector('#MyScriptsRequestDialog [data-variable-name="' + CSS.escape(key) + '"]'); if (control) control.value = values[key]; }); }, 0); };

    plugin.initialize = function () {
        return originalInitialize.call(plugin).then(function (value) {
            var url = new URL(location.href), path = url.searchParams.get("script"); plugin.state.deepLinkVars = decodeVars(url.searchParams.get("vars"));
            if (!path) return value;
            return new Promise(function (resolve) { var wait = function () { if (!plugin.state.tree) { plugin.loadScripts(); setTimeout(wait, 150); return; } var script = plugin.findScript(plugin.state.tree, path); if (script) { plugin.state.selectedPath = script.path; var parts = script.path.split("/"); plugin.state.selectedRoot = parts[0] || plugin.state.selectedRoot; plugin.open(); setTimeout(plugin.renderTree, 0); } resolve(value); }; wait(); });
        });
    };
}());
