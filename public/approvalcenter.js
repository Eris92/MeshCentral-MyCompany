(function () {
    "use strict";

    var selectedProvider = "";
    var selectedStatus = "";
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

    function renderPrimaryNavigation(shell) {
        var items = [{
            key: "overview",
            title: "Overview",
            icon: "▣"
        }].concat(providers.map(function (provider) {
            return {
                key: provider.type,
                title: providerTitles[provider.type] || provider.tabTitle || provider.title,
                icon: provider.type === "moverequests"
                    ? "⇄"
                    : provider.type === "mycommands"
                        ? ">_"
                        : "▶"
            };
        }));

        shell.nav(
            shell.state.page.primary,
            items,
            selectedProvider || "overview",
            function (item) {
                selectedProvider = item.key === "overview" ? "" : item.key;
                selectedStatus = "";
                shell.render();
            }
        );
    }

    function renderStatusNavigation(shell) {
        shell.state.page.secondary.innerHTML = "";

        if (!selectedProvider) return;

        window.SharedStatusNav.mount(shell.state.page.secondary, {
            selected: selectedStatus,
            onSelect: function (status) {
                selectedStatus = status;
                shell.render();
            }
        });
    }

    function renderRequests(shell) {
        var host = shell.state.page.details;
        host.innerHTML = "";

        if (!requests.length) {
            host.appendChild(shell.card(
                "No requests",
                "No requests match the selected provider and status."
            ));
            return;
        }

        requests.forEach(function (request) {
            var card = shell.card(
                request.title || request.type,
                (request.requester && request.requester.name || "") +
                    " · " +
                    request.status
            );

            card.appendChild(shell.element(
                "div",
                "mc-shared-muted",
                new Date(request.createdAt).toLocaleString()
            ));

            if (request.summary) {
                card.appendChild(shell.element(
                    "div",
                    "mc-shared-muted",
                    request.summary
                ));
            }

            if (request.canDecide) {
                var approve = shell.element(
                    "button",
                    "btn btn-primary btn-sm",
                    "Approve"
                );
                approve.type = "button";
                approve.onclick = function () {
                    shell.post("decide", {
                        id: request.id,
                        approved: true,
                        note: ""
                    }).then(shell.render);
                };

                var reject = shell.element(
                    "button",
                    "btn btn-secondary btn-sm",
                    "Reject"
                );
                reject.type = "button";
                reject.onclick = function () {
                    shell.post("decide", {
                        id: request.id,
                        approved: false,
                        note: ""
                    }).then(shell.render);
                };

                card.appendChild(approve);
                card.appendChild(reject);
            }

            host.appendChild(card);
        });
    }

    function renderOverview(shell) {
        shell.state.page.secondary.innerHTML = "";

        return shell.api("overview").then(function (result) {
            var byType = Object.create(null);

            (result.cards || []).forEach(function (card) {
                byType[card.type] = card;
            });

            shell.state.page.details.innerHTML = "";

            providers.forEach(function (provider) {
                var card = byType[provider.type] || {
                    title: providerTitles[provider.type] || provider.title,
                    description: provider.description || "",
                    pending: 0,
                    total: 0
                };

                shell.state.page.details.appendChild(shell.card(
                    providerTitles[provider.type] || card.title,
                    (card.description || "") +
                        " · Pending: " +
                        Number(card.pending || 0) +
                        " · Total: " +
                        Number(card.total || 0)
                ));
            });
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
            shell.state.page.layout.root.classList.remove("mc-approval-layout");

            return shell.api("providers").then(function (result) {
                providers = orderedProviders(result.providers || []);
                renderPrimaryNavigation(shell);
                renderStatusNavigation(shell);

                if (!selectedProvider) {
                    return renderOverview(shell);
                }

                return shell.api("requests", {
                    type: selectedProvider,
                    status: selectedStatus,
                    q: shell.state.search,
                    page: 1,
                    perPage: 100
                }).then(function (requestResult) {
                    requests = requestResult.rows || [];
                    renderRequests(shell);
                });
            });
        }
    });

    window.MyCompanyModules.approvalcenter = module;
}());
