(function () {
    "use strict";

    var tree = null;
    var mode = "scripts";
    var status = "";
    var treeState = { selectedRoot: "", selectedScript: "", expanded: {} };
    var outputs = Object.create(null);

    function text(value) {
        if (value == null) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value, null, 2); }
        catch (error) { return String(value); }
    }

    function placeholder(shell) {
        shell.state.page.details.innerHTML = "";
        shell.state.page.details.appendChild(shell.card(
            "Output",
            "Select a script to see its result."
        ));
    }

    function output(shell, script, title, value, error) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(
            title || script.label || script.name,
            script.description || script.path
        );
        if (error) card.classList.add("mc-shared-error");
        card.appendChild(shell.element(
            "pre",
            "mc-shared-output",
            text(value) || "No output."
        ));
        host.appendChild(card);
    }

    function submit(shell, script, button) {
        button.disabled = true;
        output(shell, script, "Executing", "Submitting script...");
        shell.post("request", {
            scriptPath: script.path,
            label: script.label || script.name,
            description: script.description || "",
            approvalLevels: script.approvalLevels || [],
            note: ""
        }).then(function (result) {
            var request = result.request || {};
            var message = request.result && request.result.message ||
                (request.status === "pending"
                    ? "Waiting for approval."
                    : request.status === "executing"
                        ? "Executing..."
                        : request.status || "Request submitted.");
            outputs[script.path] = text(message);
            output(
                shell,
                script,
                request.status === "pending" ? "Waiting for approval" : "Result",
                outputs[script.path]
            );
        }).catch(function (error) {
            outputs[script.path] = error.message || String(error);
            output(shell, script, "Error", outputs[script.path], true);
        }).then(function () {
            button.disabled = false;
        });
    }

    function scriptView(shell, summary) {
        shell.api("script", { path: summary.path }).then(function (result) {
            var script = result.script;
            var host = shell.state.page.details;
            host.innerHTML = "";
            var card = shell.card(
                script.label || script.name,
                script.description || script.path
            );
            var run = shell.element(
                "button",
                "btn btn-primary",
                script.requiresApproval ? "Request" : "Run"
            );
            run.type = "button";
            run.onclick = function () {
                submit(shell, script, run);
            };
            card.appendChild(run);
            card.appendChild(shell.element(
                "pre",
                "mc-shared-output",
                outputs[script.path] || "Select Run or Request to see the result."
            ));
            host.appendChild(card);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function primary(shell, treeHost) {
        window.SharedCatalogView.mount({
            primaryContainer: shell.state.page.primary,
            treeContainer: treeHost,
            tree: tree,
            state: treeState,
            search: shell.state.search,
            resultsActive: mode === "results",
            onResults: function () {
                mode = "results";
                treeState.selectedScript = "";
                shell.render();
            },
            onRootSelect: function () {
                mode = "scripts";
                treeState.selectedScript = "";
                window.setTimeout(shell.render, 0);
            },
            onScript: function (script) {
                mode = "scripts";
                scriptView(shell, script);
            }
        });
    }

    function resultsView(shell) {
        primary(shell, document.createElement("div"));
        window.SharedResultsView.mountStatus(shell.state.page.secondary, {
            selected: status,
            onSelect: function (value) {
                status = value;
                shell.render();
            }
        });
        return shell.api("results", {
            status: status,
            q: shell.state.search,
            page: 1,
            perPage: 200
        }).then(function (result) {
            window.SharedResultsView.mountTable(shell.state.page.details, {
                title: "Script results",
                kind: "scripts",
                rows: result.rows || [],
                emptyText: "No script results match the selected status."
            });
        });
    }

    function scriptsView(shell) {
        primary(shell, shell.state.page.secondary);
        if (!treeState.selectedScript) {
            placeholder(shell);
            return;
        }
        var selected = window.SharedDirectoryTree.find(tree, treeState.selectedScript);
        if (selected) scriptView(shell, selected);
        else placeholder(shell);
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts",
        title: "My Scripts",
        menuTitle: "My Scripts",
        order: 160,
        preset: "myscripts",
        buttons: {
            search: { side: "left", order: 10 },
            collapse: { side: "left", order: 20 },
            link: { side: "left", order: 30 },
            favorites: false,
            manage: false,
            refresh: false,
            clear: false,
            settings: false
        },
        tabs: [],
        defaultTab: "scripts",
        render: function (shell) {
            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                return mode === "results"
                    ? resultsView(shell)
                    : scriptsView(shell);
            });
        }
    });

    window.MyCompanyModules.myscripts = module;
}());
