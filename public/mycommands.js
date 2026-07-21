(function () {
    "use strict";

    var tree = null;
    var treeState = {
        selectedRoot: "",
        selectedScript: "",
        expanded: {}
    };
    var outputByPath = Object.create(null);

    function currentNodeId(shell) {
        return shell.state.nodeId ||
            window.MyCompanyRuntime.state.nodeId ||
            window.selectedNode ||
            "";
    }

    function outputText(value) {
        if (value == null) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value, null, 2); }
        catch (error) { return String(value); }
    }

    function showPlaceholder(shell) {
        shell.state.page.details.innerHTML = "";
        shell.state.page.details.appendChild(shell.card(
            "Output",
            "Select a command or script to see its result."
        ));
    }

    function showOutput(shell, script, title, value, className) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(
            title || script.label || script.name,
            script.description || script.path
        );
        if (className) card.classList.add(className);
        card.appendChild(shell.element(
            "pre",
            "mc-shared-output",
            outputText(value) || "No output."
        ));
        host.appendChild(card);
    }

    function execute(shell, script, button) {
        button.disabled = true;
        showOutput(shell, script, "Executing", "Submitting command...");

        shell.post("execute", {
            nodeId: currentNodeId(shell),
            scriptPath: script.path,
            label: script.label || script.name,
            approvalLevels: script.approvalLevels || []
        }).then(function (result) {
            var request = result.request || {};
            var message = request.result && request.result.message;
            if (!message) {
                message = request.status === "pending"
                    ? "Waiting for approval."
                    : request.status === "executing"
                        ? "Executing..."
                        : request.status || "Command submitted.";
            }
            outputByPath[script.path] = outputText(message);
            showOutput(
                shell,
                script,
                request.status === "pending" ? "Waiting for approval" : "Result",
                outputByPath[script.path]
            );
        }).catch(function (error) {
            outputByPath[script.path] = error.message || String(error);
            showOutput(shell, script, "Error", outputByPath[script.path], "mc-shared-error");
        }).then(function () {
            button.disabled = false;
        });
    }

    function renderScript(shell, scriptSummary) {
        shell.api("script", { path: scriptSummary.path }).then(function (result) {
            var script = result.script;
            var host = shell.state.page.details;
            host.innerHTML = "";
            var card = shell.card(
                script.label || script.name,
                script.description || script.path
            );
            var run = shell.element("button", "btn btn-primary", "Run");
            run.type = "button";
            run.onclick = function () {
                execute(shell, script, run);
            };
            card.appendChild(run);
            card.appendChild(shell.element(
                "pre",
                "mc-shared-output",
                outputByPath[script.path] || "Select Run to see the result."
            ));
            host.appendChild(card);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function renderResults(shell) {
        return shell.api("results", {
            q: shell.state.search,
            limit: 200
        }).then(function (result) {
            var host = shell.state.page.details;
            host.innerHTML = "";
            var rows = result.rows || [];
            if (!rows.length) {
                host.appendChild(shell.card("Results", "No command results."));
                return;
            }
            rows.forEach(function (row) {
                var card = shell.card(
                    row.command || "Command",
                    (row.nodeName || row.nodeId || "") + " · " + (row.status || "")
                );
                card.appendChild(shell.element(
                    "pre",
                    "mc-shared-output",
                    row.output || row.status || ""
                ));
                host.appendChild(card);
            });
        });
    }

    function openCustom(shell) {
        var command = window.prompt("Command to run");
        if (!command) return;
        shell.post("execute", {
            nodeId: currentNodeId(shell),
            label: "Custom command",
            command: command,
            type: 2,
            approvalLevels: []
        }).then(function (result) {
            var request = result.request || {};
            showOutput(
                shell,
                { label: "Custom command", description: command },
                request.status === "pending" ? "Waiting for approval" : "Result",
                request.result && request.result.message || request.status || "Command submitted."
            );
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "mycommands",
        title: "My Commands",
        menuTitle: "My Commands",
        showInMenu: false,
        order: 150,
        preset: "mycommands",
        deviceTab: {
            title: "Commands",
            pageId: "mycompany-mycommands-device-page",
            topTabId: "MainDevMyCompany-Commands"
        },
        customButtons: [
            {
                key: "custom",
                title: "Custom command",
                icon: ">_",
                side: "right",
                order: 50,
                onClick: function () { openCustom(module.api); }
            },
            {
                key: "multiHost",
                title: "Run on multiple hosts",
                icon: "▦",
                side: "right",
                order: 60,
                onClick: function () {
                    window.alert("Select multiple devices and submit the same script from this view.");
                }
            }
        ],
        tabs: [
            { key: "commands", title: "Commands" },
            { key: "scripts", title: "Scripts" },
            { key: "results", title: "Results" }
        ],
        defaultTab: "scripts",
        render: function (shell) {
            if (shell.state.tab === "results") {
                shell.state.page.primary.innerHTML = "";
                shell.state.page.secondary.innerHTML = "";
                return renderResults(shell);
            }
            if (shell.state.tab === "commands") {
                shell.state.page.primary.innerHTML = "";
                shell.state.page.secondary.innerHTML = "";
                showPlaceholder(shell);
                return;
            }

            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                window.SharedDirectoryTree.mount({
                    rootsContainer: shell.state.page.primary,
                    treeContainer: shell.state.page.secondary,
                    tree: tree,
                    state: treeState,
                    search: shell.state.search,
                    onRootSelect: function () {
                        treeState.selectedScript = "";
                        showPlaceholder(shell);
                    },
                    onScript: function (script) {
                        renderScript(shell, script);
                    }
                });

                if (treeState.selectedScript) {
                    var selected = window.SharedDirectoryTree.find(tree, treeState.selectedScript);
                    if (selected) renderScript(shell, selected);
                    else showPlaceholder(shell);
                } else {
                    showPlaceholder(shell);
                }
            });
        }
    });

    window.MyCompanyModules.mycommands = module;
}());
