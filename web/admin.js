(function () {
    "use strict";
    var root = document.getElementById("mycompany-admin");
    if (!root) return;
    var data = window.MyCompanyAdminData || {};
    var content = document.getElementById("mycompany-admin-content");
    var active = "overview";

    function element(tag, className, text) {
        var value = document.createElement(tag);
        if (className) value.className = className;
        if (text != null) value.textContent = text;
        return value;
    }

    function card(title, description) {
        var value = element("div", "mc-admin-card");
        value.appendChild(element("h3", "", title));
        if (description) value.appendChild(element("div", "", description));
        return value;
    }

    function field(label, value, type) {
        var wrapper = element("label", "mc-admin-field");
        wrapper.appendChild(element("span", "", label));
        var input = element(type === "textarea" ? "textarea" : "input");
        if (type !== "textarea") input.type = type || "text";
        input.value = value == null ? "" : value;
        wrapper.appendChild(input);
        return { root: wrapper, input: input };
    }

    function post(values) {
        var body = new URLSearchParams();
        Object.keys(values).forEach(function (key) {
            body.set(key, typeof values[key] === "object" ? JSON.stringify(values[key]) : String(values[key]));
        });
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", root.getAttribute("data-plugin") || "MyCompany");
        url.searchParams.set("action", "save-settings");
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(function (response) { return response.json(); }).then(function (result) {
            if (!result.ok) throw new Error(result.error || "Save failed.");
            data = result.snapshot;
            window.MyCompanyAdminData = data;
            return result;
        });
    }

    function overview() {
        var grid = element("div", "mc-admin-grid");
        (data.modules || []).forEach(function (module) {
            var value = card(module.name, module.ready ? "Ready" : (module.error || "Not ready"));
            value.appendChild(element("div", "", "Enabled: " + (module.enabled ? "Yes" : "No")));
            grid.appendChild(value);
        });
        content.appendChild(grid);
    }

    function settings() {
        var form = element("div", "mc-admin-grid");
        var modules = {};
        (data.modules || []).forEach(function (module) {
            var value = card(module.name, "Enable or disable the internal module.");
            var input = element("input"); input.type = "checkbox"; input.checked = module.enabled === true;
            input.setAttribute("data-module", module.key); value.appendChild(input); form.appendChild(value);
        });
        var integrationValues = data.integrations && data.integrations.values || {};
        ["ad", "entra", "jira", "defender", "zabbix"].forEach(function (name) {
            var value = card(name.toUpperCase(), "Shared integration profile");
            var textarea = field("JSON settings", JSON.stringify(integrationValues[name] || {}, null, 2), "textarea");
            textarea.input.rows = 8; textarea.input.setAttribute("data-integration", name); value.appendChild(textarea.root); form.appendChild(value);
        });
        content.appendChild(form);
        var actions = element("div", "mc-admin-actions");
        var save = element("button", "", "Save settings"); save.type = "button";
        var status = element("span", "", ""); status.style.marginLeft = "10px";
        save.onclick = function () {
            root.querySelectorAll("[data-module]").forEach(function (input) { modules[input.getAttribute("data-module")] = input.checked; });
            var integrations = {};
            root.querySelectorAll("[data-integration]").forEach(function (input) {
                try { integrations[input.getAttribute("data-integration")] = JSON.parse(input.value || "{}"); }
                catch (error) { throw new Error("Invalid JSON for " + input.getAttribute("data-integration")); }
            });
            save.disabled = true; status.textContent = "Saving...";
            post({ modules: modules, moduleOptions: data.moduleSettings || {}, integrations: integrations, secrets: {} })
                .then(function () { status.textContent = "Saved"; render(); })
                .catch(function (error) { status.textContent = error.message; status.className = "mc-admin-error"; })
                .finally(function () { save.disabled = false; });
        };
        actions.appendChild(save); actions.appendChild(status); content.appendChild(actions);
    }

    function debug() {
        content.appendChild(element("pre", "mc-admin-debug", JSON.stringify(data, null, 2)));
    }

    function render() {
        content.innerHTML = "";
        root.querySelectorAll("[data-tab]").forEach(function (button) { button.classList.toggle("active", button.getAttribute("data-tab") === active); });
        if (active === "settings") settings();
        else if (active === "debug") debug();
        else overview();
    }

    root.querySelectorAll("[data-tab]").forEach(function (button) {
        button.onclick = function () { active = button.getAttribute("data-tab"); render(); };
    });
    render();
}());
