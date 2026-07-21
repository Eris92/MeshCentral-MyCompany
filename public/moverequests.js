(function () {
    "use strict";
    var selectedStatus = "";
    function renderRows(shell) {
        return shell.api("requests", { status: selectedStatus, q: shell.state.search, page: 1, perPage: 100 }).then(function (result) {
            shell.state.page.details.innerHTML = "";
            (result.rows || []).forEach(function (request) {
                shell.state.page.details.appendChild(shell.card(request.title || "Move request", (request.requester && request.requester.name || "") + " · " + request.status));
            });
        });
    }
    var module = window.MyCompanyModuleShell.create({
        key: "moverequests",
        title: "Move Requests",
        menuTitle: "Move Requests",
        order: 120,
        preset: "standard",
        tabs: [{ key: "requests", title: "Requests" }, { key: "settings", title: "Settings" }],
        defaultTab: "requests",
        render: function (shell) {
            if (shell.state.tab === "settings") return shell.api("settings").then(function (result) { shell.json(shell.state.page.details, result); });
            shell.nav(shell.state.page.primary, [{ key: "moverequests", title: "Move Requests", icon: "⇄" }], "moverequests", function () {});
            window.SharedStatusNav.mount(shell.state.page.secondary, { selected: selectedStatus, onSelect: function (value) { selectedStatus = value; shell.render(); } });
            return renderRows(shell);
        }
    });
    window.MyCompanyModules.moverequests = module;
}());
