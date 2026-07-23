(function () {
    "use strict";

    var root = document.getElementById("mycompany-admin");
    if (!root) return;

    var data = window.MyCompanyAdminData || {};
    var content = document.getElementById("mycompany-admin-content");
    var active = "overview";
    var settingsSection = "portal";
    var debugSection = "config";
    var draft = null;

    var settingsItems = [
        { key: "portal", title: "SirK Portal" },
        { key: "approvalcenter", title: "Approval Center" },
        { key: "moverequests", title: "Move Request" },
        { key: "mycommands", title: "My Commands" },
        { key: "myscripts", title: "My Scripts" },
        { key: "folderpermissions", title: "Uprawnienia folderów" },
        { key: "myjira", title: "My Jira" },
        { key: "defendertools", title: "Defender XDR" }
    ];

    var debugItems = [
        { key: "config", title: "Config" },
        { key: "logs", title: "Logi" },
        { key: "errors", title: "Błędy" }
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

        ensureObject(moduleOptions, "approvalcenter");
        ensureObject(moduleOptions.approvalcenter, "providers");
        ensureObject(moduleOptions, "moverequests");
        ensureObject(moduleOptions, "mycommands");
        ensureObject(moduleOptions, "myjira");
        ensureObject(moduleOptions, "defendertools");
        ensureObject(moduleOptions, "myscripts");
        ensureObject(moduleOptions, "portal");
        ensureObject(moduleOptions.portal, "views");
        ensureObject(moduleOptions.mycommands, "folderPermissions");
        ensureObject(moduleOptions.myscripts, "folderPermissions");

        ensureObject(integrationValues, "ad");
        ensureObject(integrationValues, "entra");
        ensureObject(integrationValues, "jira");
        ensureObject(integrationValues, "defender");
        ensureObject(integrationValues, "zabbix");
        ensureObject(integrationValues.defender, "permissions");
        ["ad", "entra", "jira", "defender", "zabbix"].forEach(function (key) {
            ensureObject(integrationValues[key], "health");
            if (["ok", "warning", "critical"].indexOf(integrationValues[key].health.status) < 0) integrationValues[key].health.status = "ok";
        });

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

    function healthFields(host, integration) {
        var health = ensureObject(integration, "health");
        if (["ok", "warning", "critical"].indexOf(health.status) < 0) health.status = "ok";
        var wrapper = row(host, "Stan integracji", "Status i komunikat wyświetlane na stronie Przegląd / Overview.");
        var switcher = element("div", "mc-admin-health-switch");
        var messages = element("div", "mc-admin-health-messages");
        [
            { value: "ok", title: "OK" },
            { value: "warning", title: "Warning" },
            { value: "critical", title: "Critical" }
        ].forEach(function (choice) {
            var button = element("button", "mc-admin-health-option is-" + choice.value, choice.title);
            button.type = "button";
            button.setAttribute("aria-pressed", String(health.status === choice.value));
            if (health.status === choice.value) button.classList.add("active");
            button.onclick = function () {
                health.status = choice.value;
                Array.prototype.forEach.call(switcher.children, function (item) {
                    var active = item === button;
                    item.classList.toggle("active", active);
                    item.setAttribute("aria-pressed", String(active));
                });
                messages.hidden = choice.value === "ok";
            };
            switcher.appendChild(button);
        });
        wrapper.appendChild(switcher);
        messages.hidden = health.status === "ok";
        textField(messages, "Komunikat po polsku", health.messagePl, function (value) { health.messagePl = value; }, { placeholder: "Np. Problemy z pobieraniem hostów" });
        textField(messages, "Message in English", health.messageEn, function (value) { health.messageEn = value; }, { placeholder: "For example: Problems retrieving hosts" });
        host.appendChild(messages);
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

    function getAdminAction(action) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("action", action);
        return fetch(url.href, { credentials: "same-origin" }).then(parseResponse);
    }

    function postAdminAction(action, values) {
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values || {}));
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("action", action);
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
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

        draft.moduleOptions.mycommands.showInMenu = false;
        draft.moduleOptions.moverequests.menuEnabled = false;

        var moduleJobs = [
            postModule("portal", "settings", {
                enabled: draft.modules.portal !== false,
                defaultView: draft.moduleOptions.portal.defaultView || "overview",
                showLauncher: draft.moduleOptions.portal.showLauncher === true,
                showNativeLink: draft.moduleOptions.portal.showNativeLink !== false,
                forceNewLogin: draft.moduleOptions.portal.forceNewLogin === true,
                forcePortalInterface: draft.moduleOptions.portal.forcePortalInterface === true,
                keepSessionsAfterRestart: draft.moduleOptions.portal.keepSessionsAfterRestart === true,
                views: draft.moduleOptions.portal.views || {}
            }),
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
                multiHostConcurrency: draft.moduleOptions.mycommands.multiHostConcurrency || 8,
                folderPermissions: draft.moduleOptions.mycommands.folderPermissions || {}
            }),
            postModule("myscripts", "settings", {
                accessGroupIds: draft.moduleOptions.myscripts.accessGroupIds || [],
                folderPermissions: draft.moduleOptions.myscripts.folderPermissions || {}
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
        var actions = element("div", "mc-admin-actions mc-admin-settings-savebar");
        var save = element("button", "mc-admin-primary", "Save settings");
        save.type = "button";
        var status = element("span", "mc-admin-save-status", "");
        save.onclick = function () { saveAll(save, status); };
        actions.appendChild(save);
        actions.appendChild(status);
        var header = host.querySelector(":scope > .mc-admin-section-header");
        if (header && header.nextSibling) host.insertBefore(actions, header.nextSibling);
        else host.appendChild(actions);
    }

    function overview() {
        sectionHeader(
            content,
            "Overview",
            "Tylko do odczytu: ogólny stan wszystkich modułów MyCompany."
        );
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
            value.appendChild(element(
                "div",
                "mc-admin-summary-row",
                "Module: " + (module.enabled ? "Enabled" : "Disabled")
            ));

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
        checkboxField(
            value,
            "No approval required",
            provider.allowNoApproval === true,
            function (checked) { provider.allowNoApproval = checked; },
            type === "myscripts"
                ? "Allow immediate execution when the script does not declare Approval_1, Approval_2 or Approval_3. When disabled, Level 1 approval is required."
                : "Explicitly allow immediate execution when the request does not declare approval levels."
        );
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
        renderProvider(
            host,
            "myscripts",
            "My Scripts",
            "Provider visibility and approver groups. Required levels are selected separately in each script definition."
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
        healthFields(integration, jira);
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
        healthFields(integration, defender);
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
        healthFields(adCard, ad);
        host.appendChild(adCard);

        var entra = draft.integrations.entra;
        var entraCard = card("Entra ID profile");
        textField(entraCard, "Tenant ID", entra.tenantId, function (value) { entra.tenantId = value; });
        textField(entraCard, "Client ID", entra.clientId, function (value) { entra.clientId = value; });
        textField(entraCard, "Client secret", "", function (value) { draft.secrets.entraClientSecret = value; }, {
            type: "password",
            description: data.integrations && data.integrations.configured && data.integrations.configured.entraClientSecret ? "A secret is already stored. Leave empty to keep it." : "Enter the application client secret."
        });
        healthFields(entraCard, entra);
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
        healthFields(zabbixCard, zabbix);
        host.appendChild(zabbixCard);
    }

    function folderPermissionsSettings(host) {
        sectionHeader(host, "Uprawnienia folderów i menu", "Widoczność lewego menu Portalu oraz folderów głównych w Zarządzaniu i My Commands. Ograniczenia są sprawdzane również przez backend.");

        function accessControls(item, value) {
            if (value.allowAll == null) value.allowAll = false;
            var allowAll = checkboxField(item, "Dostęp dla wszystkich użytkowników", value.allowAll === true, function (checked) {
                value.allowAll = checked;
                groups.disabled = checked;
                groups.closest(".mc-admin-field").classList.toggle("is-disabled", checked);
            }, "Włączenie tej opcji pomija wybór grup.");
            var groups = groupField(item, "Grupy z dostępem", value.groupIds, function (selected) { value.groupIds = selected; }, "Bez zaznaczenia dostępu dla wszystkich należy wybrać co najmniej jedną grupę. Site Admin zawsze omija wybór grup.");
            groups.disabled = allowAll.checked;
            groups.closest(".mc-admin-field").classList.toggle("is-disabled", allowAll.checked);
        }

        var portalViews = [
            { key: "overview", label: "Overview / Przegląd" },
            { key: "devices", label: "Devices / Urządzenia" },
            { key: "approvals", label: "Approval / Akceptacje" },
            { key: "automation", label: "Automation / Automatyzacja" },
            { key: "monitoring", label: "Monitoring" },
            { key: "assets", label: "Assets / Zasoby" },
            { key: "management", label: "Management / Zarządzanie" },
            { key: "reports", label: "Reports / Raporty" },
            { key: "security", label: "Security / Bezpieczeństwo" },
            { key: "settings", label: "Settings / Ustawienia" }
        ];

        var portalCard = card("SirK Portal — lewe menu", "Każda pozycja ma osobną regułę. Site Admin omija wybór grup, ale nie widzi pozycji wyłączonej.");
        var portalPermissions = ensureObject(draft.moduleOptions.portal, "views");
        portalViews.forEach(function (view) {
            var value = ensureObject(portalPermissions, view.key);
            if (value.enabled == null) value.enabled = true;
            if (!Array.isArray(value.groupIds)) value.groupIds = [];
            var item = element("section", "mc-admin-folder-permission mc-admin-menu-permission");
            var heading = element("div", "mc-admin-folder-permission-header");
            var identity = element("div", "mc-admin-folder-permission-name");
            identity.appendChild(element("strong", "", view.label));
            identity.appendChild(element("small", "", view.key));
            heading.appendChild(identity);
            var enabledLabel = element("label", "mc-admin-folder-permission-toggle");
            var enabled = element("input");
            enabled.type = "checkbox";
            enabled.checked = value.enabled !== false;
            enabled.onchange = function () { value.enabled = enabled.checked; item.classList.toggle("is-disabled", !enabled.checked); };
            enabledLabel.appendChild(enabled);
            enabledLabel.appendChild(document.createTextNode(" Pozycja włączona"));
            heading.appendChild(enabledLabel);
            item.appendChild(heading);
            accessControls(item, value);
            item.classList.toggle("is-disabled", !enabled.checked);
            portalCard.appendChild(item);
        });
        host.appendChild(portalCard);

        function renderModule(moduleKey, title, description) {
            var moduleCard = card(title, description);
            var folders = data.folderPermissions && data.folderPermissions[moduleKey] || [];
            var permissions = ensureObject(draft.moduleOptions[moduleKey], "folderPermissions");
            if (!folders.length) {
                moduleCard.appendChild(element("div", "mc-admin-notice", "Brak zdefiniowanych folderów."));
                host.appendChild(moduleCard);
                return;
            }
            folders.forEach(function (folder) {
                var key = String(folder.key || "");
                var value = ensureObject(permissions, key);
                if (value.enabled == null) value.enabled = folder.enabled !== false;
                if (!Array.isArray(value.groupIds)) value.groupIds = Array.isArray(folder.groupIds) ? folder.groupIds.slice() : [];
                var item = element("section", "mc-admin-folder-permission");
                var heading = element("div", "mc-admin-folder-permission-header");
                var identity = element("div", "mc-admin-folder-permission-name");
                identity.appendChild(element("strong", "", folder.locales && folder.locales.pl && folder.locales.pl.label || folder.label || key));
                identity.appendChild(element("small", "", key));
                heading.appendChild(identity);
                var enabledLabel = element("label", "mc-admin-folder-permission-toggle");
                var enabled = element("input");
                enabled.type = "checkbox";
                enabled.checked = value.enabled !== false;
                enabled.onchange = function () { value.enabled = enabled.checked; item.classList.toggle("is-disabled", !enabled.checked); };
                enabledLabel.appendChild(enabled);
                enabledLabel.appendChild(document.createTextNode(" Folder włączony"));
                heading.appendChild(enabledLabel);
                item.appendChild(heading);
                accessControls(item, value);
                item.classList.toggle("is-disabled", !enabled.checked);
                moduleCard.appendChild(item);
            });
            host.appendChild(moduleCard);
        }

        renderModule("myscripts", "My Scripts — foldery Zarządzania", "Każdy folder główny z pierwszej kolumny Zarządzania ma osobną regułę.");
        renderModule("mycommands", "My Commands — katalogi poleceń", "Reguły dotyczą katalogu Scripts oraz kategorii poleceń widocznych z lewej strony.");
    }

    function settings() {
        var layout = element("div", "mc-admin-settings-layout");
        var navigation = element("nav", "mc-admin-settings-nav");
        var panel = element("div", "mc-admin-settings-panel");

        settingsItems.forEach(function (item) {
            var button = element("button", "", item.title);
            button.type = "button";
            button.setAttribute("data-settings-key", item.key);
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

        if (settingsSection === "portal") {
            if (window.MyCompanyPortalAdmin && typeof window.MyCompanyPortalAdmin.render === "function") {
                window.MyCompanyPortalAdmin.render(panel);
            } else {
                sectionHeader(panel, "SirK Portal", "Ładowanie ustawień Portalu…");
            }
        } else if (settingsSection === "approvalcenter") approvalSettings(panel);
        else if (settingsSection === "moverequests") moveRequestsSettings(panel);
        else if (settingsSection === "mycommands") myCommandsSettings(panel);
        else if (settingsSection === "myscripts") myScriptsSettings(panel);
        else if (settingsSection === "folderpermissions") folderPermissionsSettings(panel);
        else if (settingsSection === "myjira") myJiraSettings(panel);
        else if (settingsSection === "defendertools") defenderSettings(panel);
        else moveRequestsSettings(panel);

        if (settingsSection !== "portal") renderSaveBar(panel);
    }

    function pluginTable(host, plugins, status) {
        var table = element("table", "mc-admin-table mc-admin-plugin-table");
        var head = element("thead");
        var headRow = element("tr");
        ["Nazwa", "Wersja", "Stan", "Opis", "Akcje"].forEach(function (title) {
            headRow.appendChild(element("th", "", title));
        });
        head.appendChild(headRow);
        table.appendChild(head);
        var body = element("tbody");
        (plugins || []).forEach(function (plugin) {
            var row = element("tr");
            var nameCell = element("td", "mc-admin-plugin-name");
            nameCell.appendChild(element("strong", "", plugin.name || plugin.shortName));
            nameCell.appendChild(element("small", "mc-admin-table-secondary", plugin.shortName || ""));
            row.appendChild(nameCell);
            row.appendChild(element("td", "", plugin.version || "—"));
            var stateCell = element("td");
            stateCell.appendChild(element("span", plugin.status === 1 ? "mc-admin-state ready" : "mc-admin-state error", plugin.status === 1 ? "Włączona" : "Wyłączona"));
            row.appendChild(stateCell);
            row.appendChild(element("td", "mc-admin-plugin-description", plugin.description || "—"));
            var actionCell = element("td", "mc-admin-table-actions");
            var select = element("select", "mc-admin-input mc-admin-action-select");
            var placeholder = element("option", "", "Wybierz…");
            placeholder.value = "";
            select.appendChild(placeholder);
            var toggle = element("option", "", plugin.status === 1 ? "Wyłącz" : "Włącz");
            toggle.value = plugin.status === 1 ? "disable" : "enable";
            select.appendChild(toggle);
            var remove = element("option", "", "Usuń");
            remove.value = "remove";
            select.appendChild(remove);
            if (plugin.protected) {
                select.disabled = true;
                select.title = "MyCompany nie może zarządzać własnym procesem z tego panelu.";
            }
            select.onchange = function () {
                var operation = select.value;
                select.value = "";
                if (!operation) return;
                var destructive = operation === "remove";
                var question = destructive
                    ? "Usunąć wtyczkę " + plugin.name + "? Przed usunięciem zostanie utworzony backup."
                    : (operation === "disable" ? "Wyłączyć wtyczkę " : "Włączyć wtyczkę ") + plugin.name + "?";
                if (!window.confirm(question)) return;
                select.disabled = true;
                status.textContent = "Wykonywanie operacji…";
                postAdminAction("plugin-operation", { operation: operation, id: plugin.id }).then(function (result) {
                    status.className = "mc-admin-save-status";
                    status.textContent = destructive && result.result && result.result.backupPath
                        ? "Wtyczka usunięta. Backup: " + result.result.backupPath
                        : "Operacja zakończona.";
                    pluginTable(host, result.plugins || [], status);
                }).catch(function (error) {
                    status.className = "mc-admin-save-status mc-admin-error";
                    status.textContent = error.message;
                    select.disabled = false;
                });
            };
            actionCell.appendChild(select);
            row.appendChild(actionCell);
            body.appendChild(row);
        });
        table.appendChild(body);
        var old = host.querySelector(".mc-admin-table-wrap");
        var wrap = element("div", "mc-admin-table-wrap");
        wrap.appendChild(table);
        if (old) old.replaceWith(wrap); else host.appendChild(wrap);
    }

    function pluginsView() {
        sectionHeader(content, "Wtyczki", "Zarządzanie wtyczkami zarejestrowanymi w MeshCentral.");
        var toolbar = element("div", "mc-admin-toolbar");
        var add = element("button", "mc-admin-primary", "Dodaj wtyczkę");
        add.type = "button";
        toolbar.appendChild(add);
        content.appendChild(toolbar);
        var form = card("Dodaj wtyczkę", "Podaj adres HTTPS pliku konfiguracyjnego wtyczki.");
        form.hidden = true;
        var input = textField(form, "URL konfiguracji", "", function () {}, { placeholder: "https://…/config.json" });
        var formActions = element("div", "mc-admin-inline-actions");
        var confirmAdd = element("button", "mc-admin-primary", "Dodaj");
        confirmAdd.type = "button";
        var cancel = element("button", "mc-admin-secondary", "Anuluj");
        cancel.type = "button";
        formActions.appendChild(confirmAdd);
        formActions.appendChild(cancel);
        form.appendChild(formActions);
        content.appendChild(form);
        var status = element("div", "mc-admin-save-status", "Ładowanie listy wtyczek…");
        content.appendChild(status);
        add.onclick = function () { form.hidden = false; input.focus(); };
        cancel.onclick = function () { form.hidden = true; input.value = ""; };
        confirmAdd.onclick = function () {
            if (!input.value.trim()) { status.textContent = "Podaj URL konfiguracji."; return; }
            confirmAdd.disabled = true;
            status.textContent = "Dodawanie wtyczki…";
            postAdminAction("plugin-operation", { operation: "add", configUrl: input.value.trim() }).then(function (result) {
                status.className = "mc-admin-save-status";
                form.hidden = true;
                input.value = "";
                status.textContent = "Wtyczka została dodana. Wybierz Włącz z menu akcji, aby ją zainstalować.";
                pluginTable(content, result.plugins || [], status);
            }).catch(function (error) {
                status.className = "mc-admin-save-status mc-admin-error";
                status.textContent = error.message;
            }).then(function () { confirmAdd.disabled = false; });
        };
        getAdminAction("plugin-state").then(function (result) {
            status.textContent = "";
            pluginTable(content, result.plugins || [], status);
        }).catch(function (error) {
            status.className = "mc-admin-save-status mc-admin-error";
            status.textContent = error.message;
        });
    }

    function serverView() {
        sectionHeader(content, "Serwer", "Stan usług Windows należących do bieżącej instalacji MeshCentral.");
        var status = element("div", "mc-admin-save-status", "Ładowanie stanu usług…");
        content.appendChild(status);
        var host = element("div", "mc-admin-service-list");
        content.appendChild(host);
        getAdminAction("server-state").then(function (result) {
            status.textContent = "";
            if (!result.services || !result.services.length) {
                status.textContent = "Nie znaleziono usługi Windows przypisanej do tej instalacji.";
                return;
            }
            result.services.forEach(function (service) {
                var value = card(service.displayName || service.name, "Nazwa usługi: " + service.name);
                value.appendChild(element("div", "mc-admin-summary-row", "Stan: " + service.state));
                value.appendChild(element("div", "mc-admin-summary-row", "Tryb uruchomienia: " + service.startMode));
                value.appendChild(element("div", "mc-admin-summary-row", "PID: " + (service.processId || "—")));
                var restart = element("button", "mc-admin-primary", "Restartuj usługę");
                restart.type = "button";
                restart.onclick = function () {
                    if (!window.confirm("Zrestartować usługę " + (service.displayName || service.name) + "? Bieżące połączenia zostaną przerwane.")) return;
                    restart.disabled = true;
                    status.textContent = "Zaplanowano restart. Portal może być chwilowo niedostępny.";
                    postAdminAction("server-restart", { serviceName: service.name }).then(function () {
                        window.setTimeout(function () { window.location.reload(); }, 8000);
                    }).catch(function (error) {
                        status.className = "mc-admin-save-status mc-admin-error";
                        status.textContent = error.message;
                        restart.disabled = false;
                    });
                };
                value.appendChild(restart);
                host.appendChild(value);
            });
        }).catch(function (error) {
            status.className = "mc-admin-save-status mc-admin-error";
            status.textContent = error.message;
        });
    }

    function debugValue() {
        if (debugSection === "config") {
            return {
                plugin: data.plugin || {},
                modules: data.modules || [],
                moduleSettings: data.moduleSettings || {},
                integrations: data.integrations || {},
                migration: data.migration || {},
                generatedAt: data.generatedAt || ""
            };
        }
        if (debugSection === "logs") {
            return data.diagnostics && data.diagnostics.logs || "Brak wpisów logu MyCompany.";
        }
        return data.diagnostics && data.diagnostics.errors ||
            (data.moduleLoadErrors && Object.keys(data.moduleLoadErrors).length
                ? JSON.stringify(data.moduleLoadErrors, null, 2)
                : "Brak zarejestrowanych błędów MyCompany.");
    }

    function debug() {
        var layout = element("div", "mc-admin-settings-layout mc-admin-debug-layout");
        var navigation = element("nav", "mc-admin-settings-nav mc-admin-debug-nav");
        var panel = element("div", "mc-admin-settings-panel mc-admin-debug-panel");
        debugItems.forEach(function (item) {
            var button = element("button", "", item.title);
            button.type = "button";
            button.setAttribute("data-debug-key", item.key);
            button.classList.toggle("active", item.key === debugSection);
            button.onclick = function () {
                debugSection = item.key;
                render();
            };
            navigation.appendChild(button);
        });
        panel.appendChild(element(
            "pre",
            "mc-admin-debug",
            typeof debugValue() === "string" ? debugValue() : JSON.stringify(debugValue(), null, 2)
        ));
        layout.appendChild(navigation);
        layout.appendChild(panel);
        content.appendChild(layout);
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
        else if (active === "plugins") pluginsView();
        else if (active === "server") serverView();
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
