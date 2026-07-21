(function () {
    "use strict";
    var tree = null;
    var selectedRoot = "";
    function roots() { return (tree && tree.children || []).filter(function (item) { return item.type === "directory"; }); }
    function find(node, path) {
        if (!node) return null;
        if (String(node.path || "") === String(path || "")) return node;
        var children = node.children || [];
        for (var i = 0; i < children.length; i++) { var result = find(children[i], path); if (result) return result; }
        return null;
    }
    function renderResults(shell) {
        return shell.api("results", { q: shell.state.search, limit: 200 }).then(function (result) {
            shell.state.page.details.innerHTML = "";
            (result.rows || []).forEach(function (row) {
                var card = shell.card(row.command || "Command", (row.nodeName || row.nodeId || "") + " · " + (row.status || ""));
                if (row.output) { var pre = shell.element("pre", "mc-shared-output", row.output); card.appendChild(pre); }
                shell.state.page.details.appendChild(card);
            });
        });
    }
    function currentNodeId(shell) {
        return shell.state.nodeId || window.MyCompanyRuntime.state.nodeId || window.selectedNode || "";
    }
    function openCustom(shell) {
        var nodeId = currentNodeId(shell);
        var command = window.prompt("Command to run");
        if (!command) return;
        shell.post("execute", { nodeId: nodeId, label: "Custom command", command: command, type: 2, approvalLevels: [] })
            .then(function () { shell.state.tab = "results"; shell.state.page.tabs.select("results", true); })
            .catch(function (error) { shell.error(shell.state.page.details, error); });
    }
    var module = window.MyCompanyModuleShell.create({
        key: "mycommands",
        title: "My Commands",
        menuTitle: "My Commands",
        order: 150,
        preset: "mycommands",
        deviceTab: {
            title: "Commands",
            pageId: "mycompany-mycommands-device-page",
            topTabId: "MainDevMyCompany-Commands"
        },
        customButtons: [
            { key: "custom", title: "Custom command", icon: ">_", side: "right", order: 50, onClick: function () { openCustom(module.api); } },
            { key: "multiHost", title: "Run on multiple hosts", icon: "▦", side: "right", order: 60, onClick: function () { window.alert("Select multiple devices and submit the same script from this view."); } }
        ],
        tabs: [
            { key: "commands", title: "Commands" },
            { key: "scripts", title: "Scripts" },
            { key: "results", title: "Results" },
            { key: "settings", title: "Settings" }
        ],
        defaultTab: "scripts",
        render: function (shell) {
            if (shell.state.tab === "results") return renderResults(shell);
            if (shell.state.tab === "settings") return shell.api("settings").then(function (result) { shell.json(shell.state.page.details, result); });
            if (shell.state.tab === "commands") { shell.state.page.details.appendChild(shell.card("Commands", "Use Custom command or select a script. Command actions are placed on the right side of the shared toolbar.")); return; }
            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                var list = roots(); if (!selectedRoot && list.length) selectedRoot = list[0].path;
                shell.nav(shell.state.page.primary, list.map(function (folder) { return { key: folder.path, title: folder.name, icon: "▰" }; }), selectedRoot, function (item) { selectedRoot = item.key; shell.render(); });
                var folder = find(tree, selectedRoot) || tree;
                var children = folder.children || [];
                if (shell.state.search) children = window.MyCompanyCore.flattenScripts(folder).filter(function (item) { return [item.label, item.name, item.description].join(" ").toLowerCase().indexOf(shell.state.search.toLowerCase()) >= 0; });
                shell.nav(shell.state.page.secondary, children.map(function (item) { return { key: item.path, title: item.label || item.name, icon: item.type === "directory" ? "▰" : "▶", source: item }; }), "", function (item) {
                    if (item.source.type === "directory") { selectedRoot = item.source.path; shell.render(); return; }
                    shell.api("script", { path: item.source.path }).then(function (result) {
                        shell.state.page.details.innerHTML = "";
                        shell.state.page.details.appendChild(shell.card(result.script.label, result.script.description || result.script.path));
                        var run = shell.element("button", "btn btn-primary", "Run"); run.type = "button";
                        run.onclick = function () {
                            shell.post("execute", { nodeId: currentNodeId(shell), scriptPath: result.script.path, label: result.script.label, approvalLevels: result.script.approvalLevels || [] })
                                .then(function () { shell.state.tab = "results"; shell.state.page.tabs.select("results", true); })
                                .catch(function (error) { shell.error(shell.state.page.details, error); });
                        };
                        shell.state.page.details.appendChild(run);
                    });
                });
                shell.state.page.details.appendChild(shell.card(folder.name || "Scripts", folder.path || result.scriptsRoot || ""));
            });
        }
    });
    window.MyCompanyModules.mycommands = module;
}());
