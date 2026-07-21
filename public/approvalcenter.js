(function () {
    "use strict";

    var selectedProvider = "";
    var selectedStatus = "";
    var overviewFilter = "";
    var providers = [];
    var requests = [];
    var providerOrder = ["moverequests", "mycommands", "myscripts"];
    var providerTitles = {
        moverequests: "Move Request",
        mycommands: "Commands",
        myscripts: "Scripts"
    };
    var providerIcons = {
        moverequests: "↔",
        mycommands: "⌨",
        myscripts: "▷"
    };

    function orderedProviders(rows) {
        var map = Object.create(null);
        (rows || []).forEach(function (item) { map[item.type] = item; });
        return providerOrder.map(function (type) { return map[type]; }).filter(Boolean);
    }

    function createNavButton(host, options) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = options.className || "mc-shared-nav-item";
        button.classList.toggle("active", options.active === true);
        button.title = options.title;

        var icon = document.createElement("span");
        icon.className = "mc-nav-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = options.icon || "•";
        button.appendChild(icon);

        var label = document.createElement("span");
        label.className = "mc-approval-label";
        label.textContent = options.title + (options.count == null ? "" : " - " + options.count);
        button.appendChild(label);
        button.onclick = options.onClick;
        host.appendChild(button);
        return button;
    }

    function selectProvider(shell, type) {
        selectedProvider = type;
        selectedStatus = "";
        shell.render();
    }

    function renderProviderButtons(host, shell) {
        providers.forEach(function (provider) {
            createNavButton(host, {
                title: providerTitles[provider.type] || provider.tabTitle || provider.title,
                icon: providerIcons[provider.type] || "◇",
                className: "mc-shared-nav-item mc-approval-provider",
                active: selectedProvider === provider.type,
                onClick: function () { selectProvider(shell, provider.type); }
            });
        });
    }

    function renderPrimaryNavigation(shell) {
        var host = shell.state.page.primary;
        host.innerHTML = "";
        createNavButton(host, {
            title: "Overview",
            icon: "▦",
            active: !selectedProvider,
            onClick: function () {
                selectedProvider = "";
                selectedStatus = "";
                shell.render();
            }
        });
        renderProviderButtons(host, shell);
    }

    function requestCounts(rows) {
        var counts = { all: rows.length, moverequests: 0, mycommands: 0, myscripts: 0 };
        rows.forEach(function (request) {
            if (Object.prototype.hasOwnProperty.call(counts, request.type)) counts[request.type]++;
        });
        return counts;
    }

    function renderOverviewFilters(shell, rows) {
        var host = shell.state.page.secondary;
        var counts = requestCounts(rows);
        host.innerHTML = "";
        createNavButton(host, {
            title: "All",
            icon: "▤",
            count: counts.all,
            active: !overviewFilter,
            onClick: function () { overviewFilter = ""; shell.render(); }
        });
        providers.forEach(function (provider) {
            createNavButton(host, {
                title: providerTitles[provider.type] || provider.title,
                icon: providerIcons[provider.type] || "◇",
                count: counts[provider.type] || 0,
                active: overviewFilter === provider.type,
                onClick: function () { overviewFilter = provider.type; shell.render(); }
            });
        });
    }

    function renderStatusNavigation(shell) {
        var host = shell.state.page.secondary;
        host.innerHTML = "";
        window.SharedStatusNav.list().forEach(function (status) {
            createNavButton(host, {
                title: status.title,
                icon: status.icon,
                className: "mc-shared-nav-item mc-approval-status",
                active: selectedStatus === status.key,
                onClick: function () { selectedStatus = status.key; shell.render(); }
            });
        });
    }

    function decisionButtons(shell, request, host) {
        if (!request.canDecide) return null;
        var actions = document.createElement("div");
        actions.className = "mc-approval-request-actions";
        [
            { title: "Approve", approved: true, className: "btn btn-primary btn-sm" },
            { title: "Reject", approved: false, className: "btn btn-secondary btn-sm" }
        ].forEach(function (definition) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = definition.className;
            button.textContent = definition.title;
            button.onclick = function () {
                button.disabled = true;
                shell.post("decide", { id: request.id, approved: definition.approved, note: "" })
                    .then(shell.render)
                    .catch(function (error) {
                        button.disabled = false;
                        shell.error(host, error);
                    });
            };
            actions.appendChild(button);
        });
        return actions;
    }

    function renderRequestCards(shell, title, emptyText, rows) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        rows = rows || requests;
        if (title) host.appendChild(shell.element("h3", "mc-approval-details-title", title));
        if (!rows.length) {
            host.appendChild(shell.card("No requests", emptyText || "No requests match the selected provider and status."));
            return;
        }
        var grid = document.createElement("div");
        grid.className = "mc-approval-card-grid";
        host.appendChild(grid);
        rows.forEach(function (request) {
            var card = shell.card(request.title || request.type, (request.requester && request.requester.name || "") + " · " + request.status);
            card.classList.add("mc-approval-request-card");
            card.appendChild(shell.element("div", "mc-shared-muted", new Date(request.createdAt).toLocaleString()));
            if (request.summary) card.appendChild(shell.element("div", "mc-approval-request-summary", request.summary));
            card.appendChild(shell.element("div", "mc-approval-request-provider", providerTitles[request.type] || request.type));
            var actions = decisionButtons(shell, request, host);
            if (actions) card.appendChild(actions);
            grid.appendChild(card);
        });
    }

    function providerColumns(shell, host) {
        return [
            { title: "DateTime", value: function (row) { return row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"; } },
            { title: "Request", value: function (row) { return row.title || row.summary || row.type || "—"; } },
            { title: "Requester", value: function (row) { return row.requester && row.requester.name || "—"; } },
            { title: "Level", value: function (row) { return row.currentLevel || row.approvalLevel || "—"; } },
            { title: "Status", value: function (row) { return row.status || "—"; }, className: function (row) { return "mc-results-status mc-results-status-" + String(row.status || "unknown").toLowerCase(); } },
            { title: "Summary", value: function (row) { return row.summary || "—"; } },
            {
                title: "Actions",
                render: function (cell, row) {
                    var view = document.createElement("button");
                    view.type = "button";
                    view.className = "btn btn-primary btn-sm mc-results-view-button";
                    view.textContent = "View";
                    view.onclick = function () { window.SharedResultsView.openViewer(row, { title: row.title || "Request details" }); };
                    cell.appendChild(view);
                    var actions = decisionButtons(shell, row, host);
                    if (actions) cell.appendChild(actions);
                }
            }
        ];
    }

    function renderProviderTable(shell, title, emptyText, rows) {
        var host = shell.state.page.details;
        window.SharedResultsView.mountTable(host, {
            title: title,
            rows: rows || [],
            columns: providerColumns(shell, host),
            emptyText: emptyText,
            filter: true,
            filterPlaceholder: "Filter requests"
        });
        Array.prototype.forEach.call(host.querySelectorAll("tbody tr"), function (tr, rowIndex) {
            var request = rows[rowIndex];
            var cells = tr.cells;
            var column = providerColumns(shell, host)[cells.length - 1];
            if (column && column.render) {
                cells[cells.length - 1].innerHTML = "";
                column.render(cells[cells.length - 1], request);
            }
        });
    }

    function loadRequests(shell, options) {
        options = options || {};
        return shell.api("requests", {
            type: options.type || "",
            status: options.status || "",
            q: shell.state.search,
            page: 1,
            perPage: 100
        }).then(function (result) {
            requests = result.rows || [];
            if (typeof options.afterLoad === "function") options.afterLoad(requests);
            else if (options.table) renderProviderTable(shell, options.title, options.emptyText, requests);
            else renderRequestCards(shell, options.title, options.emptyText, requests);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "approvalcenter",
        title: "Approval Center",
        menuTitle: "Approval Center",
        order: 110,
        preset: "approvalcenter",
        buttons: { favorites: false, manage: false, settings: false, link: false },
        tabs: [],
        defaultTab: "",
        render: function (shell) {
            return shell.api("providers").then(function (result) {
                providers = orderedProviders(result.providers || []);
                renderPrimaryNavigation(shell);
                if (!selectedProvider) {
                    return loadRequests(shell, {
                        status: "pending",
                        afterLoad: function (rows) {
                            renderOverviewFilters(shell, rows);
                            var filtered = overviewFilter ? rows.filter(function (request) { return request.type === overviewFilter; }) : rows;
                            renderRequestCards(shell, overviewFilter ? (providerTitles[overviewFilter] || overviewFilter) + " awaiting approval" : "Requests awaiting approval", "There are no pending requests for the selected filter.", filtered);
                        }
                    });
                }
                renderStatusNavigation(shell);
                return loadRequests(shell, {
                    type: selectedProvider,
                    status: selectedStatus,
                    title: providerTitles[selectedProvider] || selectedProvider,
                    emptyText: "No requests match the selected provider and status.",
                    table: true
                });
            });
        }
    });

    window.MyCompanyModules.approvalcenter = module;
}());