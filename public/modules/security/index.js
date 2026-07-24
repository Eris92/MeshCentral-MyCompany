(function () {
    "use strict";
    var active = "incidents";
    var module = window.SirkPlatformModuleShell.create({
        key: "defendertools",
        title: "Defender XDR",
        menuTitle: "Defender",
        order: 140,
        preset: "standard",
        tabs: [
            { key: "incidents", title: "Incidents" },
            { key: "email", title: "Email Explorer" },
            { key: "trusted", title: "Tenant Allow/Block" },
            { key: "hunting", title: "Advanced Hunting" },
            { key: "settings", title: "Settings" }
        ],
        defaultTab: "incidents",
        render: function (shell) {
            active = shell.state.tab;
            if (active === "settings") return shell.api("settings").then(function (result) { shell.json(shell.state.page.details, result); });
            shell.nav(shell.state.page.primary, [
                { key: "incidents", title: "Incidents", icon: "!" },
                { key: "email", title: "Email Explorer", icon: "✉" },
                { key: "trusted", title: "Tenant Allow/Block", icon: "✓" },
                { key: "hunting", title: "Advanced Hunting", icon: "⌕" }
            ], active, function (item) { shell.state.tab = item.key; shell.state.page.tabs.select(item.key, true); });
            shell.state.page.secondary.appendChild(shell.card(active, "Microsoft Defender XDR"));
            if (active === "incidents") {
                return shell.api("incidents").then(function (result) {
                    shell.state.page.details.innerHTML = "";
                    (result.incidents || []).forEach(function (incident) {
                        shell.state.page.details.appendChild(shell.card(incident.displayName || incident.incidentName || ("Incident " + incident.id), (incident.status || "") + " · " + (incident.severity || "")));
                    });
                });
            }
            if (active === "hunting") {
                var form = window.SharedSettings.form("Advanced Hunting");
                var label = shell.element("label", "", "KQL query");
                var input = shell.element("textarea", "", ""); input.rows = 10;
                var run = shell.element("button", "btn btn-primary", "Run"); run.type = "button";
                run.onclick = function () { shell.post("hunt", { query: input.value }).then(function (result) { shell.json(shell.state.page.details, result.result); }).catch(function (error) { shell.error(shell.state.page.details, error); }); };
                label.appendChild(input); form.appendChild(label); form.appendChild(run); shell.state.page.details.appendChild(form); return;
            }
            return shell.api(active).then(function (result) { shell.json(shell.state.page.details, result); });
        }
    });
    window.SirkPlatformModules.defendertools = module;
}());
