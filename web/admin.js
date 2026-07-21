(function () {
    "use strict";

    var root = document.getElementById("mycompany-admin");
    if (!root) return;

    var data = window.MyCompanyAdminData || {};
    var content = document.getElementById("mycompany-admin-content");
    var active = "overview";
    var settingsSection = "approvalcenter";
    var draft = null;

    var settingsItems = [
        { key: "approvalcenter", title: "Approval Center" },
        { key: "moverequests", title: "Move Requests" },
        { key: "mycommands", title: "My Commands" },
        { key: "myjira", title: "My Jira" },
        { key: "defendertools", title: "Defender XDR" },
        { key: "myscripts", title: "My Scripts" }
    ];

    function element(tag, className, text) {
        var value = document.createElement(tag);
        if (className) value.className = className;
        if (text != null) value.textContent = text;
        return value;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value == null ? {} : value));
    }

    function ensureObject(parent, key) {
        if (!parent[key] || typeof parent[key] !== "object" || Array.isArray(parent[key])) {
            parent[key] = {};
        }
        return parent[key];
    }

    function moduleRecord(key) {
        return (data.modules || []).find(function (module) {
            return module.key === key;
        }) || {
            key: key,
            name: key,
            enabled: false,
            ready: false
        };
    }

    function resetDraft() {
        var moduleOptions = clone(data.moduleSettings || {});
        var integrationValues = clone(data.integrations && data.integrations.values || {});
        var modules = {};

        (data.modules || []).forEach(function (module) {
            modules[module.key] = module.enabled === true;
        });

        modules.mycommands = true;
        modules.moverequests = true;

        ensureObject(moduleOptions, "approvalcenter");
        ensureObject(moduleOptions.approvalcenter, "providers");
        ensureObject(moduleOptions, "moverequests");
        ensureObject(moduleOptions, "mycommands");
        ensureObject(moduleOptions, "myjira");
        ensureObject(moduleOptions, "defendertools");
        ensureObject(moduleOptions, "myscripts");

        ensureObject(integrationValues, "ad");
        ensureObject(integrationValues, "entra");
        ensureObject(integrationValues, "jira");
        ensureObject(integrationValues, "defender");
        ensureObject(integrationValues, "zabbix");
        ensureObject(integrationValues.defender, "permissions");

        draft = {
            modules: modules,
            moduleOptions: moduleOptions,
            integrations: integrationValues,
            secrets: {}
        };
    }

    function card(title, description) {
        var value = element("section", "mc-admin-card");
        value.appendChild(element("h3", "", title));
        if (description) {
            value.appendChild(element("div", "mc-admin-card-description", description));
        }
        return value;
    }

    function sectionHeader(host, title, description) {
        var header = element("div", "mc-admin-section-header");
        header.appendChild(element("h3", "", title));
        if (description) header.appendChild(element("p", "", description));
        host.appendChild(header);
    }

    function row(host, label, description) {
        var wrapper = element("div", "mc-admin-field");
        var labelElement = element("label", "mc-admin-field-label", label);
        wrapper.appendChild(labelElement);
        if (description) {
            wrapper.appendChild(element("div", "mc-admin-field-description", description));
        }
        host.appendChild(wrapper);
        return wrapper;
    }

    function textField(host, label, value, onChange, options) {
        options = options || {};
        var wrapper = row(host, label, options.description);
        var input = element(options.multiline ? "textarea" : "input", "mc-admin-input");
        if (!options.multiline) input.type = options.type || "text";
        if (options.multiline) input.rows = options.rows || 4;
        if (options.placeholder) input.placeholder = options.placeholder;
        input.value = value == null ? "" : value;
        input.oninput = function () {
            onChange(input.value);
        };
        wrapper.appendChild(input);
        return input;
    }

    function numberField(host, label, value, onChange, min, max, description) {
        var input = textField(host, label, value, function (newValue) {
            onChange(Number(newValue));
        }, {
            type: "number",
            description: description
        });
        if (min != null) input.min = String(min);
        if (max != null) input.max = String(max);
        return input;
    }

    function checkboxField(host, label, checked, onChange, description) {
        var wrapper = element("label", "mc-admin-check");
        var input = element("input");
        input.type = "checkbox";
        input.checked = checked === true;
        input.onchange = function () {
            onChange(input.checked);
        };
        wrapper.appendChild(input);
        var text = element("span", "");
        text.appendChild(element("strong", "", label));
        if (description) text.appendChild(element("small", "", description));
        wrapper.appendChild(text);
        host.appendChild(wrapper);
        return input;
    }

    function selectField(host, label, value, choices, onChange, description) {
        var wrapper = row(host, label, description);
        var select = element("select", "mc-admin-input");
        (choices || []).forEach(function (choice) {
            var option = element("option", "", choice.title);
            option.value = choice.value;
            option.selected = String(choice.value) === String(value);
            select.appendChild(option);
        });
        select.onchange = function () {
            onChange(select.value);
        };
        wrapper.appendChild(select);
        return select;
    }

    function groupField(host, label, selected, onChange, description) {
        var wrapper = row(host, label, description);
        var select = element("select", "mc-admin-input mc-admin-groups");
        select.multiple = true;
        select.size = 7;
        selected = Array.isArray(selected) ? selected.map(String) : [];

        ((data.integrations && data.integrations.groups) || []).forEach(function (group) {
            var option = element("option", "", group.name || group.id);
            option.value = String(group.id);
            option.selected = selected.indexOf(String(group.id)) >= 0;
            select.appendChild(option);
        });

        select.onchange = function () {
            var values = Array.prototype.slice.call(select.options)
                .filter(function (option) { return option.selected; })
                .map(function (option) { return option.value; });
            onChange(values);
        };
        wrapper.appendChild(select);
        return select;
    }

    function pin() {
        return root.getAttribute("data-plugin") || "MyCompany";
    }

    function parseResponse(response) {
        return response.text().then(function (text) {
            var result;
            try {
                result = JSON.parse(text || "{}");
            } catch (error) {
                throw new Error(text || ("HTTP " + response.status));
            }
            if (!response.ok || !result.ok) {
                throw new Error(result.error || ("HTTP " + response.status));
            }
            return result;
        });
    }

    function post(values) {
        var body = new URLSearchParams();
        Object.keys(values).forEach(function (key) {
            body.set(
                key,
                typeof values[key] === "object"
                    ? JSON.stringify(values[key])
                    : String(values[key])
            );
        });
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("action", "save-settings");
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body: body.toString()
        }).then(parseResponse);
    }

    function postModule(moduleName, asset, values) {
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values || {}));
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("module", moduleName);
        url.searchParams.set("asset", asset);
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            body: body.toString()
        }).then(parseResponse);
    }

    function providerSettings(type) {
        var providers = draft.moduleOptions.approvalcenter.providers;
        var value = ensureObject(providers, type);
        if (value.enabled == null) value.enabled = true;
        if (value.showTab == null) value.showTab = true;
        if (value.showOverview == null) value.showOverview = true;
        ensureObject(value, "levels");
        if (!Array.isArray(value.levels[1])) value.levels[1] = [];
        if (!Array.isArray(value.levels[2])) value.levels[2] = [];
        if (!Array.isArray(value.levels[3])) value.levels[3] = [];
        return value;
    }

    function saveAll(button, status) {
        button.disabled = true;
        status.className = "mc-admin-save-status";
        status.textContent = "Saving...";

        draft.modules.mycommands = true;
        draft.modules.moverequests = true;
        draft.moduleOptions.mycommands.showInMenu = false;
        draft.moduleOptions.moverequests.menuEnabled = false;

        var moduleJobs = [
            postModule("approvalcenter", "settings", draft.moduleOptions.approvalcenter),
            postModule("moverequests", "settings", {
                hostButtonEnabled: draft.moduleOptions.moverequests.hostButtonEnabled !== false,
                menuEnabled: false
            }),
            postModule("mycommands", "settings", {
                showInMenu: false,
                showOnDevice: draft.moduleOptions.mycommands.showOnDevice !== false,
                accessGroupIds: draft.moduleOptions.mycommands.accessGroupIds || [],
                maxMultiHostNodes: draft.moduleOptions.mycommands.maxMultiHostNodes || 200,
                multiHostConcurrency: draft.moduleOptions.mycommands.multiHostConcurrency || 8
            }),
            postModule("myscripts", "settings", {
                accessGroupIds: draft.moduleOptions.myscripts.accessGroupIds || []
            })
        ];

        Promise.all(moduleJobs).then(function () {
            return post({
                modules: draft.modules,
                moduleOptions: draft.moduleOptions,
                integrations: draft.integrations,
                secrets: draft.secrets
            });
        }).then(function (result) {
            data = result.snapshot;
            window.MyCompanyAdminData = data;
            resetDraft();
            status.textContent = "Saved";
            render();
        }).catch(function (error) {
            status.className = "mc-admin-save-status mc-admin-error";
            status.textContent = error.message;
        }).then(function () {
            button.disabled = false;
        });
    }

    function renderSaveBar(host) {
        var actions = element("div", "mc-admin-actions");
        var save = element("button", "mc-admin-primary", "Save settings");
        save.type = "button";
        var status = element("span", "mc-admin-save-status", "");
        save.onclick = function () { saveAll(save, status); };
        actions.appendChild(save);
        actions.appendChild(status);
        host.appendChild(actions);
    }

    function overview() {
        var grid = element("div", "mc-admin-grid");
        (data.modules || []).forEach(function (module) {
            var value = card(
                module.name,
                module.ready ? "Ready" : (module.error || "Not ready")
            );
            var badge = element(
                "div",
                module.ready ? "mc-admin-state ready" : "mc-admin-state error",
                module.ready ? "Ready" : "Error"
            );
            value.appendChild(badge);

            if (module.key === "mycommands") {
                value.appendChild(element(
                    "div",
                    "mc-admin-summary-row",
                    "Host tab: " + ((data.moduleSettings.mycommands || {}).showOnDevice !== false ? "Visible" : "Hidden")
                ));
                value.appendChild(element(
                    "div",
                    "mc-admin-summary-row",
                    "Global menu: Disabled"
                ));
            } else if (module.key === "moverequests") {
                value.appendChild(element(
                    "div",
                    "mc-admin-summary-row",
                    "Host button: " + ((data.moduleSettings.moverequests || {}).hostButtonEnabled !== false ? "Visible" : "Hidden")
                ));
                value.appendChild(element(
                    "div",
                    "mc-admin-summary-row",
                    "Global menu: Disabled"
                ));
            } else {
                value.appendChild(element(
                    "div",
                    "mc-admin-summary-row",
                    "Module: " + (module.enabled ? "Enabled" : "Disabled")
                ));
            }
            grid.appendChild(value);
        });
        content.appendChild(grid);
    }

    function renderProvider(host, type, title, description) {
        var provider = providerSettings(type);
        var value = card(title, description);
        checkboxField(value, "Provider enabled", provider.enabled !== false, function (checked) {
            provider.enabled = checked;
        });
        checkboxField(value, "Show in Requests", provider.showTab !== false, function (checked) {
            provider.showTab = checked;
        });
        checkboxField(value, "Show in Overview", provider.showOverview !== false, function (checked) {
            provider.showOverview = checked;
        });
        groupField(value, "Level 1 approvers", provider.levels[1], function (groups) {
            provider.levels[1] = groups;
        });
        groupField(value, "Level 2 approvers", provider.levels[2], function (groups) {
            provider.levels[2] = groups;
        });
        groupField(value, "Level 3 approvers", provider.levels[3], function (groups) {
            provider.levels[3] = groups;
        });
        host.appendChild(value);
    }

    function approvalSettings(host) {
        sectionHeader(
            host,
            "Approval Center",
            "Provider visibility, approval levels and retention are configured here. Move Requests has no separate settings page."
        );
        var general = card("General");
        checkboxField(general, "Enable Approval Center", draft.modules.approvalcenter !== false, function (checked) {
            draft.modules.approvalcenter = checked;
        });
        numberField(
            general,
            "Retention days",
            draft.moduleOptions.approvalcenter.retentionDays || 365,
            function (value) { draft.moduleOptions.approvalcenter.retentionDays = value; },
            1,
            3650
        );
        host.appendChild(general);

        renderProvider(
            host,
            "moverequests",
            "Move Requests",
            "Approval workflow for moving a device between MeshCentral groups."
        );
        renderProvider(
            host,
            "mycommands",
            "My Commands",
            "Approval workflow for scripts and commands that require approval levels."
        );
    }

    function moveRequestsSettings(host) {
        sectionHeader(
            host,
            "Move Requests",
            "The module is available only as a host action and as a provider inside Approval Center."
        );
        var value = card("Host integration");
        checkboxField(
            value,
            "Show Move Request button on hosts",
            draft.moduleOptions.moverequests.hostButtonEnabled !== false,
            function (checked) {
                draft.moduleOptions.moverequests.hostButtonEnabled = checked;
            },
            "Disabling this option hides the button from device pages. Requests already created remain available in Approval Center."
        );
        value.appendChild(element(
            "div",
            "mc-admin-notice",
            "A separate Move Requests menu entry is permanently disabled. Approvers and provider visibility are configured under Approval Center."
        ));
        host.appendChild(value);
    }

    function myCommandsSettings(host) {
        sectionHeader(
            host,
            "My Commands",
            "Commands is a device-only tab. It is never added to the global My Devices menu."
        );
        var visibility = card("Host integration");
        checkboxField(
            visibility,
            "Show Commands tab on hosts",
            draft.moduleOptions.mycommands.showOnDevice !== false,
            function (checked) {
                draft.moduleOptions.mycommands.showOnDevice = checked;
            }
        );
        host.appendChild(visibility);

        var execution = card("Execution limits");
        numberField(
            execution,
            "Maximum multi-host devices",
            draft.moduleOptions.mycommands.maxMultiHostNodes || 200,
            function (value) { draft.moduleOptions.mycommands.maxMultiHostNodes = value; },
            1,
            1000
        );
        numberField(
            execution,
            "Multi-host concurrency",
            draft.moduleOptions.mycommands.multiHostConcurrency || 8,
            function (value) { draft.moduleOptions.mycommands.multiHostConcurrency = value; },
            1,
            64
        );
        groupField(
            execution,
            "Allowed user groups",
            draft.moduleOptions.mycommands.accessGroupIds || [],
            function (groups) { draft.moduleOptions.mycommands.accessGroupIds = groups; },
            "Leave empty to allow all authenticated users with required device rights."
        );
        host.appendChild(execution);
    }

    function myJiraSettings(host) {
        sectionHeader(host, "My Jira", "Jira Cloud and Assets integration settings.");
        var moduleCard = card("Module");
        checkboxField(moduleCard, "Enable My Jira", draft.modules.myjira === true, function (checked) {
            draft.modules.myjira = checked;
        });
        groupField(
            moduleCard,
            "Allowed user groups",
            draft.moduleOptions.myjira.accessGroupIds || [],
            function (groups) { draft.moduleOptions.myjira.accessGroupIds = groups; }
        );
        host.appendChild(moduleCard);

        var jira = draft.integrations.jira;
        var integration = card("Jira integration");
        textField(integration, "Jira URL", jira.url, function (value) { jira.url = value; }, { placeholder: "https://tenant.atlassian.net" });
        textField(integration, "Email", jira.email, function (value) { jira.email = value; });
        textField(integration, "API token", "", function (value) { draft.secrets.jiraToken = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.jiraToken ? "A token is already stored. Leave empty to keep it." : "Enter the Jira API token."
        });
        textField(integration, "Project key", jira.projectKey, function (value) { jira.projectKey = value; });
        textField(integration, "Assets field ID", jira.assetFieldId, function (value) { jira.assetFieldId = value; });
        textField(integration, "Hostname attribute", jira.hostnameAttribute || "Hostname", function (value) { jira.hostnameAttribute = value; });
        textField(integration, "Workspace ID", jira.workspaceId, function (value) { jira.workspaceId = value; });
        textField(integration, "Cloud ID", jira.cloudId, function (value) { jira.cloudId = value; });
        textField(integration, "Default AQL", jira.aql || "objectType = Computer", function (value) { jira.aql = value; }, { multiline: true, rows: 3 });
        numberField(integration, "Maximum results", jira.maxResults || 100, function (value) { jira.maxResults = value; }, 10, 500);
        checkboxField(integration, "Verify TLS certificates", jira.verifyTls !== false, function (checked) { jira.verifyTls = checked; });
        checkboxField(integration, "Enable CMDB / Assets", jira.cmdbEnabled !== false, function (checked) { jira.cmdbEnabled = checked; });
        textField(integration, "Approval transition ID", jira.approvalTransitionId, function (value) { jira.approvalTransitionId = value; });
        textField(integration, "Close transition ID", jira.closeTransitionId, function (value) { jira.closeTransitionId = value; });
        host.appendChild(integration);
    }

    function defenderSettings(host) {
        sectionHeader(host, "Defender XDR", "Microsoft Defender XDR and Graph integration settings.");
        var moduleCard = card("Module");
        checkboxField(moduleCard, "Enable Defender XDR", draft.modules.defendertools === true, function (checked) {
            draft.modules.defendertools = checked;
        });
        host.appendChild(moduleCard);

        var defender = draft.integrations.defender;
        var integration = card("Defender integration");
        textField(integration, "Tenant ID", defender.tenantId, function (value) { defender.tenantId = value; });
        textField(integration, "Client ID", defender.clientId, function (value) { defender.clientId = value; });
        textField(integration, "Client secret", "", function (value) { draft.secrets.defenderClientSecret = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.defenderClientSecret ? "A secret is already stored. Leave empty to keep it." : "Enter the application client secret."
        });
        selectField(integration, "Incident mode", defender.incidentMode || "active", [
            { value: "active", title: "Active" },
            { value: "all", title: "All" }
        ], function (value) { defender.incidentMode = value; });
        selectField(integration, "Time range", defender.timeRange || "30d", [
            { value: "none", title: "No limit" },
            { value: "7d", title: "7 days" },
            { value: "30d", title: "30 days" },
            { value: "90d", title: "90 days" },
            { value: "180d", title: "180 days" },
            { value: "365d", title: "365 days" },
            { value: "month", title: "Current month" },
            { value: "year", title: "Current year" },
            { value: "custom", title: "Custom" }
        ], function (value) { defender.timeRange = value; });
        selectField(integration, "Date field", defender.dateField || "lastUpdateDateTime", [
            { value: "lastUpdateDateTime", title: "Last update" },
            { value: "createdDateTime", title: "Created" }
        ], function (value) { defender.dateField = value; });
        textField(integration, "Custom from UTC", defender.customFromUtc, function (value) { defender.customFromUtc = value; });
        textField(integration, "Custom to UTC", defender.customToUtc, function (value) { defender.customToUtc = value; });
        textField(integration, "Incident ID filter", defender.showIncidentId, function (value) { defender.showIncidentId = value; });
        textField(integration, "Name contains", defender.nameContains, function (value) { defender.nameContains = value; });
        textField(integration, "MDCA API base URL", defender.mdcaApiBaseUrl, function (value) { defender.mdcaApiBaseUrl = value; });
        host.appendChild(integration);

        var permissions = card("Permission groups");
        groupField(permissions, "Incidents", defender.permissions.incidents || [], function (groups) { defender.permissions.incidents = groups; });
        groupField(permissions, "Email", defender.permissions.email || [], function (groups) { defender.permissions.email = groups; });
        groupField(permissions, "Trusted actions", defender.permissions.trusted || [], function (groups) { defender.permissions.trusted = groups; });
        groupField(permissions, "Advanced hunting", defender.permissions.hunting || [], function (groups) { defender.permissions.hunting = groups; });
        host.appendChild(permissions);
    }

    function myScriptsSettings(host) {
        sectionHeader(host, "My Scripts", "Script library access and shared integration profiles.");
        var moduleCard = card("Module");
        checkboxField(moduleCard, "Enable My Scripts", draft.modules.myscripts !== false, function (checked) {
            draft.modules.myscripts = checked;
        });
        groupField(
            moduleCard,
            "Allowed user groups",
            draft.moduleOptions.myscripts.accessGroupIds || [],
            function (groups) { draft.moduleOptions.myscripts.accessGroupIds = groups; },
            "Leave empty to allow all authenticated users."
        );
        host.appendChild(moduleCard);

        var ad = draft.integrations.ad;
        var adCard = card("Active Directory profile");
        textField(adCard, "Domain", ad.domain, function (value) { ad.domain = value; });
        textField(adCard, "Login", ad.login, function (value) { ad.login = value; });
        textField(adCard, "Password", "", function (value) { draft.secrets.adPassword = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.adPassword ? "A password is already stored. Leave empty to keep it." : "Enter the service account password."
        });
        host.appendChild(adCard);

        var entra = draft.integrations.entra;
        var entraCard = card("Entra ID profile");
        textField(entraCard, "Tenant ID", entra.tenantId, function (value) { entra.tenantId = value; });
        textField(entraCard, "Client ID", entra.clientId, function (value) { entra.clientId = value; });
        textField(entraCard, "Client secret", "", function (value) { draft.secrets.entraClientSecret = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.entraClientSecret ? "A secret is already stored. Leave empty to keep it." : "Enter the application client secret."
        });
        host.appendChild(entraCard);

        var zabbix = draft.integrations.zabbix;
        var zabbixCard = card("Zabbix profile");
        textField(zabbixCard, "URL", zabbix.url, function (value) { zabbix.url = value; });
        textField(zabbixCard, "Username", zabbix.username, function (value) { zabbix.username = value; });
        textField(zabbixCard, "Password", "", function (value) { draft.secrets.zabbixPassword = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.zabbixPassword ? "A password is already stored. Leave empty to keep it." : "Optional password authentication."
        });
        textField(zabbixCard, "API token", "", function (value) { draft.secrets.zabbixToken = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.zabbixToken ? "A token is already stored. Leave empty to keep it." : "Optional API token authentication."
        });
        checkboxField(zabbixCard, "Verify TLS certificates", zabbix.verifyTls !== false, function (checked) { zabbix.verifyTls = checked; });
        host.appendChild(zabbixCard);
    }

    function settings() {
        var layout = element("div", "mc-admin-settings-layout");
        var navigation = element("nav", "mc-admin-settings-nav");
        var panel = element("div", "mc-admin-settings-panel");

        settingsItems.forEach(function (item) {
            var button = element("button", "", item.title);
            button.type = "button";
            button.classList.toggle("active", item.key === settingsSection);
            button.onclick = function () {
                settingsSection = item.key;
                render();
            };
            navigation.appendChild(button);
        });

        layout.appendChild(navigation);
        layout.appendChild(panel);
        content.appendChild(layout);

        if (settingsSection === "approvalcenter") approvalSettings(panel);
        else if (settingsSection === "moverequests") moveRequestsSettings(panel);
        else if (settingsSection === "mycommands") myCommandsSettings(panel);
        else if (settingsSection === "myjira") myJiraSettings(panel);
        else if (settingsSection === "defendertools") defenderSettings(panel);
        else myScriptsSettings(panel);

        renderSaveBar(panel);
    }

    function debug() {
        content.appendChild(element(
            "pre",
            "mc-admin-debug",
            JSON.stringify(data, null, 2)
        ));
    }

    function render() {
        if (!draft) resetDraft();
        content.innerHTML = "";
        root.querySelectorAll("[data-tab]").forEach(function (button) {
            button.classList.toggle(
                "active",
                button.getAttribute("data-tab") === active
            );
        });
        if (active === "settings") settings();
        else if (active === "debug") debug();
        else overview();
    }

    root.querySelectorAll("[data-tab]").forEach(function (button) {
        button.onclick = function () {
            active = button.getAttribute("data-tab");
            render();
        };
    });

    resetDraft();
    render();
}());
