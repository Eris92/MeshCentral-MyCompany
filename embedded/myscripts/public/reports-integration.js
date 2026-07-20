(function () {
    "use strict";

    var plugin = window.MyScripts;
    var core = window.MeshPluginCore;
    if (!plugin || !core || plugin.reportsIntegrationInstalled) return;
    plugin.reportsIntegrationInstalled = true;

    function createButton(text, handler, title, primary) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn " + (primary ? "btn-primary" : "btn-secondary") + " btn-sm";
        button.textContent = text;
        button.title = title || text;
        button.setAttribute("aria-label", button.title);
        button.addEventListener("click", handler);
        return button;
    }

    function localDate(value) {
        if (!value) return "—";
        try { return new Date(value).toLocaleString(); }
        catch (error) { return String(value); }
    }

    function resultMessage(item) {
        var result = item && item.result || {};
        if (result.message != null && String(result.message).trim()) return String(result.message);
        if (item && item.status === "pending") return "Waiting for approval.";
        if (item && item.status === "executing") return "Executing...";
        return "—";
    }

    function canViewResult(item) {
        var message = resultMessage(item);
        return message !== "—" && message !== "Waiting for approval." && message !== "Executing...";
    }

    function truncate(value) {
        value = String(value == null ? "" : value);
        return value.length > 180 ? value.slice(0, 180) + "…" : value;
    }

    function showResult(item) {
        if (typeof plugin.showResult === "function") {
            plugin.showResult(item);
            return;
        }

        var html = '<div id="MyScriptsReportResultView" class="myscripts-result-view"></div>';
        if (typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal")) {
            window.setModalContent("xxAddAgent", "Report preview", html);
            window.showModal("xxAddAgentModal", "idx_dlgOkButton", function () { return true; });
        } else if (typeof window.setDialogMode === "function") {
            window.setDialogMode(2, "Report preview", 3, function () { return true; }, html);
        }

        var host = document.getElementById("MyScriptsReportResultView");
        if (host && typeof plugin.renderOutput === "function") plugin.renderOutput(host, resultMessage(item), "No report output.", "");
    }

    plugin.loadResults = function () {
        var panel = document.getElementById("MyScriptsResultsPanel");
        if (!panel) return;

        panel.innerHTML = "";
        var state = plugin.state.results || (plugin.state.results = { filter: "", status: "", page: 1, perPage: 20 });

        var toolbar = document.createElement("div");
        toolbar.className = "myscripts-results-toolbar";

        var filter = document.createElement("input");
        filter.type = "search";
        filter.placeholder = "Filter";
        filter.value = state.filter || "";
        filter.className = "myscripts-results-filter";
        toolbar.appendChild(filter);

        var statusFilter = document.createElement("select");
        [["", "All statuses"], ["pending", "Pending"], ["executing", "Executing"], ["completed", "Completed"], ["failed", "Failed"], ["rejected", "Rejected"], ["replaced", "Replaced"]].forEach(function (pair) {
            var option = document.createElement("option");
            option.value = pair[0];
            option.textContent = pair[1];
            statusFilter.appendChild(option);
        });
        statusFilter.value = state.status || "";
        toolbar.appendChild(statusFilter);

        var refresh = createButton("Refresh", function () { plugin.loadResults(); }, "Refresh script results", true);
        refresh.setAttribute("data-meshcentral-plugin-pin", "myscripts");
        refresh.setAttribute("data-meshcentral-plugin-click", "Refresh script results");
        toolbar.appendChild(refresh);
        panel.appendChild(toolbar);

        var loading = document.createElement("span");
        loading.className = "myscripts-status";
        loading.textContent = "Loading results...";
        panel.appendChild(loading);

        var tableHost = document.createElement("div");
        tableHost.className = "myscripts-results-host";
        panel.appendChild(tableHost);

        function render(rows) {
            tableHost.innerHTML = "";
            var query = String(state.filter || "").toLowerCase();
            var filtered = (rows || []).filter(function (item) {
                var fields = item.fields || {};
                var text = [item.createdAt, fields.script, item.summary, item.status, item.requester && item.requester.name, item.approver && item.approver.name, resultMessage(item)].join(" ").toLowerCase();
                return (!query || text.indexOf(query) >= 0) && (!state.status || item.status === state.status);
            });

            var pageCount = Math.max(1, Math.ceil(filtered.length / state.perPage));
            if (state.page > pageCount) state.page = pageCount;
            if (state.page < 1) state.page = 1;
            var visible = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
            plugin.state.resultVisibleRows = visible;

            if (!filtered.length) {
                var empty = document.createElement("p");
                empty.textContent = "No script requests or results.";
                tableHost.appendChild(empty);
                return;
            }

            var table = document.createElement("table");
            table.className = "style1 myscripts-results-table";
            var header = table.createTHead().insertRow();
            ["DateTime", "Script", "Requester", "Approver", "Approval", "Status", "Result", "View"].forEach(function (label) {
                var cell = document.createElement("th");
                cell.textContent = label;
                header.appendChild(cell);
            });

            var body = table.createTBody();
            visible.forEach(function (item) {
                var row = body.insertRow();
                var fields = item.fields || {};
                var progress = item.approvalProgress || {};
                var progressText = progress.text || ((Number(progress.approved) || 0) + "/" + (Number(progress.total) || 0));
                var values = [
                    localDate(item.createdAt),
                    fields.script || item.summary || "—",
                    item.requester && item.requester.name || "—",
                    item.approver && item.approver.name || "—",
                    progressText,
                    item.status || "—",
                    truncate(resultMessage(item))
                ];

                values.forEach(function (value, index) {
                    var cell = row.insertCell();
                    cell.textContent = String(value);
                    if (index === 5) cell.className = "myscripts-result-status myscripts-result-status-" + String(item.status || "").toLowerCase();
                });

                var viewCell = row.insertCell();
                viewCell.className = "myscripts-result-view-cell";
                if (canViewResult(item)) {
                    var view = createButton("View", function () { showResult(item); }, "Preview full report result", true);
                    view.classList.add("myscripts-result-view-button");
                    view.setAttribute("data-meshcentral-plugin-pin", "myscripts");
                    view.setAttribute("data-meshcentral-plugin-click", "View report result");
                    viewCell.appendChild(view);
                }
            });
            tableHost.appendChild(table);

            var pager = document.createElement("div");
            pager.className = "myscripts-results-pager";
            var previous = createButton("Previous", function () { if (state.page > 1) { state.page--; render(rows); } }, "Previous page", false);
            previous.disabled = state.page <= 1;
            pager.appendChild(previous);

            var pageLabel = document.createElement("span");
            pageLabel.textContent = "Page " + state.page + " of " + pageCount + " (" + filtered.length + ")";
            pager.appendChild(pageLabel);

            var next = createButton("Next", function () { if (state.page < pageCount) { state.page++; render(rows); } }, "Next page", false);
            next.disabled = state.page >= pageCount;
            pager.appendChild(next);

            var perLabel = document.createElement("label");
            perLabel.textContent = "Per page ";
            var perPage = document.createElement("select");
            [20, 50, 100].forEach(function (value) {
                var option = document.createElement("option");
                option.value = String(value);
                option.textContent = String(value);
                perPage.appendChild(option);
            });
            perPage.value = String(state.perPage);
            perPage.addEventListener("change", function () {
                state.perPage = Number(perPage.value) || 20;
                state.page = 1;
                render(rows);
            });
            perLabel.appendChild(perPage);
            pager.appendChild(perLabel);
            tableHost.appendChild(pager);
        }

        filter.addEventListener("input", function () {
            state.filter = filter.value.trim();
            state.page = 1;
            window.clearTimeout(filter._myscriptsTimer);
            filter._myscriptsTimer = window.setTimeout(function () { render(plugin.state.resultRows || []); }, 160);
        });
        statusFilter.addEventListener("change", function () {
            state.status = statusFilter.value;
            state.page = 1;
            render(plugin.state.resultRows || []);
        });

        core.apiRequest(plugin.url("results")).then(function (result) {
            plugin.state.resultRows = result.rows || [];
            loading.textContent = "";
            render(plugin.state.resultRows);
        }).catch(function (error) {
            loading.textContent = error.message || "Could not load script results.";
            loading.className = "myscripts-status myscripts-status-error";
        });
    };
}());
