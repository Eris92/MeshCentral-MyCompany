(function () {
    "use strict";

    window.ApprovalCenter = window.ApprovalCenter || {};
    var plugin = window.ApprovalCenter;
    var core = window.MeshPluginCore;
    plugin.state = plugin.state || {
        active: false,
        opening: false,
        config: null,
        access: null,
        providers: [],
        activeTab: "overview",
        nativeState: null,
        initializePromise: null,
        views: {}
    };

    plugin.visibleProviders = function (providers, access) {
        providers = Array.isArray(providers) ? providers : [];
        var allowed = access && !access.siteAdmin ? (Array.isArray(access.providerTypes) ? access.providerTypes : []) : null;
        return providers.filter(function (provider) { return provider.enabled !== false && (!allowed || allowed.indexOf(provider.type) >= 0); });
    };

    plugin.rebuildContent = function () {
        var body = document.getElementById("ApprovalCenterBody");
        if (!body) return;
        var visible = body.style.display !== "none";
        body.innerHTML = "";
        body.removeAttribute("data-approvalcenter-built");
        plugin.buildContent(body);
        if (!visible) body.style.display = "none";
    };

    plugin.refreshProviders = function () {
        return core.apiRequest(plugin.url("bootstrap")).then(function (result) {
            var access = result.access || { allowed: false, siteAdmin: false, providerTypes: [] };
            var providers = plugin.visibleProviders(result.providers, access);
            var changed = JSON.stringify(plugin.state.providers || []) !== JSON.stringify(providers);
            plugin.state.access = access;
            plugin.state.config = result.config || plugin.state.config;
            if (!access.allowed) {
                if (plugin.state.active) plugin.close(true);
                plugin.removeMenus();
                return false;
            }
            plugin.state.providers = providers;
            plugin.ensureMenus();
            plugin.syncMenu();
            if (changed) plugin.rebuildContent();
            return changed;
        });
    };

    plugin.url = function (asset, parameters) {
        var url = new URL(window.MyCompanyAssetUrl("approvals", asset));
        Object.keys(parameters || {}).forEach(function (key) {
            if (parameters[key] != null && String(parameters[key]) !== "") url.searchParams.set(key, parameters[key]);
        });
        return url.href;
    };

    plugin.initialize = function () {
        if (plugin.state.initializePromise) return plugin.state.initializePromise;
        plugin.state.initializePromise = core.apiRequest(plugin.url("bootstrap")).then(function (result) {
            plugin.state.access = result.access || { allowed: false, siteAdmin: false, providerTypes: [] };
            plugin.state.config = result.config;
            plugin.state.providers = plugin.visibleProviders(result.providers, plugin.state.access);
            if (!plugin.state.access.allowed) {
                plugin.removeMenus();
                if (plugin.isRequestedInUrl() && typeof window.go === "function") window.go(1);
                return;
            }
            plugin.ensureMenus();
            if (plugin.isRequestedInUrl()) plugin.open();
        }).catch(function (error) {
            plugin.state.access = { allowed: false, siteAdmin: false, providerTypes: [] };
            plugin.removeMenus();
            if (window.console) window.console.error("Approval Center initialization error", error);
        });
        return plugin.state.initializePromise;
    };

    plugin.removeMenus = function () {
        ["MainMenuApprovalCenter", "LeftMenuApprovalCenter"].forEach(function (id) {
            var element = document.getElementById(id);
            if (element && element.parentNode) element.parentNode.removeChild(element);
        });
    };

    plugin.ensureMenus = function () {
        if (!plugin.state.config || !plugin.state.access || !plugin.state.access.allowed) return false;
        var mainAnchor = document.getElementById("MainMenuMyDevices");
        var leftAnchor = document.getElementById("LeftMenuMyDevices");
        var open = function (event) { return plugin.open(event); };
        if (mainAnchor && mainAnchor.parentNode) {
            var main = document.getElementById("MainMenuApprovalCenter") || mainAnchor.cloneNode(false);
            var modernMain = String(main.tagName || "").toLowerCase() === "a" || main.classList.contains("nav-link");
            main.id = "MainMenuApprovalCenter";
            main.textContent = plugin.state.config.name;
            main.title = plugin.state.config.name;
            main.tabIndex = 0;
            main.setAttribute("data-meshcentral-plugin-pin", "approvalcenter");
            main.setAttribute("data-meshcentral-plugin-click", "Main menu");
            main.classList.remove("fullselect", "semiselect", "active");
            main.onclick = main.onmouseup = main.onkeypress = null;
            if (modernMain) { main.href = "#"; main.onclick = open; }
            else main.onmouseup = open;
            main.onkeypress = function (event) { if (event && event.key === "Enter") return open(event); };
            core.placeMenuItem(main, mainAnchor, plugin.state.config.viewMode);
        }
        if (leftAnchor && leftAnchor.parentNode) {
            var left = document.getElementById("LeftMenuApprovalCenter") || leftAnchor.cloneNode(true);
            var modernLeft = String(left.tagName || "").toLowerCase() === "a" || left.classList.contains("nav-link");
            left.id = "LeftMenuApprovalCenter";
            left.title = plugin.state.config.name;
            left.setAttribute("aria-label", plugin.state.config.name);
            left.setAttribute("data-meshcentral-plugin-pin", "approvalcenter");
            left.setAttribute("data-meshcentral-plugin-click", "Left menu");
            left.tabIndex = 0;
            left.classList.remove("lbbuttonsel", "lbbuttonsel2", "active");
            left.onclick = left.onmouseup = left.onkeypress = null;
            if (modernLeft) { left.href = "#"; left.onclick = open; }
            else left.onmouseup = open;
            left.onkeypress = function (event) { if (event && event.key === "Enter") return open(event); };
            var icon = left.querySelector(".lbtg");
            if (icon) {
                icon.className = "lbtg";
                icon.style.backgroundImage = "url(\"" + plugin.url(plugin.state.config.leftMenuAsset) + "\")";
                icon.style.backgroundPosition = "center";
                icon.style.backgroundRepeat = "no-repeat";
                icon.style.backgroundSize = "contain";
            } else if (modernLeft) {
                var nativeIcon = left.querySelector("svg, i, img");
                var image = document.createElement("img");
                image.className = "approvalcenter-menu-icon";
                image.alt = "";
                image.src = plugin.url(plugin.state.config.leftMenuAsset);
                if (nativeIcon && nativeIcon.parentNode) nativeIcon.parentNode.replaceChild(image, nativeIcon);
                else left.insertBefore(image, left.firstChild);
            }
            core.placeMenuItem(left, leftAnchor, plugin.state.config.viewMode);
        }
        return true;
    };

    plugin.formatDate = function (value) {
        if (!value) return "";
        try { return new Date(Number(value)).toLocaleString(); } catch (error) { return ""; }
    };

    plugin.statusLabel = function (status) {
        return {
            pending: "Pending", approved: "Approved", executing: "Executing", completed: "Completed",
            rejected: "Rejected", failed: "Failed", replaced: "Replaced"
        }[status] || status || "";
    };

    plugin.createTab = function (row, key, title) {
        var cell = row.insertCell();
        cell.textContent = title;
        cell.tabIndex = 0;
        cell.setAttribute("data-approvalcenter-tab", key);
        cell.setAttribute("data-meshcentral-plugin-pin", "approvalcenter");
        cell.setAttribute("data-meshcentral-plugin-click", "Tab " + title);
        var activate = function () { plugin.activateTab(key); return false; };
        cell.onmouseup = activate;
        cell.onkeypress = function (event) { if (event && event.key === "Enter") return activate(); };
        return cell;
    };

    plugin.createPanel = function (body, key) {
        var panel = document.createElement("div");
        panel.className = "approvalcenter-panel";
        panel.setAttribute("data-approvalcenter-panel", key);
        panel.hidden = true;
        body.appendChild(panel);
        return panel;
    };

    plugin.updateContentScroll = function () {
        var content = document.getElementById("ApprovalCenterContent");
        if (!content) return;
        content.style.overflowY = "hidden";
        var active = content.querySelector('[data-approvalcenter-panel]:not([hidden])');
        content.style.overflowY = active && active.scrollHeight > content.clientHeight ? "auto" : "hidden";
    };

    plugin.buildContent = function (body) {
        if (body.getAttribute("data-approvalcenter-built") === "1") return;
        body.setAttribute("data-approvalcenter-built", "1");
        body.setAttribute("data-meshcentral-plugin-pin", "approvalcenter");
        body.setAttribute("data-meshcentral-plugin-click", "Plugin UI");
        body.className = "approvalcenter-body";
        var tabs = document.createElement("table");
        tabs.className = "style1 approvalcenter-tabs";
        tabs.id = "ApprovalCenterTabs";
        var row = tabs.insertRow();
        body.appendChild(tabs);
        plugin.createTab(row, "overview", "Overview");
        plugin.state.providers.forEach(function (provider) { plugin.createTab(row, provider.type, provider.tabTitle); });
        if (plugin.state.access.siteAdmin) plugin.createTab(row, "settings", "Settings");

        var content = document.createElement("div");
        content.id = "ApprovalCenterContent";
        content.className = "approvalcenter-content";
        body.appendChild(content);

        var overview = plugin.createPanel(content, "overview");
        var overviewStatus = document.createElement("span");
        overviewStatus.id = "ApprovalCenterOverviewStatus";
        overviewStatus.className = "approvalcenter-status";
        overview.appendChild(overviewStatus);
        var overviewCards = document.createElement("div");
        overviewCards.id = "ApprovalCenterOverviewCards";
        overviewCards.className = "approvalcenter-overview";
        overview.appendChild(overviewCards);

        plugin.state.providers.forEach(function (provider) { plugin.buildProviderPanel(plugin.createPanel(content, provider.type), provider); });
        if (plugin.state.access.siteAdmin) plugin.buildSettingsPanel(plugin.createPanel(content, "settings"));
        plugin.activateTab(plugin.state.activeTab || "overview");
    };

    plugin.activateTab = function (key) {
        var available = document.querySelector('[data-approvalcenter-panel="' + key + '"]');
        if (!available) key = "overview";
        plugin.state.activeTab = key;
        Array.prototype.forEach.call(document.querySelectorAll("#ApprovalCenterTabs [data-approvalcenter-tab]"), function (tab) {
            tab.className = tab.getAttribute("data-approvalcenter-tab") === key ? "topbar_td style3sel" : "topbar_td style3x";
        });
        Array.prototype.forEach.call(document.querySelectorAll("#ApprovalCenterBody [data-approvalcenter-panel]"), function (panel) {
            panel.hidden = panel.getAttribute("data-approvalcenter-panel") !== key;
        });
        plugin.updateContentScroll();
        if (key === "overview") plugin.loadOverview();
        else if (key === "settings") plugin.loadSettings();
        else plugin.loadProvider(key);
    };

    plugin.loadOverview = function () {
        var status = document.getElementById("ApprovalCenterOverviewStatus");
        if (status) status.textContent = "Loading...";
        core.apiRequest(plugin.url("overview")).then(function (result) {
            var target = document.getElementById("ApprovalCenterOverviewCards");
            if (!target) return;
            target.innerHTML = "";
            (result.cards || []).forEach(function (card) {
                var container = document.createElement("section");
                container.className = "approvalcenter-card";
                var heading = document.createElement("h3"); heading.textContent = card.provider.title; container.appendChild(heading);
                if (card.provider.description) { var description = document.createElement("p"); description.textContent = card.provider.description; container.appendChild(description); }
                var counts = document.createElement("div"); counts.className = "approvalcenter-card-counts";
                ["pending", "executing", "completed", "failed"].forEach(function (name) { var badge = document.createElement("span"); badge.className = "approvalcenter-badge"; badge.textContent = plugin.statusLabel(name) + ": " + Number(card.counts && card.counts[name] || 0); counts.appendChild(badge); });
                container.appendChild(counts);
                var pending = Array.isArray(card.pending) ? card.pending : [];
                if (pending.length) {
                    var pendingHeading = document.createElement("h4"); pendingHeading.textContent = "Pending requests"; container.appendChild(pendingHeading);
                    var pendingList = document.createElement("div"); pendingList.className = "approvalcenter-pending";
                    pending.forEach(function (request) {
                        var item = document.createElement("article"); item.className = "approvalcenter-request-tile";
                        var title = document.createElement("strong"); title.className = "approvalcenter-request-title"; title.textContent = request.summary || card.provider.title; item.appendChild(title);
                        plugin.appendOverviewDetails(item, request, card.provider);
                        plugin.appendDecisionActions(item, request, card.provider);
                        pendingList.appendChild(item);
                    });
                    container.appendChild(pendingList);
                }
                if (!pending.length) { var empty = document.createElement("p"); empty.textContent = "No pending requests."; container.appendChild(empty); }
                container.tabIndex = 0;
                container.setAttribute("data-meshcentral-plugin-pin", "approvalcenter");
                container.setAttribute("data-meshcentral-plugin-click", "Overview " + card.provider.title);
                container.ondblclick = function () { plugin.activateTab(card.provider.type); };
                target.appendChild(container);
            });
            if (status) status.textContent = result.cards && result.cards.length ? "" : "No approval providers are available.";
            plugin.updateContentScroll();
        }).catch(function (error) { if (status) { status.textContent = error.message || "Could not load overview."; status.className = "approvalcenter-status approvalcenter-status-error"; } });
    };

    plugin.overviewValue = function (value) {
        if (value === null || value === undefined || value === "") return "—";
        if (typeof value === "object") { try { return JSON.stringify(value); } catch (error) { return "[object]"; } }
        return String(value);
    };

    plugin.appendOverviewDetails = function (host, request, provider) {
        var details = document.createElement("div"); details.className = "approvalcenter-request-details";
        var fields = request.fields || {};
        var rows = [{ label: "DateTime", value: plugin.formatDate(request.createdAt) }, { label: "Requester", value: request.requester && request.requester.name || request.requester && request.requester.id || "—" }];
        rows.push({ label: "Approval progress", value: request.approvalProgress || "0/" + String((request.requiredApprovalLevels || [1]).length) });
        if (request.status === "pending") {
            var requiredLevels = request.requiredApprovalLevels || [1];
            rows.push({ label: "Approval level", value: "Level " + String(request.approvalLevel || requiredLevels[0] || 1) + " (required: " + requiredLevels.join(", ") + ")" });
        }
        (provider.columns || []).forEach(function (column) { if (column && column.key && Object.prototype.hasOwnProperty.call(fields, column.key)) rows.push({ label: column.label || column.key, value: fields[column.key] }); });
        Object.keys(fields).forEach(function (key) { if (!(provider.columns || []).some(function (column) { return column && column.key === key; })) rows.push({ label: key, value: fields[key] }); });
        if (request.requesterNote) rows.push({ label: "Requester Note", value: request.requesterNote });
        (request.approvalDecisions || []).forEach(function (entry) {
            var value = (entry.approver && (entry.approver.name || entry.approver.id) || "—") + " — " + (entry.decision === "approve" ? "Approved" : "Rejected");
            if (entry.note) value += " — " + entry.note;
            rows.push({ label: "Approval L" + String(entry.level || 1), value: value });
        });
        rows.forEach(function (row) { var line = document.createElement("div"); line.className = "approvalcenter-request-detail"; var label = document.createElement("span"); label.className = "approvalcenter-request-detail-label"; label.textContent = row.label + ":"; var value = document.createElement("span"); value.className = "approvalcenter-request-detail-value"; value.textContent = plugin.overviewValue(row.value); line.appendChild(label); line.appendChild(value); details.appendChild(line); });
        host.appendChild(details);
    };

    plugin.appendDecisionActions = function (host, request, provider) {
        if (!host || !request || request.status !== "pending" || request.canDecide === false) return;
        var actions = document.createElement("span"); actions.className = "approvalcenter-actions approvalcenter-overview-actions";
        var approve = document.createElement("input"); approve.type = "button"; approve.value = "Approve"; approve.className = "approvalcenter-approve btn btn-success btn-sm"; approve.setAttribute("data-meshcentral-plugin-pin", "approvalcenter"); approve.setAttribute("data-meshcentral-plugin-click", "Approve " + provider.title); approve.onclick = function () { plugin.openDecision(request.id, "approve", provider); }; actions.appendChild(approve);
        var reject = document.createElement("input"); reject.type = "button"; reject.value = "Reject"; reject.className = "approvalcenter-reject btn btn-danger btn-sm"; reject.setAttribute("data-meshcentral-plugin-pin", "approvalcenter"); reject.setAttribute("data-meshcentral-plugin-click", "Reject " + provider.title); reject.onclick = function () { plugin.openDecision(request.id, "reject", provider); }; actions.appendChild(reject);
        host.appendChild(actions);
    };

    plugin.buildProviderPanel = function (panel, provider) {
        plugin.state.views[provider.type] = plugin.state.views[provider.type] || { page: 1, perPage: 20, status: "pending", filter: "" };
        var toolbar = document.createElement("div"); toolbar.className = "approvalcenter-toolbar";
        var filter = document.createElement("input"); filter.type = "search"; filter.placeholder = "Filter"; filter.id = "ApprovalCenterFilter-" + provider.type; toolbar.appendChild(filter);
        var status = document.createElement("select"); status.id = "ApprovalCenterStatus-" + provider.type;
        [["", "All statuses"], ["pending", "Pending"], ["approved", "Approved"], ["executing", "Executing"], ["completed", "Completed"], ["rejected", "Rejected"], ["failed", "Failed"], ["replaced", "Replaced"]].forEach(function (pair) { var option = document.createElement("option"); option.value = pair[0]; option.textContent = pair[1]; status.appendChild(option); });
        status.value = "pending"; toolbar.appendChild(status);
        var refresh = document.createElement("input"); refresh.type = "button"; refresh.value = "Refresh"; refresh.setAttribute("data-meshcentral-plugin-pin", "approvalcenter"); refresh.setAttribute("data-meshcentral-plugin-click", "Refresh " + provider.title); toolbar.appendChild(refresh);
        panel.appendChild(toolbar);
        var listStatus = document.createElement("span"); listStatus.id = "ApprovalCenterListStatus-" + provider.type; listStatus.className = "approvalcenter-status"; panel.appendChild(listStatus);
        var tableHost = document.createElement("div"); tableHost.id = "ApprovalCenterTable-" + provider.type; tableHost.className = "approvalcenter-table-host"; panel.appendChild(tableHost);
        var pager = document.createElement("div"); pager.id = "ApprovalCenterPager-" + provider.type; pager.className = "approvalcenter-pager"; panel.appendChild(pager);
        var reload = function (reset) { var view = plugin.state.views[provider.type]; view.filter = filter.value.trim(); view.status = status.value; if (reset) view.page = 1; plugin.loadProvider(provider.type); };
        filter.addEventListener("input", function () { window.clearTimeout(filter._approvalTimer); filter._approvalTimer = window.setTimeout(function () { reload(true); }, 250); });
        status.onchange = function () { reload(true); };
        refresh.onclick = function () { reload(false); };
    };

    plugin.provider = function (type) {
        return plugin.state.providers.filter(function (provider) { return provider.type === type; })[0] || null;
    };

    plugin.loadProvider = function (type) {
        var provider = plugin.provider(type), view = plugin.state.views[type], status = document.getElementById("ApprovalCenterListStatus-" + type);
        if (!provider || !view) return;
        if (status) { status.textContent = "Loading..."; status.className = "approvalcenter-status"; }
        core.apiRequest(plugin.url("requests", { type: type, page: view.page, perPage: view.perPage, status: view.status, filter: view.filter })).then(function (result) {
            view.page = result.page; view.perPage = result.perPage;
            plugin.renderProvider(provider, result);
            if (status) status.textContent = result.total ? "" : "No requests.";
            plugin.updateContentScroll();
        }).catch(function (error) { if (status) { status.textContent = error.message || "Could not load requests."; status.className = "approvalcenter-status approvalcenter-status-error"; } });
    };

    plugin.renderResultTable = function (host) {
        var state = plugin.state.resultTable;
        if (!host || !state) return;
        host.innerHTML = "";
        var tableData = state.table || {}, rows = Array.isArray(tableData.rows) ? tableData.rows : [], columns = Array.isArray(tableData.columns) ? tableData.columns : [];
        if (!columns.length) rows.forEach(function (row) { Object.keys(row || {}).forEach(function (key) { if (columns.indexOf(key) < 0) columns.push(key); }); });
        var toolbar = document.createElement("div"); toolbar.className = "approvalcenter-toolbar";
        var search = document.createElement("input"); search.type = "search"; search.placeholder = "Search table"; search.value = state.query; search.oninput = function () { state.query = search.value; state.page = 1; plugin.renderResultTable(host); }; toolbar.appendChild(search);
        var perLabel = document.createElement("label"); perLabel.textContent = "Per page "; var per = document.createElement("select"); [20, 50, 100].forEach(function (value) { var option = document.createElement("option"); option.value = value; option.textContent = value; per.appendChild(option); }); per.value = state.perPage; per.onchange = function () { state.perPage = Number(per.value); state.page = 1; plugin.renderResultTable(host); }; perLabel.appendChild(per); toolbar.appendChild(perLabel); host.appendChild(toolbar);
        var query = state.query.toLowerCase(), filtered = rows.filter(function (row) { return !query || columns.some(function (column) { return String(row && row[column] == null ? "" : row[column]).toLowerCase().indexOf(query) >= 0; }); });
        var pageCount = Math.max(1, Math.ceil(filtered.length / state.perPage)); if (state.page > pageCount) state.page = pageCount;
        var visible = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
        var table = document.createElement("table"); table.className = ((typeof window.setModalContent === "function") ? "table table-hover table-striped align-middle " : "style1 ") + "approvalcenter-table approvalcenter-result-table";
        var head = table.createTHead().insertRow(); columns.forEach(function (column) { var th = document.createElement("th"); th.textContent = column; head.appendChild(th); });
        var body = table.createTBody(); visible.forEach(function (row) { var tr = body.insertRow(); columns.forEach(function (column) { var td = tr.insertCell(); var value = row && row[column]; td.textContent = value == null ? "" : (typeof value === "object" ? JSON.stringify(value) : String(value)); }); });
        host.appendChild(table);
        var pager = document.createElement("div"); pager.className = "approvalcenter-pager";
        var previous = document.createElement("input"); previous.type = "button"; previous.value = "Previous"; previous.disabled = state.page <= 1; previous.onclick = function () { if (state.page > 1) { state.page--; plugin.renderResultTable(host); } }; pager.appendChild(previous);
        var label = document.createElement("span"); label.textContent = "Page " + state.page + " of " + pageCount + " (" + filtered.length + ")"; pager.appendChild(label);
        var next = document.createElement("input"); next.type = "button"; next.value = "Next"; next.disabled = state.page >= pageCount; next.onclick = function () { if (state.page < pageCount) { state.page++; plugin.renderResultTable(host); } }; pager.appendChild(next); host.appendChild(pager);
    };

    plugin.openResultTable = function (request) {
        var table = request && request.result && request.result.data && request.result.data.table;
        if (!table) return;
        plugin.state.resultTable = { table: table, query: "", page: 1, perPage: 20 };
        var modern = typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal"), html = '<div id="ApprovalCenterResultTable"></div>';
        if (modern) { window.setModalContent("xxAddAgent", request.summary || "Command result", html); window.showModal("xxAddAgentModal", "idx_dlgCancelButton", function () { return true; }); }
        else if (typeof window.setDialogMode === "function") window.setDialogMode(2, request.summary || "Command result", 1, null, html);
        plugin.renderResultTable(document.getElementById("ApprovalCenterResultTable"));
    };

    plugin.renderProvider = function (provider, result) {
        var target = document.getElementById("ApprovalCenterTable-" + provider.type), pager = document.getElementById("ApprovalCenterPager-" + provider.type);
        if (!target || !pager) return;
        target.innerHTML = ""; pager.innerHTML = "";
        if (result.rows && result.rows.length) {
            var table = document.createElement("table");
            table.className = ((typeof window.setModalContent === "function") ? "table table-hover table-striped align-middle " : "style1 ") + "approvalcenter-table";
            var head = table.createTHead().insertRow();
            var columns = [{ key: "__date", label: "DateTime" }].concat(provider.columns || []).concat([
                { key: "__requester", label: "Requester" }, { key: "__approval", label: "Approval" },
                { key: "__approver1", label: "Approver 1" }, { key: "__approver2", label: "Approver 2" }, { key: "__approver3", label: "Approver 3" },
                { key: "__status", label: "Status" }, { key: "__requesterNote", label: "Requester Note" },
                { key: "__approverNote1", label: "Approver Note 1" }, { key: "__approverNote2", label: "Approver Note 2" }, { key: "__approverNote3", label: "Approver Note 3" }, { key: "__actions", label: "Actions" }
            ]);
            columns.forEach(function (column) { var th = document.createElement("th"); th.scope = "col"; th.textContent = column.label; if (column.key === "__actions") th.className = "approvalcenter-actions-column"; head.appendChild(th); });
            var body = table.createTBody();
            result.rows.forEach(function (request) {
                var row = body.insertRow();
                columns.forEach(function (column) {
                    var cell = row.insertCell();
                    if (column.key === "__date") cell.textContent = plugin.formatDate(request.createdAt);
                    else if (column.key === "__requester") cell.textContent = request.requester && request.requester.name || "";
                    else if (column.key === "__approval") cell.textContent = request.approvalProgress || "0/" + String((request.requiredApprovalLevels || [1]).length);
                    else if (column.key === "__approver1") cell.textContent = request.approver1 || "";
                    else if (column.key === "__approver2") cell.textContent = request.approver2 || "";
                    else if (column.key === "__approver3") cell.textContent = request.approver3 || "";
                    else if (column.key === "__status") { cell.textContent = plugin.statusLabel(request.status) + (request.status === "pending" ? " — L" + String(request.approvalLevel || 1) : ""); if (request.result && request.result.message) cell.title = request.result.message; }
                    else if (column.key === "__requesterNote") cell.textContent = request.requesterNote || "";
                    else if (column.key === "__approverNote1") cell.textContent = request.approverNote1 || "";
                    else if (column.key === "__approverNote2") cell.textContent = request.approverNote2 || "";
                    else if (column.key === "__approverNote3") cell.textContent = request.approverNote3 || "";
                    else if (column.key === "__actions") {
                        cell.className = "approvalcenter-actions approvalcenter-actions-column";
                        plugin.appendDecisionActions(cell, request, provider);
                    } else if (column.key === "result" && request.result && request.result.data && request.result.data.table) {
                        var viewResult = document.createElement("input"); viewResult.type = "button"; viewResult.value = "View table"; viewResult.className = "btn btn-primary btn-sm"; viewResult.setAttribute("data-meshcentral-plugin-pin", "approvalcenter"); viewResult.setAttribute("data-meshcentral-plugin-click", "View result table"); viewResult.onclick = function () { plugin.openResultTable(request); }; cell.appendChild(viewResult);
                    } else cell.textContent = request.fields && request.fields[column.key] != null ? String(request.fields[column.key]) : "";
                });
            });
            target.appendChild(table);
        }
        var view = plugin.state.views[provider.type];
        var previous = document.createElement("input"); previous.type = "button"; previous.value = "Previous"; previous.disabled = result.page <= 1; previous.onclick = function () { if (view.page > 1) { view.page--; plugin.loadProvider(provider.type); } }; pager.appendChild(previous);
        var label = document.createElement("span"); label.textContent = "Page " + result.page + " of " + result.pageCount + " (" + result.total + ")"; pager.appendChild(label);
        var next = document.createElement("input"); next.type = "button"; next.value = "Next"; next.disabled = result.page >= result.pageCount; next.onclick = function () { if (view.page < result.pageCount) { view.page++; plugin.loadProvider(provider.type); } }; pager.appendChild(next);
        var perLabel = document.createElement("label"); perLabel.textContent = "Per page "; var per = document.createElement("select"); [20, 50, 100].forEach(function (value) { var option = document.createElement("option"); option.value = value; option.textContent = value; per.appendChild(option); }); per.value = view.perPage; per.onchange = function () { view.perPage = Number(per.value); view.page = 1; plugin.loadProvider(provider.type); }; perLabel.appendChild(per); pager.appendChild(perLabel);
    };

    plugin.openDecision = function (requestId, decision, provider) {
        var approve = decision === "approve";
        var title = (approve ? "Approve " : "Reject ") + provider.title;
        var label = approve ? "Approval note (optional)" : "Rejection reason (optional)";
        var modern = typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal");
        var html = modern
            ? '<div id="ApprovalCenterDecisionDialog"><div class="form-floating mb-3"><textarea id="ApprovalCenterDecisionNote" class="form-control" maxlength="2000" placeholder="Note" style="height:110px"></textarea><label class="ms-2" for="ApprovalCenterDecisionNote">' + label + '</label></div><div id="ApprovalCenterDecisionStatus" class="small text-muted"></div></div>'
            : '<div id="ApprovalCenterDecisionDialog" class="approvalcenter-dialog"><label for="ApprovalCenterDecisionNote">' + label + '</label><textarea id="ApprovalCenterDecisionNote" rows="5" maxlength="2000"></textarea><span id="ApprovalCenterDecisionStatus" class="approvalcenter-status"></span></div>';
        var submit = function () {
            var note = document.getElementById("ApprovalCenterDecisionNote"), status = document.getElementById("ApprovalCenterDecisionStatus"), button = document.getElementById("idx_dlgOkButton");
            if (button) button.disabled = true;
            if (status) status.textContent = approve ? "Approving..." : "Rejecting...";
            var request = core.apiRequest(plugin.url("decision"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "requestId=" + encodeURIComponent(requestId) + "&decision=" + encodeURIComponent(decision) + "&note=" + encodeURIComponent(note ? note.value : "") });
            Promise.race([request, new Promise(function (_, reject) { window.setTimeout(function () { reject(new Error("Approval decision timed out. Check Approval Center status and try again.")); }, 15000); })]).then(function () {
                if (modern) { var modal = document.getElementById("xxAddAgentModal"), cancel = document.getElementById("idx_dlgCancelButton"); if (modal && document.activeElement && modal.contains(document.activeElement) && document.activeElement.blur) document.activeElement.blur(); if (cancel) cancel.click(); }
                plugin.loadProvider(provider.type); plugin.loadOverview();
                window.setTimeout(function () { if (plugin.state.activeTab === provider.type) plugin.loadProvider(provider.type); }, 1200);
            }).catch(function (error) { if (button) button.disabled = false; if (status) { status.textContent = error.message || "Could not update request."; status.className = modern ? "small text-danger" : "approvalcenter-status approvalcenter-status-error"; } });
            return false;
        };
        if (modern) {
            window.setModalContent("xxAddAgent", title, html);
            window.showModal("xxAddAgentModal", "idx_dlgOkButton", submit);
            var cancelButton = document.getElementById("idx_dlgCancelButton"); if (cancelButton) { cancelButton.textContent = "Cancel"; cancelButton.className = "btn btn-secondary"; }
            var ok = document.getElementById("idx_dlgOkButton");
            if (ok) { ok.textContent = approve ? "Approve" : "Reject"; ok.className = approve ? "btn btn-success" : "btn btn-danger"; }
        } else if (typeof window.setDialogMode === "function") {
            window.setDialogMode(2, title, 3, function (confirmed) { if (confirmed) submit(); }, html);
        }
    };

    plugin.settingsSection = function (title, content) {
        var section = document.createElement("section"); section.className = "approvalcenter-settings-section";
        var header = document.createElement("div"); header.className = "DevSt noselect approvalcenter-settings-header"; header.tabIndex = 0;
        var arrow = document.createElement("span"); arrow.textContent = "▼"; arrow.style.display = "inline-block"; arrow.style.width = "18px"; arrow.style.marginRight = "3px"; arrow.style.color = "#0d6efd"; arrow.style.transform = "rotate(-90deg)"; header.appendChild(arrow);
        var text = document.createElement("span"); text.textContent = title; header.appendChild(text);
        var panel = document.createElement("div"); panel.className = "approvalcenter-settings-content"; panel.hidden = true; panel.appendChild(content);
        var toggle = function () { panel.hidden = !panel.hidden; arrow.style.transform = panel.hidden ? "rotate(-90deg)" : "none"; plugin.updateContentScroll(); };
        header.onclick = toggle; header.onkeypress = function (event) { if (event && event.key === "Enter") toggle(); };
        section.appendChild(header); section.appendChild(panel); return section;
    };

    plugin.buildSettingsPanel = function (panel) {
        panel.className += " approvalcenter-settings";
        var loading = document.createElement("span"); loading.id = "ApprovalCenterSettingsLoading"; loading.className = "approvalcenter-status"; panel.appendChild(loading);
        var host = document.createElement("div"); host.id = "ApprovalCenterSettingsHost"; panel.appendChild(host);
    };

    plugin.loadSettings = function () {
        var loading = document.getElementById("ApprovalCenterSettingsLoading");
        if (loading) loading.textContent = "Loading settings...";
        core.apiRequest(plugin.url("settings")).then(function (result) {
            var host = document.getElementById("ApprovalCenterSettingsHost"); if (!host) return; host.innerHTML = "";
            var settings = result.settings || {};
            (settings.providers || []).forEach(function (provider) {
                var content = document.createElement("div");
                var visibility = document.createElement("label"); var enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.checked = provider.enabled !== false; enabled.setAttribute("data-meshcentral-plugin-pin", "approvalcenter"); enabled.setAttribute("data-meshcentral-plugin-click", "Toggle " + provider.title + " tab"); visibility.appendChild(enabled); visibility.appendChild(document.createTextNode(" Show this tab and its Overview section")); content.appendChild(visibility);
                var description = document.createElement("p"); description.textContent = "Assign a separate MeshCentral user group to each approval level. An empty level is available only to Site Admin. A requester cannot decide their own request unless they are Site Admin."; content.appendChild(description);
                var selects = {};
                [1, 2, 3].forEach(function (level) { var label = document.createElement("div"); label.className = "approvalcenter-group-label"; label.textContent = "Approval level " + level + " groups"; content.appendChild(label); var groupBox = document.createElement("div"); groupBox.className = "approvalcenter-group-checkboxes"; var assigned = provider.approverGroupIds && (provider.approverGroupIds[level] || provider.approverGroupIds[String(level)]); assigned = Array.isArray(assigned) ? assigned.map(String) : (assigned ? [String(assigned)] : (level === 1 && provider.approverGroupId ? [String(provider.approverGroupId)] : [])); (settings.groups || []).forEach(function (group) { var item = document.createElement("label"); item.className = "approvalcenter-group-checkbox"; var checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = String(group.id); checkbox.checked = assigned.indexOf(String(group.id)) >= 0; item.appendChild(checkbox); item.appendChild(document.createTextNode(" " + group.name)); groupBox.appendChild(item); }); content.appendChild(groupBox); selects[level] = groupBox; });
                var meshAssignments = {};
                if (provider.type === "moverequest" && Array.isArray(settings.meshGroups)) { var meshTitle = document.createElement("div"); meshTitle.className = "approvalcenter-group-label"; meshTitle.textContent = "Device groups and approval levels"; content.appendChild(meshTitle); var meshHost = document.createElement("div"); meshHost.className = "approvalcenter-mesh-assignments"; var existingMeshAssignments = provider.meshApproverGroupIds || {}; (settings.meshGroups || []).forEach(function (mesh) { var meshRow = document.createElement("div"); meshRow.className = "approvalcenter-mesh-row"; var meshName = document.createElement("strong"); meshName.textContent = mesh.name; meshRow.appendChild(meshName); meshAssignments[mesh.id] = {}; var assignedLevels = Array.isArray(existingMeshAssignments[mesh.id]) ? existingMeshAssignments[mesh.id].map(String) : []; [1, 2, 3].forEach(function (level) { var label = document.createElement("label"); var checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = String(level); checkbox.checked = assignedLevels.indexOf(String(level)) >= 0; checkbox.setAttribute("data-mesh-id", mesh.id); checkbox.setAttribute("data-mesh-level", String(level)); label.appendChild(checkbox); label.appendChild(document.createTextNode(" L" + level)); meshRow.appendChild(label); }); meshHost.appendChild(meshRow); }); content.appendChild(meshHost); }
                var save = document.createElement("input"); save.type = "button"; save.value = "Save settings"; save.className = "btn btn-primary btn-sm"; content.appendChild(save);
                var status = document.createElement("span"); status.className = "approvalcenter-status"; content.appendChild(status);
                save.onclick = function () { save.disabled = true; status.textContent = "Saving..."; function values(box) { return Array.prototype.map.call(box.querySelectorAll("input[type=checkbox]:checked"), function (input) { return input.value; }); } var body = "type=" + encodeURIComponent(provider.type) + "&group1Ids=" + encodeURIComponent(JSON.stringify(values(selects[1]))) + "&group2Ids=" + encodeURIComponent(JSON.stringify(values(selects[2]))) + "&group3Ids=" + encodeURIComponent(JSON.stringify(values(selects[3]))) + "&enabled=" + encodeURIComponent(enabled.checked ? "1" : "0"); if (provider.type === "moverequest") { var meshMap = {}; Array.prototype.forEach.call(content.querySelectorAll("input[data-mesh-id]:checked"), function (input) { var id = input.getAttribute("data-mesh-id"); meshMap[id] = meshMap[id] || []; meshMap[id].push(input.value); }); body += "&meshAssignmentsJson=" + encodeURIComponent(JSON.stringify(meshMap)); } core.apiRequest(plugin.url("provider-settings"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: body }).then(function () { status.textContent = "Settings saved."; status.className = "approvalcenter-status approvalcenter-status-ok"; return plugin.refreshProviders(); }).catch(function (error) { status.textContent = error.message || "Could not save settings."; status.className = "approvalcenter-status approvalcenter-status-error"; }).then(function () { save.disabled = false; }); };
                host.appendChild(plugin.settingsSection(provider.settingsTitle, content));
            });
            var retention = document.createElement("div");
            var info = document.createElement("p"); info.textContent = "Delete terminal requests older than the selected number of days. Pending, approved and executing requests are never removed."; retention.appendChild(info);
            var typeLabel = document.createElement("label"); typeLabel.textContent = "Provider"; retention.appendChild(typeLabel);
            var type = document.createElement("select"); var all = document.createElement("option"); all.value = ""; all.textContent = "All providers"; type.appendChild(all); (settings.providers || []).forEach(function (provider) { var option = document.createElement("option"); option.value = provider.type; option.textContent = provider.title; type.appendChild(option); }); retention.appendChild(type);
            var daysLabel = document.createElement("label"); daysLabel.textContent = "Keep data for (days)"; retention.appendChild(daysLabel);
            var days = document.createElement("input"); days.type = "number"; days.min = "1"; days.max = "36500"; days.value = settings.retentionDays || 365; retention.appendChild(days);
            var clean = document.createElement("input"); clean.type = "button"; clean.value = "Clean old data"; clean.className = "btn btn-danger btn-sm"; retention.appendChild(clean);
            var cleanStatus = document.createElement("span"); cleanStatus.className = "approvalcenter-status"; retention.appendChild(cleanStatus);
            clean.onclick = function () { clean.disabled = true; cleanStatus.textContent = "Cleaning..."; core.apiRequest(plugin.url("cleanup"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "type=" + encodeURIComponent(type.value) + "&retentionDays=" + encodeURIComponent(days.value) }).then(function (result) { cleanStatus.textContent = "Removed " + result.removed + " request(s)."; cleanStatus.className = "approvalcenter-status approvalcenter-status-ok"; }).catch(function (error) { cleanStatus.textContent = error.message || "Could not clean data."; cleanStatus.className = "approvalcenter-status approvalcenter-status-error"; }).then(function () { clean.disabled = false; }); };
            host.appendChild(plugin.settingsSection("Data retention", retention));

            var api = document.createElement("div");
            var apiInfo = document.createElement("p"); apiInfo.textContent = "Create scoped bearer tokens for server-to-server integrations. Each token acts as one existing MeshCentral user and is shown only once."; api.appendChild(apiInfo);
            var apiUrlLabel = document.createElement("label"); apiUrlLabel.textContent = "API base URL"; api.appendChild(apiUrlLabel);
            var apiUrl = document.createElement("input"); apiUrl.type = "text"; apiUrl.readOnly = true; apiUrl.value = new URL("approvalcenter/api/v1/", window.location.href).href; apiUrl.className = "approvalcenter-api-url"; api.appendChild(apiUrl);
            var nameLabel = document.createElement("label"); nameLabel.textContent = "Client name"; api.appendChild(nameLabel);
            var name = document.createElement("input"); name.type = "text"; name.maxLength = 120; name.placeholder = "ServiceNow approvals"; api.appendChild(name);
            var userLabel = document.createElement("label"); userLabel.textContent = "MeshCentral user ID"; api.appendChild(userLabel);
            var userId = document.createElement("input"); userId.type = "text"; userId.maxLength = 300; userId.placeholder = "user/domain/account"; api.appendChild(userId);
            var scopesLabel = document.createElement("label"); scopesLabel.textContent = "Scopes"; api.appendChild(scopesLabel);
            var scopesHost = document.createElement("div"); scopesHost.className = "approvalcenter-api-options"; api.appendChild(scopesHost);
            var scopeInputs = [];
            (settings.apiScopes || []).forEach(function (scope) { var item = document.createElement("label"); var checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = scope; checkbox.checked = true; item.appendChild(checkbox); item.appendChild(document.createTextNode(" " + scope)); scopesHost.appendChild(item); scopeInputs.push(checkbox); });
            var providersLabel = document.createElement("label"); providersLabel.textContent = "Providers (no selection means all providers)"; api.appendChild(providersLabel);
            var providerSelect = document.createElement("select"); providerSelect.multiple = true; providerSelect.size = Math.min(6, Math.max(2, (settings.providers || []).length));
            (settings.providers || []).forEach(function (provider) { var option = document.createElement("option"); option.value = provider.type; option.textContent = provider.title; providerSelect.appendChild(option); }); api.appendChild(providerSelect);
            var create = document.createElement("input"); create.type = "button"; create.value = "Create API token"; create.className = "btn btn-primary btn-sm"; api.appendChild(create);
            var apiStatus = document.createElement("span"); apiStatus.className = "approvalcenter-status"; api.appendChild(apiStatus);
            var tokenLabel = document.createElement("label"); tokenLabel.textContent = "New token — copy it now"; tokenLabel.hidden = true; api.appendChild(tokenLabel);
            var token = document.createElement("textarea"); token.readOnly = true; token.rows = 2; token.hidden = true; token.className = "approvalcenter-api-token"; api.appendChild(token);
            var clientsHost = document.createElement("div"); clientsHost.className = "approvalcenter-api-clients"; api.appendChild(clientsHost);
            var clients = Array.isArray(settings.apiClients) ? settings.apiClients.slice() : [];
            var renderClients = function () {
                clientsHost.innerHTML = "";
                if (!clients.length) { var empty = document.createElement("p"); empty.textContent = "No API clients configured."; clientsHost.appendChild(empty); return; }
                var table = document.createElement("table"); table.className = "approvalcenter-table"; var head = table.createTHead().insertRow(); ["Client", "Mesh user", "Scopes", "Providers", "Token", ""].forEach(function (value) { var cell = document.createElement("th"); cell.textContent = value; head.appendChild(cell); });
                var body = table.createTBody(); clients.forEach(function (client) { var row = body.insertRow(); [client.name, client.userId, (client.scopes || []).join(", "), (client.providerTypes || []).join(", ") || "All", client.tokenPrefix + "…"].forEach(function (value) { var cell = row.insertCell(); cell.textContent = value; }); var action = row.insertCell(); var revoke = document.createElement("input"); revoke.type = "button"; revoke.value = "Revoke"; revoke.className = "btn btn-danger btn-sm"; action.appendChild(revoke); revoke.onclick = function () { revoke.disabled = true; core.apiRequest(plugin.url("api-token-revoke"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "clientId=" + encodeURIComponent(client.id) }).then(function () { clients = clients.filter(function (item) { return item.id !== client.id; }); renderClients(); apiStatus.textContent = "API token revoked."; apiStatus.className = "approvalcenter-status approvalcenter-status-ok"; }).catch(function (error) { revoke.disabled = false; apiStatus.textContent = error.message || "Could not revoke the token."; apiStatus.className = "approvalcenter-status approvalcenter-status-error"; }); }; });
                clientsHost.appendChild(table);
            };
            create.onclick = function () {
                create.disabled = true; token.hidden = tokenLabel.hidden = true; apiStatus.textContent = "Creating token..."; apiStatus.className = "approvalcenter-status";
                var scopes = scopeInputs.filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
                var providerTypes = Array.prototype.filter.call(providerSelect.options, function (option) { return option.selected; }).map(function (option) { return option.value; });
                var body = "name=" + encodeURIComponent(name.value) + "&userId=" + encodeURIComponent(userId.value) + "&scopes=" + encodeURIComponent(scopes.join(",")) + "&providerTypes=" + encodeURIComponent(providerTypes.join(","));
                core.apiRequest(plugin.url("api-token-create"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: body }).then(function (result) { var created = result.result || {}; if (created.client) clients.push(created.client); renderClients(); token.value = created.token || ""; token.hidden = tokenLabel.hidden = false; apiStatus.textContent = "API token created. It will not be displayed again."; apiStatus.className = "approvalcenter-status approvalcenter-status-ok"; }).catch(function (error) { apiStatus.textContent = error.message || "Could not create the token."; apiStatus.className = "approvalcenter-status approvalcenter-status-error"; }).then(function () { create.disabled = false; });
            };
            renderClients();
            host.appendChild(plugin.settingsSection("External API", api));
            if (loading) loading.textContent = "";
            plugin.updateContentScroll();
        }).catch(function (error) { if (loading) { loading.textContent = error.message || "Could not load settings."; loading.className = "approvalcenter-status approvalcenter-status-error"; } });
    };

    plugin.showNativePage = function () {
        var page = document.getElementById("p1"), title = document.getElementById("p1title");
        if (!page || !title || !plugin.state.config) return null;
        var heading = title.querySelector("h1") || title.querySelector(".fs-4");
        var body = document.getElementById("ApprovalCenterBody");
        if (!body) { body = document.createElement("div"); body.id = "ApprovalCenterBody"; page.appendChild(body); }
        plugin.buildContent(body);
        if (plugin.state.nativeState) return page;
        var hidden = [];
        for (var child = page.firstElementChild; child; child = child.nextElementSibling) if (child !== title && child !== body) hidden.push(core.hideNativeElement(child));
        plugin.state.nativeState = { heading: heading, headingText: heading ? heading.textContent : "", hidden: hidden, toolbar: core.hideNativeElement(title.querySelector('[id="devListToolbarViewIcons"]')) };
        if (heading) heading.textContent = plugin.state.config.name;
        body.style.display = ""; page.style.display = ""; return page;
    };

    plugin.restoreNativePage = function () {
        var state = plugin.state.nativeState; if (!state) return;
        if (state.heading) state.heading.textContent = state.headingText;
        state.hidden.forEach(core.restoreNativeElement); core.restoreNativeElement(state.toolbar);
        var body = document.getElementById("ApprovalCenterBody"); if (body) body.style.display = "none";
        plugin.state.nativeState = null;
    };

    plugin.clearSelection = function () {
        Array.prototype.forEach.call(document.querySelectorAll("#MainMenuSpan .fullselect, #MainMenuSpan .semiselect, #page_leftbar .lbbuttonsel, #page_leftbar .lbbuttonsel2, #page_leftbar .active"), function (element) { element.classList.remove("fullselect", "semiselect", "lbbuttonsel", "lbbuttonsel2", "active"); });
    };

    plugin.syncMenu = function () { core.setPluginMenuActive(document.getElementById("MainMenuApprovalCenter"), document.getElementById("LeftMenuApprovalCenter"), plugin.state.active); };
    plugin.open = function (event) {
        if (event && (event.which === 3 || event.button === 2)) return false;
        if (!plugin.state.access || !plugin.state.access.allowed || plugin.state.opening) return false;
        plugin.state.opening = true;
        try {
            if (typeof window.go === "function") window.go(1);
            if (core.activePlugin && core.activePlugin !== plugin && typeof core.activePlugin.close === "function") core.activePlugin.close(false);
            var page = plugin.showNativePage(); if (!page) return false;
            core.activePlugin = plugin; plugin.clearSelection(); plugin.state.active = true; plugin.syncMenu();
            window.xxcurrentView = plugin.state.config.viewMode; plugin.setRequestedInUrl(true); plugin.activateTab(plugin.state.activeTab || "overview");
            plugin.refreshProviders().catch(function (error) { if (window.console) window.console.error("Approval Center provider refresh error", error); });
            if (event && event.preventDefault) event.preventDefault(); return false;
        } finally { plugin.state.opening = false; }
    };
    plugin.close = function (clearUrl) { plugin.state.active = false; if (core.activePlugin === plugin) core.activePlugin = null; plugin.restoreNativePage(); plugin.syncMenu(); if (clearUrl) plugin.setRequestedInUrl(false); };
    plugin.isRequestedInUrl = function () { try { var query = new URL(window.location.href).searchParams; return Number(query.get("viewmode")) === Number(plugin.state.config && plugin.state.config.viewMode) || query.get("plugin") === "approvalcenter"; } catch (error) { return false; } };
    plugin.setRequestedInUrl = function (enabled) { try { var url = new URL(window.location.href); if (enabled) url.searchParams.set("viewmode", String(plugin.state.config.viewMode)); else if (Number(url.searchParams.get("viewmode")) === Number(plugin.state.config.viewMode)) url.searchParams.delete("viewmode"); if (url.searchParams.get("plugin") === "approvalcenter") url.searchParams.delete("plugin"); window.history.replaceState({}, document.title, url.pathname + url.search + url.hash); } catch (error) { } };
    plugin.onNativePageStart = function () { if (plugin.state.active) plugin.close(true); };
    plugin.onNativePageEnd = function () { if (plugin.state.access && plugin.state.access.allowed) plugin.ensureMenus(); plugin.syncMenu(); };
}());

