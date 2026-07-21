(function () {
    "use strict";
    var selectedProvider = "";
    var selectedStatus = "";
    var providers = [];
    var requests = [];

    function renderRequests(shell) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        if (!requests.length) {
            host.appendChild(shell.card("No requests", "No requests match the selected provider and status."));
            return;
        }
        requests.forEach(function (request) {
            var card = shell.card(request.title || request.type, (request.requester && request.requester.name || "") + " · " + request.status);
            var meta = shell.element("div", "mc-shared-muted", new Date(request.createdAt).toLocaleString());
            card.appendChild(meta);
            if (request.canDecide) {
                var approve = shell.element("button", "btn btn-primary btn-sm", "Approve");
                approve.type = "button";
                approve.onclick = function () { shell.post("decide", { id: request.id, approved: true, note: "" }).then(shell.render); };
                var reject = shell.element("button", "btn btn-secondary btn-sm", "Reject");
                reject.type = "button";
                reject.onclick = function () { shell.post("decide", { id: request.id, approved: false, note: "" }).then(shell.render); };
                card.appendChild(approve); card.appendChild(reject);
            }
            host.appendChild(card);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "approvalcenter",
        title: "Approval Center",
        menuTitle: "Approval Center",
        order: 110,
        preset: "approvalcenter",
        buttons: { favorites: false },
        tabs: [
            { key: "requests", title: "Requests" },
            { key: "overview", title: "Overview" },
            { key: "settings", title: "Settings" }
        ],
        defaultTab: "requests",
        render: function (shell) {
            if (shell.state.tab === "overview") {
                return shell.api("overview").then(function (result) {
                    result.cards.forEach(function (card) { shell.state.page.details.appendChild(shell.card(card.title, card.description + " · Pending: " + card.pending + " · Total: " + card.total)); });
                });
            }
            if (shell.state.tab === "settings") {
                return shell.api("settings").then(function (result) { shell.json(shell.state.page.details, result.settings); });
            }
            return shell.api("providers").then(function (result) {
                providers = result.providers.filter(function (item) { return item.enabled && item.showTab; });
                if (!selectedProvider && providers.length) selectedProvider = providers[0].type;
                shell.nav(shell.state.page.primary, providers.map(function (item) { return { key: item.type, title: item.tabTitle || item.title, icon: "▣" }; }), selectedProvider, function (item) { selectedProvider = item.key; selectedStatus = ""; shell.render(); });
                window.SharedStatusNav.mount(shell.state.page.secondary, {
                    selected: selectedStatus,
                    onSelect: function (status) { selectedStatus = status; shell.render(); }
                });
                return shell.api("requests", { type: selectedProvider, status: selectedStatus, q: shell.state.search, page: 1, perPage: 100 });
            }).then(function (result) {
                requests = result.rows || [];
                renderRequests(shell);
            });
        }
    });
    window.MyCompanyModules.approvalcenter = module;
}());
