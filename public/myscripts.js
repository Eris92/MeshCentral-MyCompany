(function () {
    "use strict";

    var tree = null;
    var treeState = {
        selectedRoot: "",
        selectedScript: "",
        expanded: {}
    };
    var outputByPath = Object.create(null);

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
            "Select a script to see its result."
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

    function submit(shell, script, button) {
        button.disabled = true;
        showOutput(shell, script, "Executing", "Submitting script...");

        shell.post("request", {
            scriptPath: script.path,
            label: script.label || script.name,
            description: script.description || "",
            approvalLevels: script.approvalLevels || [],
            note: ""
        }).then(function (result) {
            var request = result.request || {};
            var message = request.result && request.result.message;
            if (!message) {
                message = request.status === "pending"
                    ? "Waiting for approval."
                    : request.status === "executing"
                        ? "Executing..."
                        : request.status || "Request submitted.";
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
                outputByPath[script.path] || "Select Run or Request to see the result."
            ));
            host.appendChild(card);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function renderResults(shell) {
        return shell.api("results", {
            q: shell.state.search,
            page: 1,
            perPage: 100
        }).then(function (result) {
            var host = shell.state.page.details;
            host.innerHTML = "";
            var rows = result.rows || [];
            if (!rows.length) {
                host.appendChild(shell.card("Results", "No script requests or results."));
                return;
            }
            rows.forEach(function (request) {
                var message = request.result && request.result.message ||
                    (request.status === "pending" ? "Waiting for approval." : request.status || "");
                var card = shell.card(
                    request.title || "Script",
                    (request.requester && request.requester.name || "") + " · " + request.status
                );
                card.appendChild(shell.element(
                    "pre",
                    "mc-shared-output",
                    outputText(message)
                ));
                host.appendChild(card);
            });
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts",
        title: "My Scripts",
        menuTitle: "My Scripts",
        order: 160,
        preset: "myscripts",
        buttons: {
            settings: false
        },
        tabs: [
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

    window.MyCompanyModules.myscripts = module;
}());
