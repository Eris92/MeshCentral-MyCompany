(function () {
    "use strict";

    if (!window.SharedScriptTools || window.SharedScriptTools.__confirmExecutionFormInstalled) return;
    window.SharedScriptTools.__confirmExecutionFormInstalled = true;

    var originalCreate = window.SharedScriptTools.create;

    function addCheckbox(host, state) {
        var card = host && host.querySelector(".mc-script-definition-card");
        if (!card || card.querySelector("[data-confirm-execution-field]")) return false;

        var sections = card.querySelectorAll(".mc-definition-section");
        var execution = null;
        Array.prototype.some.call(sections, function (section) {
            var title = section.querySelector("h4");
            if (title && String(title.textContent || "").trim() === "Execution") {
                execution = section;
                return true;
            }
            return false;
        });
        if (!execution) return false;

        var label = document.createElement("label");
        label.className = "mc-definition-check";
        label.setAttribute("data-confirm-execution-field", "1");
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.value === true;
        checkbox.onchange = function () { state.value = checkbox.checked; };
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" Confirm execution before running"));
        execution.appendChild(label);

        var note = document.createElement("div");
        note.className = "mc-shared-muted";
        note.textContent = "When enabled, the user must explicitly confirm execution. The server rejects unconfirmed requests.";
        execution.appendChild(note);
        return true;
    }

    window.SharedScriptTools.create = function (options) {
        var tool = originalCreate.call(window.SharedScriptTools, options);
        var originalOpen = tool.openDefinitionEditor;
        if (typeof originalOpen !== "function") return tool;

        tool.openDefinitionEditor = function (shell, script, onSaved) {
            var state = { value: script && script.confirmExecution === true };
            var proxy = Object.create(shell);

            proxy.api = function (asset, parameters) {
                return shell.api(asset, parameters).then(function (response) {
                    if (asset === "definition" && response && response.definition) {
                        state.value = response.definition.confirmExecution === true;
                    }
                    return response;
                });
            };

            proxy.post = function (asset, payload) {
                if (asset === "definition" && payload && payload.definition) {
                    payload.definition.confirmExecution = state.value === true;
                }
                return shell.post(asset, payload);
            };

            var host = shell.state && shell.state.page && shell.state.page.details;
            var observer = null;
            if (host) {
                observer = new MutationObserver(function () {
                    if (addCheckbox(host, state) && observer) observer.disconnect();
                });
                observer.observe(host, { childList: true, subtree: true });
            }

            originalOpen.call(tool, proxy, script, function (result) {
                if (observer) observer.disconnect();
                if (typeof onSaved === "function") onSaved(result);
            });

            window.setTimeout(function () {
                if (addCheckbox(host, state) && observer) observer.disconnect();
            }, 0);
        };

        return tool;
    };
}());
