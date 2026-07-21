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

    function orderedProviders(rows) {
        var map = Object.create(null);
        (rows || []).forEach(function (item) {
            map[item.type] = item;
        });
        return providerOrder.map(function (type) {
            return map[type];
        }).filter(Boolean);
    }

    function providerIcon(type) {
        if (type === "moverequests") return "⇄";
        if (type === "mycommands") return ">_";
        return "▶";
    }

    function createNavButton(host, options) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = options.className || "mc-shared-nav-item";
        button.textContent = (options.icon ? options.icon + " " : "") +
            options.title +
            (options.count == null ? "" : " - " + options.count);
        button.classList.toggle("active", options.active === true);
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
                icon: providerIcon(provider.type),
                className: "mc-shared-nav-item mc-approval-provider",
                active: selectedProvider === provider.type,
                onClick: function () {
                    selectProvider(shell, provider.type);
                }
            });
        });
    }

    function renderPrimaryNavigation(shell) {
        var host = shell.state.page.primary;
        host.innerHTML = "";

        createNavButton(host, {
            title: "Overview",
            icon: "▣",
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
        var counts = {
            all: rows.length,
            moverequests: 0,
            mycommands: 0,
            myscripts: 0
        };

        rows.forEach(function (request) {
            if (Object.prototype.hasOwnProperty.call(counts, request.type)) {
                counts[request.type]++;
            }
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
            onClick: function () {
                overviewFilter = "";
                shell.render();
            }
        });

        providers.forEach(function (provider) {
            createNavButton(host, {
                title: providerTitles[provider.type] || provider.title,
                icon: providerIcon(provider.type),
                count: counts[provider.type] || 0,
                active: overviewFilter === provider.type,
                onClick: function () {
                    overviewFilter = provider.type;
                    shell.render();
                }
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
                onClick: function () {
                    selectedStatus = status.key;
                    shell.render();
                }
            });
        });
    }

    function renderRequestCards(shell, title, emptyText, rows) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        rows = rows || requests;

        if (title) {
            host.appendChild(shell.element(
                "h3",
                "mc-approval-details-title",
                title
            ));
        }

        if (!rows.length) {
            host.appendChild(shell.card(
                "No requests",
                emptyText || "No requests match the selected provider and status."
            ));
            return;
        }

        var grid = document.createElement("div");
        grid.className = "mc-approval-card-grid";
        host.appendChild(grid);

        rows.forEach(function (request) {
            var card = shell.card(
                request.title || request.type,
                (request.requester && request.requester.name || "") +
                    " · " +
                    request.status
            );
            card.classList.add("mc-approval-request-card");

            card.appendChild(shell.element(
                "div",
                "mc-shared-muted",
                new Date(request.createdAt).toLocaleString()
            ));

            if (request.summary) {
                card.appendChild(shell.element(
                    "div",
                    "mc-approval-request-summary",
                    request.summary
                ));
            }

            var providerTitle = providerTitles[request.type] || request.type;
            if (providerTitle) {
                card.appendChild(shell.element(
                    "div",
                    "mc-approval-request-provider",
                    providerTitle
                ));
            }

            if (request.canDecide) {
                var actions = document.createElement("div");
                actions.className = "mc-approval-request-actions";

                var approve = shell.element(
                    "button",
                    "btn btn-primary btn-sm",
                    "Approve"
                );
                approve.type = "button";
                approve.onclick = function () {
                    approve.disabled = true;
                    shell.post("decide", {
                        id: request.id,
                        approved: true,
                        note: ""
                    }).then(shell.render).catch(function (error) {
                        approve.disabled = false;
                        shell.error(host, error);
                    });
                };

                var reject = shell.element(
                    "button",
                    "btn btn-secondary btn-sm",
                    "Reject"
                );
                reject.type = "button";
                reject.onclick = function () {
                    reject.disabled = true;
                    shell.post("decide", {
                        id: request.id,
                        approved: false,
                        note: ""
                    }).then(shell.render).catch(function (error) {
                        reject.disabled = false;
                        shell.error(host, error);
                    });
                };

                actions.appendChild(approve);
                actions.appendChild(reject);
                card.appendChild(actions);
            }

            grid.appendChild(card);
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
            if (typeof options.afterLoad === "function") {
                options.afterLoad(requests);
            } else {
                renderRequestCards(shell, options.title, options.emptyText);
            }
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "approvalcenter",
        title: "Approval Center",
        menuTitle: "Approval Center",
        order: 110,
        preset: "approvalcenter",
        buttons: {
            favorites: false,
            manage: false,
            settings: false
        },
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
                            var filtered = overviewFilter
                                ? rows.filter(function (request) {
                                    return request.type === overviewFilter;
                                })
                                : rows;
                            var title = overviewFilter
                                ? (providerTitles[overviewFilter] || overviewFilter) + " awaiting approval"
                                : "Requests awaiting approval";
                            renderRequestCards(
                                shell,
                                title,
                                "There are no pending requests for the selected filter.",
                                filtered
                            );
                        }
                    });
                }

                renderStatusNavigation(shell);
                return loadRequests(shell, {
                    type: selectedProvider,
                    status: selectedStatus,
                    title: providerTitles[selectedProvider] || selectedProvider,
                    emptyText: "No requests match the selected provider and status."
                });
            });
        }
    });

    window.MyCompanyModules.approvalcenter = module;
}());
