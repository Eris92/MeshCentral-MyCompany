(function () {
    "use strict";

    var plugin = window.MyScripts;
    var core = window.MeshPluginCore;
    if (!plugin || !core || plugin.uiFixesInstalled) return;
    plugin.uiFixesInstalled = true;

    var originalBuildContent = plugin.buildContent;
    var originalRenderTree = plugin.renderTree;
    var originalRenderDirectory = plugin.renderDirectory;
    var originalBuildSettings = plugin.buildSettings;
    var originalLoadSettings = plugin.loadSettings;
    var originalLoadResults = plugin.loadResults;

    plugin.state.manageMode = plugin.state.manageMode === true;
    plugin.state.linkPickMode = plugin.state.linkPickMode === true;

    function button(text, handler, title, className) {
        var value = document.createElement("button");
        value.type = "button";
        value.className = className || "btn btn-secondary btn-sm myscripts-toolbar-button";
        value.textContent = text;
        value.title = title || text;
        value.setAttribute("aria-label", value.title);
        if (handler) value.addEventListener("click", handler);
        return value;
    }

    function post(asset, values) {
        var body = Object.keys(values || {}).map(function (key) {
            return encodeURIComponent(key) + "=" + encodeURIComponent(values[key] == null ? "" : String(values[key]));
        }).join("&");
        return core.apiRequest(plugin.url(asset), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body
        });
    }

    function closeDialog() {
        var cancel = document.getElementById("idx_dlgCancelButton");
        if (cancel) cancel.click();
        else if (typeof window.setDialogMode === "function") window.setDialogMode(0);
    }

    function showDialog(title, html, submit, okText) {
        if (typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal")) {
            window.setModalContent("xxAddAgent", title, html);
            window.showModal("xxAddAgentModal", "idx_dlgOkButton", submit || function () { return true; });
            if (typeof plugin.resetModalCancel === "function") plugin.resetModalCancel();
            var ok = document.getElementById("idx_dlgOkButton");
            if (ok) {
                ok.textContent = okText || "Save";
                ok.className = "btn btn-primary";
            }
        } else if (typeof window.setDialogMode === "function") {
            window.setDialogMode(2, title, submit ? 3 : 1, function (confirmed) {
                if (confirmed && submit) submit();
            }, html);
        }
    }

    function findToolbar() {
        return document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
    }

    function findSearchToggle(toolbar) {
        if (!toolbar) return null;
        var direct = document.getElementById("MyScriptsSearchToggle");
        if (direct) return direct;
        var buttons = toolbar.querySelectorAll("button.myscripts-toolbar-button");
        for (var index = 0; index < buttons.length; index++) {
            var title = String(buttons[index].title || "").toLowerCase();
            if (title.indexOf("search") >= 0 || String(buttons[index].textContent || "").trim() === "⌕") return buttons[index];
        }
        return buttons.length > 1 ? buttons[1] : null;
    }

    function syncToolbar() {
        var toolbar = findToolbar();
        if (!toolbar) return;
        var searchHost = toolbar.querySelector(".myscripts-search");
        var searchToggle = findSearchToggle(toolbar);
        var collapse = toolbar.querySelector("button.myscripts-toolbar-button");
        if (collapse) collapse.id = "MyScriptsCollapseToggle";
        if (searchToggle) {
            searchToggle.id = "MyScriptsSearchToggle";
            if (searchHost) toolbar.insertBefore(searchToggle, searchHost);
            else toolbar.appendChild(searchToggle);
        }
    }

    plugin.updateTreeToolbar = function () {
        var toolbar = findToolbar();
        var collapse = document.getElementById("MyScriptsCollapseToggle") || (toolbar && toolbar.querySelector("button.myscripts-toolbar-button"));
        var searchToggle = document.getElementById("MyScriptsSearchToggle") || findSearchToggle(toolbar);
        var searchBar = toolbar && toolbar.querySelector(".myscripts-search");
        var roots = document.getElementById("MyScriptsRoots");
        var layout = document.querySelector("#MyScriptsMainPanel .myscripts-layout");

        if (collapse) {
            collapse.textContent = plugin.state.folderMenuCollapsed ? "▶" : "◀";
            collapse.title = plugin.state.folderMenuCollapsed ? "Expand folders" : "Collapse folders";
            collapse.setAttribute("aria-label", collapse.title);
        }
        if (searchToggle) {
            searchToggle.textContent = "⌕";
            searchToggle.title = plugin.state.searchVisible ? "Hide search" : "Show search";
            searchToggle.setAttribute("aria-label", searchToggle.title);
        }
        if (searchBar) searchBar.hidden = !plugin.state.searchVisible;
        if (roots) roots.classList.toggle("myscripts-roots-collapsed", plugin.state.folderMenuCollapsed);
        if (layout) layout.classList.toggle("myscripts-layout-collapsed", plugin.state.folderMenuCollapsed);
        syncToolbar();
    };

    function setManageMode(enabled) {
        plugin.state.manageMode = enabled === true;
        var buttonNode = document.getElementById("MyScriptsManageButton");
        var root = document.getElementById("MyScriptsMainPanel");
        if (buttonNode) {
            buttonNode.classList.toggle("active", plugin.state.manageMode);
            buttonNode.setAttribute("aria-pressed", plugin.state.manageMode ? "true" : "false");
            buttonNode.title = plugin.state.manageMode ? "Close edit mode" : "Edit scripts";
            buttonNode.setAttribute("aria-label", buttonNode.title);
        }
        if (root) root.classList.toggle("myscripts-manage-mode", plugin.state.manageMode);
        plugin.renderTree();
    }

    function setLinkPickMode(enabled) {
        plugin.state.linkPickMode = enabled === true;
        var buttonNode = document.getElementById("MyScriptsLinkButton");
        var root = document.getElementById("MyScriptsMainPanel");
        if (buttonNode) {
            buttonNode.classList.toggle("active", plugin.state.linkPickMode);
            buttonNode.setAttribute("aria-pressed", plugin.state.linkPickMode ? "true" : "false");
            buttonNode.title = plugin.state.linkPickMode ? "Close link mode" : "Show link buttons beside scripts";
            buttonNode.setAttribute("aria-label", buttonNode.title);
        }
        if (root) root.classList.toggle("myscripts-link-pick-mode", plugin.state.linkPickMode);
        plugin.renderTree();
    }

    function replaceManageButton() {
        var toolbar = findToolbar();
        if (!toolbar || !(plugin.state.access && plugin.state.access.siteAdmin)) return;
        var current = document.getElementById("MyScriptsManageButton");
        if (!current) {
            Array.prototype.some.call(toolbar.querySelectorAll("button.myscripts-toolbar-button"), function (candidate) {
                var title = String(candidate.title || "");
                if (title.indexOf("Script, credentials") >= 0 || String(candidate.textContent || "").trim() === "Manage") {
                    current = candidate;
                    return true;
                }
                return false;
            });
        }
        var replacement = button("⚙", function () { setManageMode(!plugin.state.manageMode); }, "Edit scripts");
        replacement.id = "MyScriptsManageButton";
        replacement.classList.add("myscripts-manage-button");
        replacement.setAttribute("aria-pressed", plugin.state.manageMode ? "true" : "false");
        if (current && current.parentNode) current.parentNode.replaceChild(replacement, current);
        else toolbar.insertBefore(replacement, findSearchToggle(toolbar) || toolbar.querySelector(".myscripts-search") || null);
        var oldBar = document.getElementById("MyScriptsManageBar");
        if (oldBar) oldBar.remove();
    }

    function replaceLinkButton() {
        var toolbar = findToolbar();
        if (!toolbar) return;
        var current = document.getElementById("MyScriptsLinkButton");
        if (!current) {
            Array.prototype.some.call(toolbar.querySelectorAll("button.myscripts-toolbar-button"), function (candidate) {
                if (String(candidate.title || "").toLowerCase().indexOf("bookmarkable") >= 0 || String(candidate.textContent || "").trim() === "🔗") {
                    current = candidate;
                    return true;
                }
                return false;
            });
        }
        var replacement = button("🔗", function () { setLinkPickMode(!plugin.state.linkPickMode); }, "Show link buttons beside scripts");
        replacement.id = "MyScriptsLinkButton";
        replacement.setAttribute("aria-pressed", plugin.state.linkPickMode ? "true" : "false");
        if (current && current.parentNode) current.parentNode.replaceChild(replacement, current);
        else toolbar.insertBefore(replacement, document.getElementById("MyScriptsManageButton") || findSearchToggle(toolbar) || null);
    }

    function buildScriptLink(script, variables) {
        var url = new URL(window.location.href);
        var viewMode = Number(plugin.state.config && plugin.state.config.viewMode) || 101;
        url.searchParams.set("viewmode", String(viewMode));
        url.searchParams.set("script", String(script.path || ""));
        if (variables && Object.keys(variables).length) {
            try { url.searchParams.set("vars", btoa(unescape(encodeURIComponent(JSON.stringify(variables))))); }
            catch (error) { url.searchParams.delete("vars"); }
        } else {
            url.searchParams.delete("vars");
        }
        return url.href;
    }

    function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var field = document.createElement("textarea");
            field.value = text;
            field.setAttribute("readonly", "readonly");
            field.style.position = "fixed";
            field.style.left = "-10000px";
            field.style.top = "0";
            document.body.appendChild(field);
            field.focus();
            field.select();
            try {
                if (!document.execCommand("copy")) throw new Error("Copy command failed.");
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                field.remove();
            }
        });
    }

    function copyScriptLink(script) {
        var url = buildScriptLink(script, {});
        try { window.history.replaceState(window.history.state, document.title, url); } catch (error) { }
        copyText(url).then(function () {
            plugin.setStatus("Link copied. You can also save the current page as a browser bookmark.", "myscripts-status-ok");
        }).catch(function () {
            window.prompt("Copy the script link:", url);
        });
    }

    function selectedRootNode() {
        var children = plugin.state.tree && plugin.state.tree.children || [];
        for (var index = 0; index < children.length; index++) {
            if (children[index] && children[index].type === "directory" && children[index].path === plugin.state.selectedRoot) return children[index];
        }
        return null;
    }

    function normalizedName(value) {
        return String(value || "").trim().toLowerCase();
    }

    function flattenScripts(node, target) {
        target = target || [];
        if (!node) return target;
        if (node.type === "script") target.push(node);
        (node.children || []).forEach(function (child) { flattenScripts(child, target); });
        return target;
    }

    function scheduleText(item) {
        var schedule = item && item.schedule || {};
        var type = String(schedule.type || "DAILY").toUpperCase();
        if (type === "HOURLY") return "Every " + (Number(schedule.interval) || 1) + " hour(s)";
        if (type === "WEEKLY") return "Weekly " + (schedule.days || "MON") + " at " + (schedule.time || "03:00");
        if (type === "ONCE") return "Once " + (schedule.date || "") + " at " + (schedule.time || "03:00");
        return "Daily at " + (schedule.time || "03:00");
    }

    function prepareWorkspace() {
        var layout = document.querySelector("#MyScriptsContent .myscripts-directory-layout");
        var directory = document.querySelector("#MyScriptsContent .myscripts-directory");
        var output = document.querySelector("#MyScriptsContent .myscripts-output-panel");
        if (!layout || !directory) return null;
        layout.classList.add("myscripts-special-layout");
        directory.classList.add("myscripts-special-workspace");
        directory.innerHTML = "";
        if (output) output.hidden = true;
        return directory;
    }

    function openAutomationEditor(item) {
        item = item || null;
        var scripts = flattenScripts(plugin.state.tree, []).sort(function (a, b) {
            return String(a.path || "").localeCompare(String(b.path || ""), "pl", { sensitivity: "base" });
        });
        var html = '<div id="MyScriptsAutomationEditor" class="myscripts-editor-grid">' +
            '<label for="MyScriptsAutomationName">Name</label><input id="MyScriptsAutomationName" class="form-control" type="text">' +
            '<label for="MyScriptsAutomationScript">Script</label><select id="MyScriptsAutomationScript" class="form-select"></select>' +
            '<label for="MyScriptsAutomationType">Schedule</label><select id="MyScriptsAutomationType" class="form-select"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="HOURLY">Hourly</option><option value="ONCE">Once</option></select>' +
            '<label for="MyScriptsAutomationTime">Time</label><input id="MyScriptsAutomationTime" class="form-control" type="time" value="03:00">' +
            '<label for="MyScriptsAutomationDate">Date for once</label><input id="MyScriptsAutomationDate" class="form-control" type="date">' +
            '<label for="MyScriptsAutomationDays">Weekly days</label><input id="MyScriptsAutomationDays" class="form-control" type="text" value="MON" placeholder="MON,TUE,WED">' +
            '<label for="MyScriptsAutomationInterval">Hourly interval</label><input id="MyScriptsAutomationInterval" class="form-control" type="number" min="1" max="23" value="1">' +
            '<label class="myscripts-inline-check"><input id="MyScriptsAutomationEnabled" type="checkbox" checked> Enabled</label>' +
            '<div id="MyScriptsAutomationEditorStatus" class="myscripts-status"></div></div>';

        var submit = function () {
            var status = document.getElementById("MyScriptsAutomationEditorStatus");
            var selectedPath = document.getElementById("MyScriptsAutomationScript").value;
            if (!selectedPath) {
                status.textContent = "Select a script.";
                status.className = "myscripts-status myscripts-status-error";
                return false;
            }
            var payload = {
                id: item && item.id || undefined,
                name: document.getElementById("MyScriptsAutomationName").value,
                scriptPath: selectedPath,
                variables: item && item.variables || {},
                enabled: document.getElementById("MyScriptsAutomationEnabled").checked,
                schedule: {
                    type: document.getElementById("MyScriptsAutomationType").value,
                    time: document.getElementById("MyScriptsAutomationTime").value || "03:00",
                    date: document.getElementById("MyScriptsAutomationDate").value.replace(/-/g, "/"),
                    days: document.getElementById("MyScriptsAutomationDays").value || "MON",
                    interval: Number(document.getElementById("MyScriptsAutomationInterval").value) || 1
                }
            };
            status.textContent = item ? "Updating automation..." : "Creating automation...";
            status.className = "myscripts-status";
            post("automations", { automation: JSON.stringify(payload) }).then(function () {
                closeDialog();
                renderAutomationWorkspace();
            }).catch(function (error) {
                status.textContent = error.message || "Could not save automation.";
                status.className = "myscripts-status myscripts-status-error";
            });
            return false;
        };

        showDialog(item ? "Edit local automation" : "Add local automation", html, submit, item ? "Save changes" : "Add automation");
        var select = document.getElementById("MyScriptsAutomationScript");
        scripts.forEach(function (script) {
            var option = document.createElement("option");
            option.value = script.path;
            option.textContent = script.path + (script.requiresApproval ? " (requires approval)" : "");
            select.appendChild(option);
        });
        var schedule = item && item.schedule || {};
        document.getElementById("MyScriptsAutomationName").value = item && item.name || "";
        document.getElementById("MyScriptsAutomationScript").value = item && item.scriptPath || (scripts[0] && scripts[0].path || "");
        document.getElementById("MyScriptsAutomationType").value = String(schedule.type || "DAILY").toUpperCase();
        document.getElementById("MyScriptsAutomationTime").value = schedule.time || "03:00";
        document.getElementById("MyScriptsAutomationDate").value = String(schedule.date || "").replace(/\//g, "-");
        document.getElementById("MyScriptsAutomationDays").value = schedule.days || "MON";
        document.getElementById("MyScriptsAutomationInterval").value = Number(schedule.interval) || 1;
        document.getElementById("MyScriptsAutomationEnabled").checked = !item || item.enabled !== false;
    }

    function renderAutomationWorkspace() {
        var host = prepareWorkspace();
        if (!host) return;
        var header = document.createElement("div");
        header.className = "myscripts-workspace-header";
        var title = document.createElement("div");
        title.innerHTML = "<h3>Automation / Local</h3><p>Windows Task Scheduler tasks running as SYSTEM.</p>";
        header.appendChild(title);
        var actions = document.createElement("div");
        actions.className = "myscripts-workspace-actions";
        actions.appendChild(button("Add new", function () { openAutomationEditor(null); }, "Add local automation", "btn btn-primary btn-sm"));
        actions.appendChild(button("Refresh", renderAutomationWorkspace, "Refresh automations", "btn btn-secondary btn-sm"));
        header.appendChild(actions);
        host.appendChild(header);
        var status = document.createElement("div");
        status.className = "myscripts-status";
        status.textContent = "Loading automations...";
        host.appendChild(status);
        var tableHost = document.createElement("div");
        tableHost.className = "myscripts-management-table-host";
        host.appendChild(tableHost);

        core.apiRequest(plugin.url("automations")).then(function (response) {
            var rows = response.rows || [];
            status.textContent = "";
            if (!rows.length) {
                tableHost.textContent = "No local automations.";
                return;
            }
            var table = document.createElement("table");
            table.className = "style1 myscripts-management-table";
            var head = table.createTHead().insertRow();
            ["Enabled", "Name", "Script", "Schedule", "Updated", "Actions"].forEach(function (label) {
                var th = document.createElement("th");
                th.textContent = label;
                head.appendChild(th);
            });
            var body = table.createTBody();
            rows.forEach(function (item) {
                var row = body.insertRow();
                row.className = item.enabled === false ? "myscripts-automation-disabled" : "myscripts-automation-enabled";
                var enabledCell = row.insertCell();
                var enabled = document.createElement("input");
                enabled.type = "checkbox";
                enabled.checked = item.enabled !== false;
                enabled.title = enabled.checked ? "Disable automation" : "Enable automation";
                enabled.onchange = function () {
                    enabled.disabled = true;
                    post("automation-enable", { id: item.id, enabled: enabled.checked }).then(function () {
                        renderAutomationWorkspace();
                    }).catch(function (error) {
                        enabled.checked = !enabled.checked;
                        enabled.disabled = false;
                        status.textContent = error.message || "Could not change automation state.";
                        status.className = "myscripts-status myscripts-status-error";
                    });
                };
                enabledCell.appendChild(enabled);
                [item.name || item.id, item.scriptPath || "—", scheduleText(item), item.updatedAt ? new Date(item.updatedAt).toLocaleString() : (item.createdAt ? new Date(item.createdAt).toLocaleString() : "—")].forEach(function (value) {
                    var cell = row.insertCell();
                    cell.textContent = String(value);
                });
                var actionsCell = row.insertCell();
                actionsCell.className = "myscripts-row-actions";
                actionsCell.appendChild(button("Edit", function () { openAutomationEditor(item); }, "Edit automation", "btn btn-secondary btn-sm"));
                actionsCell.appendChild(button("Delete", function () {
                    if (!window.confirm("Delete automation '" + (item.name || item.id) + "'?")) return;
                    post("automation-delete", { id: item.id }).then(renderAutomationWorkspace).catch(function (error) {
                        status.textContent = error.message || "Could not delete automation.";
                        status.className = "myscripts-status myscripts-status-error";
                    });
                }, "Delete automation", "btn btn-danger btn-sm"));
            });
            tableHost.appendChild(table);
        }).catch(function (error) {
            status.textContent = error.message || "Could not load automations.";
            status.className = "myscripts-status myscripts-status-error";
        });
    }

    function localDateValue(date) {
        var offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    function openMaintenanceEditor() {
        var html = '<div id="MyScriptsMaintenanceEditor" class="myscripts-editor-grid">' +
            '<label for="MyScriptsMaintenanceName">Name</label><input id="MyScriptsMaintenanceName" class="form-control" type="text" value="SirK Portal maintenance">' +
            '<label for="MyScriptsMaintenanceHosts">Zabbix host IDs</label><input id="MyScriptsMaintenanceHosts" class="form-control" type="text" placeholder="10101,10102">' +
            '<label for="MyScriptsMaintenanceStart">Start</label><input id="MyScriptsMaintenanceStart" class="form-control" type="datetime-local">' +
            '<label for="MyScriptsMaintenanceEnd">End</label><input id="MyScriptsMaintenanceEnd" class="form-control" type="datetime-local">' +
            '<label class="myscripts-inline-check"><input id="MyScriptsMaintenanceCollect" type="checkbox"> Collect data during maintenance</label>' +
            '<div id="MyScriptsMaintenanceEditorStatus" class="myscripts-status"></div></div>';
        var submit = function () {
            var status = document.getElementById("MyScriptsMaintenanceEditorStatus");
            var start = new Date(document.getElementById("MyScriptsMaintenanceStart").value);
            var end = new Date(document.getElementById("MyScriptsMaintenanceEnd").value);
            var payload = {
                name: document.getElementById("MyScriptsMaintenanceName").value,
                hostids: document.getElementById("MyScriptsMaintenanceHosts").value.split(/[\s,;]+/).filter(Boolean),
                activeSince: Math.floor(start.getTime() / 1000),
                activeTill: Math.floor(end.getTime() / 1000),
                maintenanceType: document.getElementById("MyScriptsMaintenanceCollect").checked ? 0 : 1
            };
            status.textContent = "Creating maintenance...";
            post("zabbix-maintenance", { maintenance: JSON.stringify(payload) }).then(function () {
                closeDialog();
                renderMonitoringWorkspace();
            }).catch(function (error) {
                status.textContent = error.message || "Could not create maintenance.";
                status.className = "myscripts-status myscripts-status-error";
            });
            return false;
        };
        showDialog("Add Zabbix maintenance", html, submit, "Create maintenance");
        var now = new Date();
        document.getElementById("MyScriptsMaintenanceStart").value = localDateValue(now);
        document.getElementById("MyScriptsMaintenanceEnd").value = localDateValue(new Date(now.getTime() + 3600000));
    }

    function openSettingsTab() {
        var body = document.querySelector(".myscripts-body");
        var tabs = body && body.querySelectorAll(".myscripts-tabs td");
        if (tabs && tabs[2]) tabs[2].dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }

    function renderMonitoringWorkspace() {
        var host = prepareWorkspace();
        if (!host) return;
        var header = document.createElement("div");
        header.className = "myscripts-workspace-header";
        var title = document.createElement("div");
        title.innerHTML = "<h3>Monitoring / Zabbix maintenance</h3><p>Zabbix API credentials are configured in Settings.</p>";
        header.appendChild(title);
        var actions = document.createElement("div");
        actions.className = "myscripts-workspace-actions";
        actions.appendChild(button("Add maintenance", openMaintenanceEditor, "Add Zabbix maintenance", "btn btn-primary btn-sm"));
        actions.appendChild(button("Settings", openSettingsTab, "Open Zabbix API settings", "btn btn-secondary btn-sm"));
        actions.appendChild(button("Refresh", renderMonitoringWorkspace, "Refresh maintenance list", "btn btn-secondary btn-sm"));
        header.appendChild(actions);
        host.appendChild(header);
        var status = document.createElement("div");
        status.className = "myscripts-status";
        status.textContent = "Loading Zabbix maintenance...";
        host.appendChild(status);
        var tableHost = document.createElement("div");
        tableHost.className = "myscripts-management-table-host";
        host.appendChild(tableHost);

        core.apiRequest(plugin.url("zabbix-maintenance")).then(function (response) {
            var rows = response.rows || [];
            status.textContent = "";
            if (!rows.length) {
                tableHost.textContent = "No Zabbix maintenance entries.";
                return;
            }
            var table = document.createElement("table");
            table.className = "style1 myscripts-management-table";
            var head = table.createTHead().insertRow();
            ["Name", "Hosts", "Start", "End", "Mode", "Actions"].forEach(function (label) {
                var th = document.createElement("th");
                th.textContent = label;
                head.appendChild(th);
            });
            var body = table.createTBody();
            rows.forEach(function (item) {
                var row = body.insertRow();
                var hosts = (item.hosts || []).map(function (entry) { return entry.name || entry.host || entry.hostid; }).join(", ") || "—";
                [item.name || "—", hosts, new Date(Number(item.active_since) * 1000).toLocaleString(), new Date(Number(item.active_till) * 1000).toLocaleString(), Number(item.maintenance_type) === 1 ? "No data collection" : "Collect data"].forEach(function (value) {
                    var cell = row.insertCell();
                    cell.textContent = String(value);
                });
                var actionsCell = row.insertCell();
                actionsCell.className = "myscripts-row-actions";
                actionsCell.appendChild(button("Delete", function () {
                    if (!window.confirm("Delete Zabbix maintenance '" + (item.name || item.maintenanceid) + "'?")) return;
                    post("zabbix-maintenance-delete", { ids: JSON.stringify([item.maintenanceid]) }).then(renderMonitoringWorkspace).catch(function (error) {
                        status.textContent = error.message || "Could not delete maintenance.";
                        status.className = "myscripts-status myscripts-status-error";
                    });
                }, "Delete maintenance", "btn btn-danger btn-sm"));
            });
            tableHost.appendChild(table);
        }).catch(function (error) {
            status.textContent = (error.message || "Could not load Zabbix maintenance.") + " Configure Zabbix API in Settings.";
            status.className = "myscripts-status myscripts-status-error";
        });
    }

    function renderSpecialWorkspace() {
        if (!(plugin.state.access && plugin.state.access.siteAdmin)) return;
        var root = selectedRootNode();
        if (!root) return;
        var name = normalizedName(root.name);
        if (name === "automation") renderAutomationWorkspace();
        else if (name === "monitoring") renderMonitoringWorkspace();
    }

    function addZabbixSettings(panel) {
        if (!panel || document.getElementById("MyScriptsZabbixSettingsSection")) return;
        var content = document.createElement("div");
        content.id = "MyScriptsZabbixSettingsSection";
        var note = document.createElement("p");
        note.textContent = "Configure the Zabbix API connection used by the Monitoring folder and maintenance actions.";
        content.appendChild(note);
        var urlLabel = document.createElement("label");
        urlLabel.textContent = "Zabbix URL";
        content.appendChild(urlLabel);
        var url = document.createElement("input");
        url.id = "MyScriptsZabbixUrl";
        url.type = "url";
        url.className = "form-control";
        content.appendChild(url);
        var tokenLabel = document.createElement("label");
        tokenLabel.textContent = "API token (leave blank to keep current)";
        content.appendChild(tokenLabel);
        var token = document.createElement("input");
        token.id = "MyScriptsZabbixToken";
        token.type = "password";
        token.className = "form-control";
        content.appendChild(token);
        var verifyLabel = document.createElement("label");
        verifyLabel.className = "myscripts-inline-check";
        var verify = document.createElement("input");
        verify.id = "MyScriptsZabbixVerifyTls";
        verify.type = "checkbox";
        verify.checked = true;
        verifyLabel.appendChild(verify);
        verifyLabel.appendChild(document.createTextNode(" Verify TLS certificate"));
        content.appendChild(verifyLabel);
        var actions = document.createElement("div");
        actions.className = "myscripts-settings-actions";
        actions.appendChild(button("Save Zabbix settings", function () {
            var status = document.getElementById("MyScriptsZabbixSettingsStatus");
            status.textContent = "Saving...";
            post("zabbix-settings", { settings: JSON.stringify({ url: url.value, token: token.value, verifyTls: verify.checked }) }).then(function () {
                token.value = "";
                status.textContent = "Zabbix settings saved.";
                status.className = "myscripts-status myscripts-status-ok";
                loadZabbixSettings();
            }).catch(function (error) {
                status.textContent = error.message || "Could not save Zabbix settings.";
                status.className = "myscripts-status myscripts-status-error";
            });
        }, "Save Zabbix API settings", "btn btn-primary btn-sm"));
        actions.appendChild(button("Test connection", function () {
            var status = document.getElementById("MyScriptsZabbixSettingsStatus");
            status.textContent = "Testing connection...";
            core.apiRequest(plugin.url("zabbix-test")).then(function (response) {
                status.textContent = "Connected to Zabbix " + (response.result && response.result.version || "");
                status.className = "myscripts-status myscripts-status-ok";
            }).catch(function (error) {
                status.textContent = error.message || "Zabbix connection failed.";
                status.className = "myscripts-status myscripts-status-error";
            });
        }, "Test Zabbix API connection", "btn btn-secondary btn-sm"));
        content.appendChild(actions);
        var status = document.createElement("div");
        status.id = "MyScriptsZabbixSettingsStatus";
        status.className = "myscripts-status";
        content.appendChild(status);
        var section = plugin.createSettingsSection("Zabbix API", content);
        section.setAttribute("data-myscripts-zabbix-section", "1");
        panel.appendChild(section);
    }

    function loadZabbixSettings() {
        var url = document.getElementById("MyScriptsZabbixUrl");
        var token = document.getElementById("MyScriptsZabbixToken");
        var verify = document.getElementById("MyScriptsZabbixVerifyTls");
        var status = document.getElementById("MyScriptsZabbixSettingsStatus");
        if (!url || !token || !verify) return;
        core.apiRequest(plugin.url("zabbix-settings")).then(function (response) {
            var settings = response.settings || {};
            url.value = settings.url || "";
            verify.checked = settings.verifyTls !== false;
            token.placeholder = settings.tokenConfigured ? "Configured — leave blank to keep current token" : "Required";
            if (status) {
                status.textContent = settings.tokenConfigured ? "Zabbix API token is configured." : "Zabbix API token is not configured.";
                status.className = "myscripts-status " + (settings.tokenConfigured ? "myscripts-status-ok" : "myscripts-status-error");
            }
        }).catch(function (error) {
            if (status) {
                status.textContent = error.message || "Could not load Zabbix settings.";
                status.className = "myscripts-status myscripts-status-error";
            }
        });
    }

    function colorResultRows() {
        var table = document.querySelector("#MyScriptsResultsPanel .myscripts-results-table");
        if (!table || !table.tHead || !table.tBodies.length) return;
        var headers = Array.prototype.map.call(table.tHead.rows[0].cells, function (cell) { return normalizedName(cell.textContent); });
        var statusIndex = headers.indexOf("status");
        if (statusIndex < 0) return;
        Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
            var statusCell = row.cells[statusIndex];
            if (!statusCell) return;
            var status = normalizedName(statusCell.textContent).replace(/[^a-z0-9_-]+/g, "-");
            Array.prototype.slice.call(row.classList).forEach(function (name) {
                if (name.indexOf("myscripts-result-row-") === 0) row.classList.remove(name);
            });
            Array.prototype.slice.call(statusCell.classList).forEach(function (name) {
                if (name.indexOf("myscripts-result-status-") === 0) statusCell.classList.remove(name);
            });
            row.classList.add("myscripts-result-row-" + status);
            statusCell.classList.add("myscripts-result-status", "myscripts-result-status-" + status);
        });
    }

    function scheduleResultColors() {
        [0, 100, 300, 800].forEach(function (delay) { window.setTimeout(colorResultRows, delay); });
        var panel = document.getElementById("MyScriptsResultsPanel");
        if (panel && !panel._myscriptsColorObserver) {
            panel._myscriptsColorObserver = new MutationObserver(colorResultRows);
            panel._myscriptsColorObserver.observe(panel, { childList: true, subtree: true });
        }
    }

    plugin.buildSettings = function (panel) {
        originalBuildSettings.call(plugin, panel);
        if (plugin.state.access && plugin.state.access.siteAdmin) addZabbixSettings(panel);
    };

    plugin.loadSettings = function () {
        var result = originalLoadSettings.call(plugin);
        loadZabbixSettings();
        return result;
    };

    plugin.loadResults = function () {
        var result = originalLoadResults.call(plugin);
        scheduleResultColors();
        return result;
    };

    plugin.buildContent = function (body) {
        originalBuildContent.call(plugin, body);
        replaceManageButton();
        replaceLinkButton();
        syncToolbar();
        plugin.updateTreeToolbar();
    };

    plugin.renderDirectory = function (host, directory, root) {
        originalRenderDirectory.call(plugin, host, directory, root);
        var rows = host.querySelectorAll(":scope > .myscripts-script[data-script-path]");
        Array.prototype.forEach.call(rows, function (row) {
            var path = String(row.getAttribute("data-script-path") || "");
            if (!path) return;
            var action = row.querySelector(".myscripts-script-action") || row;
            if (plugin.state.linkPickMode && !row.querySelector(".myscripts-inline-link-button")) {
                var link = button("🔗", function (event) {
                    event.stopPropagation();
                    var script = plugin.findScript(plugin.state.tree, path);
                    if (script) copyScriptLink(script);
                }, "Copy bookmarkable link for this script", "myscripts-inline-link-button");
                action.appendChild(link);
            }
            if (plugin.state.access && plugin.state.access.siteAdmin && plugin.state.manageMode && !row.querySelector(".myscripts-inline-edit-button")) {
                var edit = button("✎", function (event) {
                    event.stopPropagation();
                    plugin.state.selectedPath = path;
                    plugin.openDefinitionEditor();
                }, "Edit script definition", "myscripts-inline-edit-button");
                action.appendChild(edit);
            }
        });
    };

    plugin.renderTree = function () {
        originalRenderTree.call(plugin);
        var root = document.getElementById("MyScriptsMainPanel");
        if (root) {
            root.classList.toggle("myscripts-manage-mode", plugin.state.manageMode);
            root.classList.toggle("myscripts-link-pick-mode", plugin.state.linkPickMode);
        }
        var oldBar = document.getElementById("MyScriptsManageBar");
        if (oldBar) oldBar.remove();
        var manage = document.getElementById("MyScriptsManageButton");
        if (manage) {
            manage.classList.toggle("active", plugin.state.manageMode);
            manage.setAttribute("aria-pressed", plugin.state.manageMode ? "true" : "false");
        }
        var link = document.getElementById("MyScriptsLinkButton");
        if (link) {
            link.classList.toggle("active", plugin.state.linkPickMode);
            link.setAttribute("aria-pressed", plugin.state.linkPickMode ? "true" : "false");
        }
        renderSpecialWorkspace();
        syncToolbar();
    };
}());
