(function () {
    "use strict";
    var plugin = window.MyCommands;
    var core = window.MeshPluginCore;
    if (!plugin || !core || plugin.runtimeFixesInstalled) return;
    plugin.runtimeFixesInstalled = true;

    function encodeVars(value) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(value || {})))); } catch (error) { return ""; } }
    function valuesFromControls(root) {
        var values = {}, missing = [];
        Array.prototype.forEach.call((root || document).querySelectorAll("[data-mycommands-variable]"), function (control) {
            var name = control.getAttribute("data-mycommands-variable"), value = control.value;
            values[name] = value;
            if (control.getAttribute("data-required") === "1" && !String(value || "").trim()) missing.push(name);
        });
        return { values: values, missing: missing };
    }
    function selectedLink(values, nodes) {
        var selected = plugin.state.selected && plugin.state.selected.item, kind = plugin.state.selected && plugin.state.selected.kind;
        if (!selected) return "";
        var url = new URL(location.href);
        url.searchParams.set("viewmode", String(plugin.state.config && plugin.state.config.viewMode || 102));
        if (kind === "script") { url.searchParams.set("commandType", "script"); url.searchParams.set("script", selected.path); url.searchParams.delete("command"); }
        else { url.searchParams.set("commandType", "preset"); url.searchParams.set("command", selected.id); url.searchParams.delete("script"); }
        if (values && Object.keys(values).length) url.searchParams.set("vars", encodeVars(values)); else url.searchParams.delete("vars");
        if (nodes && nodes.length) url.searchParams.set("nodes", nodes.join(",")); else url.searchParams.delete("nodes");
        return url.href;
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        var field = document.createElement("textarea"); field.value = text; field.style.position = "fixed"; field.style.opacity = "0"; document.body.appendChild(field); field.select(); try { document.execCommand("copy"); } finally { field.remove(); } return Promise.resolve();
    }
    function variableControl(variable, index, prefix) {
        var group = document.createElement("div"); group.className = "mycommands-multi-variable";
        var label = document.createElement("label"); label.htmlFor = prefix + index; label.textContent = variable.label + (variable.required ? " *" : ""); group.appendChild(label);
        var control;
        if (variable.control === "select" || variable.control === "switch") {
            control = document.createElement("select"); control.className = "form-select";
            var options = variable.control === "switch" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : (variable.options || []).map(function (item) { return typeof item === "object" ? item : { value: item, label: item }; });
            options.forEach(function (option) { var item = document.createElement("option"); item.value = option.value; item.textContent = option.label || option.value; control.appendChild(item); });
        } else { control = document.createElement("input"); control.type = "text"; control.className = "form-control"; }
        control.id = prefix + index; control.value = variable.defaultValue || ""; control.setAttribute("data-mycommands-variable", variable.name); control.setAttribute("data-required", variable.required ? "1" : "0"); group.appendChild(control); return group;
    }

    var originalExecuteMany = plugin.executeMany;
    plugin.executeMany = function (request, nodes) { plugin.state.table = null; plugin.state.multiResult = null; return originalExecuteMany.call(plugin, request, nodes); };

    plugin.openMultiHostDialog = function () {
        var selected = plugin.state.selected && plugin.state.selected.item, kind = plugin.state.selected && plugin.state.selected.kind;
        if (!selected || kind !== "script" || !selected.path) { plugin.setStatus("Select a script first.", true); return; }
        core.apiRequest(window.MyCompanyAssetUrl("commands", "script-metadata") + "&scriptPath=" + encodeURIComponent(selected.path)).then(function (response) {
            if (!response.metadata || response.metadata.multiHost !== true) throw new Error("This script is not enabled for multiple hosts. Use Edit and enable MultiHost.");
            var wrapper = document.createElement("div"); wrapper.id = "MyCommandsMultiDialog";
            var note = document.createElement("p"); note.textContent = "Enter Mesh node IDs, one per line. Configure variables once; the same values are used for every selected host."; wrapper.appendChild(note);
            var label = document.createElement("label"); label.htmlFor = "MyCommandsMultiNodes"; label.textContent = "Hosts"; wrapper.appendChild(label);
            var nodes = document.createElement("textarea"); nodes.id = "MyCommandsMultiNodes"; nodes.className = "form-control"; nodes.rows = 8; nodes.value = plugin.state.nodeId || ""; wrapper.appendChild(nodes);
            var variables = document.createElement("div"); variables.id = "MyCommandsMultiVariables"; (selected.variables || []).forEach(function (variable, index) { variables.appendChild(variableControl(variable, index, "MyCommandsMultiVar-")); }); wrapper.appendChild(variables);
            var status = document.createElement("div"); status.id = "MyCommandsMultiStatus"; status.className = "small text-muted mt-2"; wrapper.appendChild(status);
            var submit = function () {
                var targets = String(nodes.value || "").split(/[\r\n,;]+/).map(function (item) { return item.trim(); }).filter(Boolean), data = valuesFromControls(variables);
                if (!targets.length) { status.textContent = "Enter at least one host."; return false; }
                if (data.missing.length) { status.textContent = "Complete required variables: " + data.missing.join(", "); return false; }
                plugin.closeDialog(); plugin.executeMany({ pluginaction: "runScript", scriptPath: selected.path, variableValues: data.values }, targets); return false;
            };
            plugin.showDialog("Run script on multiple hosts", wrapper.outerHTML, submit);
        }).catch(function (error) { plugin.setStatus(error.message, true); });
    };

    var originalRenderVariableForm = plugin.renderVariableForm;
    plugin.renderVariableForm = function () {
        originalRenderVariableForm.call(plugin);
        var form = document.getElementById("MyCommandsVariableForm"); if (!form || form.querySelector("[data-mycommands-copy-link]")) return;
        Array.prototype.forEach.call(form.querySelectorAll("[id^='MyCommandsVariable-']"), function (control, index) {
            var selected = plugin.state.selected && plugin.state.selected.item, variable = selected && selected.variables && selected.variables[index];
            if (!variable) return; control.setAttribute("data-mycommands-variable", variable.name); control.setAttribute("data-required", variable.required ? "1" : "0");
        });
        var copy = document.createElement("button"); copy.type = "button"; copy.className = "btn btn-secondary btn-sm"; copy.textContent = "Copy link with variables"; copy.setAttribute("data-mycommands-copy-link", "1");
        copy.addEventListener("click", function () { var data = valuesFromControls(form); if (data.missing.length) { plugin.setStatus("Complete required variables before copying the link.", true); return; } copyText(selectedLink(data.values, [plugin.state.nodeId].filter(Boolean))).then(function () { plugin.setStatus("Bookmarkable link with variables copied.", false); }); });
        form.appendChild(copy);
    };
}());
