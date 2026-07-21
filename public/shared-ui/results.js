(function () {
    "use strict";

    function valueAt(row, path, fallback) {
        var current = row;
        var parts = String(path || "").split(".");
        for (var index = 0; index < parts.length; index++) {
            if (current == null) return fallback;
            current = current[parts[index]];
        }
        return current == null || current === "" ? fallback : current;
    }

    function approver(row) {
        if (row.approver && row.approver.name) return row.approver.name;
        var decisions = Array.isArray(row.approvalDecisions) ? row.approvalDecisions : [];
        for (var index = decisions.length - 1; index >= 0; index--) {
            if (decisions[index].user && decisions[index].user.name) return decisions[index].user.name;
        }
        return "—";
    }

    function resultText(row) {
        var result = row && row.result || {};
        return result.output || result.message || row.output || (row.status === "pending"
            ? "Waiting for approval."
            : row.status === "executing" ? "Executing..." : row.status || "—");
    }

    function debugText(row) {
        var result = row && row.result || {};
        return result.debug || result.rawOutput || result.stderr || row.debug || row.rawOutput || resultText(row);
    }

    function structuredRows(row) {
        var result = row && row.result || {};
        var candidates = [result.table, result.rows, result.data, row.table, row.rows];
        for (var index = 0; index < candidates.length; index++) {
            if (Array.isArray(candidates[index]) && candidates[index].length) return candidates[index];
        }
        return [];
    }

    function copyText(text) {
        text = String(text == null ? "" : text);
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); } finally { document.body.removeChild(area); }
        return Promise.resolve();
    }

    function renderObjectTable(host, rows) {
        if (!rows.length || typeof rows[0] !== "object" || rows[0] == null) return false;
        var keys = [];
        rows.forEach(function (row) {
            Object.keys(row || {}).forEach(function (key) {
                if (keys.indexOf(key) < 0) keys.push(key);
            });
        });
        var wrapper = document.createElement("div");
        wrapper.className = "mc-results-table-wrap";
        var table = document.createElement("table");
        table.className = "style1 mc-results-table mc-results-structured-table";
        wrapper.appendChild(table);
        var header = table.createTHead().insertRow();
        keys.forEach(function (key) {
            var cell = document.createElement("th");
            cell.textContent = key;
            header.appendChild(cell);
        });
        var body = table.createTBody();
        rows.forEach(function (row) {
            var tr = body.insertRow();
            keys.forEach(function (key) {
                var value = row[key];
                var cell = tr.insertCell();
                cell.textContent = typeof value === "object" && value != null ? JSON.stringify(value) : String(value == null ? "" : value);
            });
        });
        host.appendChild(wrapper);
        return true;
    }

    function openViewer(row, options) {
        options = options || {};
        var overlay = document.createElement("div");
        overlay.className = "mc-results-viewer-overlay";
        var dialog = document.createElement("section");
        dialog.className = "mc-results-viewer";
        overlay.appendChild(dialog);

        var header = document.createElement("div");
        header.className = "mc-results-viewer-header";
        var title = document.createElement("h3");
        title.textContent = options.title || row.title || "Result";
        header.appendChild(title);
        var actions = document.createElement("div");
        actions.className = "mc-results-viewer-actions";
        var copy = document.createElement("button");
        copy.type = "button";
        copy.className = "btn btn-secondary btn-sm";
        copy.textContent = "Copy";
        copy.onclick = function () { copyText(debugText(row)); };
        var close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-secondary btn-sm";
        close.textContent = "Close";
        close.onclick = function () { overlay.remove(); };
        actions.appendChild(copy);
        actions.appendChild(close);
        header.appendChild(actions);
        dialog.appendChild(header);

        var content = document.createElement("div");
        content.className = "mc-results-viewer-content";
        var rows = structuredRows(row);
        if (!renderObjectTable(content, rows)) {
            var output = document.createElement("pre");
            output.className = "mc-results-viewer-output";
            output.textContent = resultText(row);
            content.appendChild(output);
        }

        var details = document.createElement("details");
        details.className = "mc-results-debug";
        var summary = document.createElement("summary");
        summary.textContent = "Debug / full output";
        details.appendChild(summary);
        var debug = document.createElement("pre");
        debug.textContent = debugText(row);
        details.appendChild(debug);
        content.appendChild(details);
        dialog.appendChild(content);

        overlay.onclick = function (event) { if (event.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    function defaultColumns(kind) {
        var columns = [
            { title: "DateTime", value: function (row) { return row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"; } },
            { title: kind === "commands" ? "Command" : "Script", value: function (row) { return row.title || valueAt(row, "result.command", "") || row.summary || "—"; } }
        ];
        if (kind === "commands") {
            columns.push({ title: "Device", value: function (row) { return valueAt(row, "result.nodeName", "") || valueAt(row, "result.nodeId", "") || String(row.summary || "").replace(/^Device:\s*/i, "") || "—"; } });
        }
        columns.push(
            { title: "Requester", value: function (row) { return valueAt(row, "requester.name", "—"); } },
            { title: "Approver", value: approver },
            { title: "Status", value: function (row) { return row.status || "—"; }, className: function (row) { return "mc-results-status mc-results-status-" + String(row.status || "unknown").toLowerCase(); } },
            { title: "Result", value: resultText, pre: true },
            { title: "Actions", action: true }
        );
        return columns;
    }

    window.SharedResultsView = {
        mountStatus: function (host, options) {
            options = options || {};
            window.SharedStatusNav.mount(host, { selected: options.selected || "", counts: options.counts, onSelect: options.onSelect });
        },
        openViewer: openViewer,
        copyText: copyText,
        mountTable: function (host, options) {
            options = options || {};
            var rows = Array.isArray(options.rows) ? options.rows.slice() : [];
            var columns = options.columns || defaultColumns(options.kind || "scripts");
            host.innerHTML = "";

            if (options.title) {
                var title = document.createElement("h3");
                title.className = "mc-results-title";
                title.textContent = options.title;
                host.appendChild(title);
            }

            if (options.filter !== false) {
                var filter = document.createElement("input");
                filter.type = "search";
                filter.className = "mc-results-filter";
                filter.placeholder = options.filterPlaceholder || "Filter results";
                host.appendChild(filter);
                filter.oninput = function () {
                    var query = filter.value.toLowerCase();
                    Array.prototype.forEach.call(host.querySelectorAll("tbody tr"), function (row) {
                        row.hidden = query && row.textContent.toLowerCase().indexOf(query) < 0;
                    });
                };
            }

            if (!rows.length) {
                var empty = document.createElement("div");
                empty.className = "mc-shared-card";
                empty.appendChild(document.createElement("strong")).textContent = "No results";
                var message = document.createElement("div");
                message.className = "mc-shared-muted";
                message.textContent = options.emptyText || "No results match the selected status.";
                empty.appendChild(message);
                host.appendChild(empty);
                return;
            }

            var wrapper = document.createElement("div");
            wrapper.className = "mc-results-table-wrap";
            var table = document.createElement("table");
            table.className = "style1 mc-results-table";
            wrapper.appendChild(table);
            host.appendChild(wrapper);
            var header = table.createTHead().insertRow();
            columns.forEach(function (column) {
                var cell = document.createElement("th");
                cell.textContent = column.title;
                header.appendChild(cell);
            });
            var body = table.createTBody();
            rows.forEach(function (row) {
                var tableRow = body.insertRow();
                columns.forEach(function (column) {
                    var cell = tableRow.insertCell();
                    if (column.action) {
                        var view = document.createElement("button");
                        view.type = "button";
                        view.className = "btn btn-primary btn-sm mc-results-view-button";
                        view.textContent = "View";
                        view.onclick = function () { openViewer(row, options); };
                        var copy = document.createElement("button");
                        copy.type = "button";
                        copy.className = "btn btn-secondary btn-sm mc-results-copy-button";
                        copy.title = "Copy result";
                        copy.textContent = "⧉";
                        copy.onclick = function () { copyText(debugText(row)); };
                        cell.appendChild(view);
                        cell.appendChild(copy);
                        return;
                    }
                    var value = typeof column.value === "function" ? column.value(row) : valueAt(row, column.path, "—");
                    cell.className = typeof column.className === "function" ? column.className(row) || "" : column.className || "";
                    if (column.pre) {
                        var pre = document.createElement("pre");
                        pre.className = "mc-results-output";
                        pre.textContent = String(value == null ? "" : value);
                        cell.appendChild(pre);
                    } else {
                        cell.textContent = String(value == null ? "" : value);
                    }
                });
            });
        }
    };
}());