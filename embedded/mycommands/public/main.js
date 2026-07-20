(function () {
    "use strict";

    window.MyCommands = window.MyCommands || {};
    var plugin = window.MyCommands;
    var core = window.MeshPluginCore;
    plugin.state = plugin.state || {};
    Object.assign(plugin.state, {
        access: plugin.state.access || null,
        ui: plugin.state.ui || null,
        config: plugin.state.config || null,
        nodeId: plugin.state.nodeId || plugin.pendingNodeId || "",
        category: "scripts",
        catalog: plugin.state.catalog || null,
        scripts: plugin.state.scripts || null,
        selectedRoot: plugin.state.selectedRoot || "",
        scriptFilter: plugin.state.scriptFilter || "",
        folderMenuCollapsed: plugin.state.folderMenuCollapsed === true,
        searchVisible: plugin.state.searchVisible === true,
        selected: plugin.state.selected || null,
        running: false,
        responseId: "",
        output: "",
        resultByKey: plugin.state.resultByKey || {},
        progress: "",
        table: null,
        tableQuery: "",
        tablePage: 1,
        tablePageSize: 20,
        standaloneActive: false,
        nativeState: null
    });
    plugin.uiPrefsKey = "mycommands-ui-prefs-v1";
    plugin.loadUiPrefs = function () { try { var value = JSON.parse(window.localStorage.getItem(plugin.uiPrefsKey) || "{}"); if (value && typeof value === "object") { plugin.state.folderMenuCollapsed = value.folderMenuCollapsed === true; plugin.state.searchVisible = value.searchVisible === true; } } catch (error) { } };
    plugin.saveUiPrefs = function () { try { window.localStorage.setItem(plugin.uiPrefsKey, JSON.stringify({ folderMenuCollapsed: plugin.state.folderMenuCollapsed === true, searchVisible: plugin.state.searchVisible === true })); } catch (error) { } };
    plugin.loadUiPrefs();

    function mark(element, label) {
        if (!element) return element;
        element.setAttribute("data-meshcentral-plugin-pin", "mycommands");
        element.setAttribute("data-meshcentral-plugin-click", label || element.id || "My Commands");
        return element;
    }

    function button(label, handler, className) {
        var element = document.createElement("input");
        element.type = "button";
        element.value = label;
        element.onclick = handler;
        if (className) element.className = className;
        return mark(element, label);
    }

    function modernUi() {
        return typeof window.setModalContent === "function" && typeof window.showModal === "function";
    }

    plugin.initialize = function () {
        if (plugin.state.initializePromise) return plugin.state.initializePromise;
        var accessPromise = plugin.state.access && plugin.state.ui && plugin.state.config ? Promise.resolve({ access: plugin.state.access, ui: plugin.state.ui, config: plugin.state.config }) : core.apiRequest(window.MyCompanyAssetUrl("commands", "access"));
        plugin.state.initializePromise = accessPromise.then(function (value) {
            plugin.state.access = value.access || { allowed: false, siteAdmin: false };
            plugin.state.ui = value.ui || { showInMenu: false, showOnDevice: true };
            plugin.state.config = value.config || {};
            if (!plugin.state.access.allowed) {
                plugin.removeMenus();
                plugin.removeDeviceIntegration();
                return;
            }
            plugin.syncIntegrations();
            if (plugin.pendingNodeId) plugin.onDeviceRefreshEnd(plugin.pendingNodeId);
            if (plugin.pendingOpen) { plugin.pendingOpen = false; plugin.openStandalone(); }
        }).catch(function (error) {
            plugin.state.access = { allowed: false, siteAdmin: false };
            plugin.removeMenus();
            plugin.removeDeviceIntegration();
            if (window.console) console.error("My Commands initialization error", error);
        });
        return plugin.state.initializePromise;
    };

    plugin.syncIntegrations = function () {
        if (!plugin.state.access || !plugin.state.access.allowed) { plugin.removeMenus(); plugin.removeDeviceIntegration(); return; }
        if (plugin.state.ui && plugin.state.ui.showInMenu) plugin.ensureMenus(); else plugin.removeMenus();
        if (plugin.state.ui && plugin.state.ui.showOnDevice && plugin.state.nodeId) plugin.ensureDeviceIntegration(); else if (!plugin.state.ui || !plugin.state.ui.showOnDevice) plugin.removeDeviceIntegration();
    };

    plugin.removeMenus = function () {
        ["MainMenuMyCommands", "LeftMenuMyCommands"].forEach(function (id) {
            var element = document.getElementById(id);
            if (element && element.parentNode) element.parentNode.removeChild(element);
        });
    };

    plugin.ensureMenus = function () {
        if (!plugin.state.config || !plugin.state.ui || !plugin.state.ui.showInMenu) return false;
        var mainAnchor = document.getElementById("MainMenuMyDevices");
        var leftAnchor = document.getElementById("LeftMenuMyDevices");
        if (mainAnchor && mainAnchor.parentNode) {
            var main = document.getElementById("MainMenuMyCommands") || mainAnchor.cloneNode(false);
            main.id = "MainMenuMyCommands";
            main.textContent = plugin.state.config.name;
            main.title = plugin.state.config.name;
            main.tabIndex = 0;
            main.classList.remove("fullselect", "semiselect", "active");
            main.onclick = null;
            main.onmouseup = plugin.openStandalone;
            mark(main, "Main menu");
            core.placeMenuItem(main, mainAnchor, plugin.state.config.viewMode);
        }
        if (leftAnchor && leftAnchor.parentNode) {
            var left = document.getElementById("LeftMenuMyCommands") || leftAnchor.cloneNode(true);
            left.id = "LeftMenuMyCommands";
            left.title = plugin.state.config.name;
            left.setAttribute("aria-label", plugin.state.config.name);
            left.tabIndex = 0;
            left.classList.remove("lbbuttonsel", "lbbuttonsel2", "active");
            left.onclick = null;
            left.onmouseup = plugin.openStandalone;
            mark(left, "Left menu");
            var modern = String(left.tagName || "").toLowerCase() === "a" || left.classList.contains("nav-link");
            var classicIcon = left.querySelector(".lbtg");
            if (classicIcon) {
                classicIcon.className = "lbtg";
                classicIcon.style.backgroundImage = "url(\"" + window.MyCompanyAssetUrl("commands", "LeftMenu.png") + "\")";
                classicIcon.style.backgroundPosition = "center";
                classicIcon.style.backgroundRepeat = "no-repeat";
                classicIcon.style.backgroundSize = "contain";
            } else if (modern) {
                var image = left.querySelector("img[data-meshcentral-plugin-icon]");
                var nativeIcon = left.querySelector("svg, i");
                if (!image) {
                    image = document.createElement("img");
                    image.setAttribute("data-meshcentral-plugin-icon", "1");
                    image.alt = "";
                    image.width = 32;
                    image.height = 32;
                    image.style.objectFit = "contain";
                    if (nativeIcon && nativeIcon.parentNode) nativeIcon.parentNode.replaceChild(image, nativeIcon);
                    else left.insertBefore(image, left.firstChild);
                }
                image.src = window.MyCompanyAssetUrl("commands", "LeftMenu.png");
            }
            core.placeMenuItem(left, leftAnchor, plugin.state.config.viewMode);
        }
        return !!(mainAnchor || leftAnchor);
    };

    plugin.section = function (title, content) {
        var section = document.createElement("div");
        section.className = "mycommands-settings-section";
        var header = document.createElement("div");
        header.className = "DevSt noselect mycommands-section-header";
        header.tabIndex = 0;
        var arrow = document.createElement("span");
        arrow.className = "mycommands-section-arrow";
        arrow.textContent = "▼";
        arrow.style.transform = "rotate(-90deg)";
        header.appendChild(arrow);
        var text = document.createElement("span");
        text.textContent = title;
        header.appendChild(text);
        var panel = document.createElement("div");
        panel.className = "mycommands-section-panel";
        panel.style.display = "none";
        panel.appendChild(content);
        var toggle = function () { var open = panel.style.display === "none"; panel.style.display = open ? "" : "none"; arrow.style.transform = open ? "none" : "rotate(-90deg)"; };
        header.onclick = toggle;
        header.onkeypress = function (event) { if (event && event.key === "Enter") toggle(); };
        section.appendChild(mark(header, title));
        section.appendChild(panel);
        return section;
    };

    plugin.buildSettings = function () {
        var root = document.createElement("div");
        root.className = "mycommands-settings";

        var integration = document.createElement("div");
        var menuLabel = document.createElement("label");
        var menu = document.createElement("input");
        menu.type = "checkbox";
        menu.id = "MyCommandsShowInMenu";
        menuLabel.appendChild(menu);
        menuLabel.appendChild(document.createTextNode(" Show in main and side menu"));
        integration.appendChild(menuLabel);
        var deviceLabel = document.createElement("label");
        var device = document.createElement("input");
        device.type = "checkbox";
        device.id = "MyCommandsShowOnDevice";
        deviceLabel.appendChild(device);
        deviceLabel.appendChild(document.createTextNode(" Show as the Commands tab on device pages"));
        integration.appendChild(deviceLabel);
        root.appendChild(plugin.section("UI integration", integration));

        var folderPermissions = document.createElement("div");
        var folderDescription = document.createElement("p");
        folderDescription.textContent = "Assign one or more MeshCentral user groups to each script folder. Folder assignment grants access only to the Scripts tab.";
        folderPermissions.appendChild(folderDescription);
        var folderRows = document.createElement("div"); folderRows.id = "MyCommandsFolderPermissions"; folderPermissions.appendChild(folderRows);
        root.appendChild(plugin.section("Script folder permissions", folderPermissions));

        var permissions = document.createElement("div");
        var description = document.createElement("p");
        description.textContent = "Select the user group that can run commands. Without a group, access is limited to Site Admin.";
        permissions.appendChild(description);
        var groupLabel = document.createElement("div");
        groupLabel.textContent = "User groups";
        permissions.appendChild(groupLabel);
        var group = document.createElement("div");
        group.id = "MyCommandsAccessGroups";
        group.className = "mycommands-group-checkboxes";
        permissions.appendChild(group);
        root.appendChild(plugin.section("Plugin permissions", permissions));

        root.appendChild(button("Save settings", plugin.saveSettings));
        var status = document.createElement("span"); status.id = "MyCommandsSettingsStatus"; status.className = "mycommands-status"; root.appendChild(status);
        return root;
    };

    plugin.loadSettings = function () {
        if (!plugin.state.access || !plugin.state.access.siteAdmin) return;
        var status = document.getElementById("MyCommandsSettingsStatus");
        if (status) status.textContent = "Loading settings...";
        core.apiRequest(window.MyCompanyAssetUrl("commands", "settings")).then(function (result) {
            var settings = result.settings || {};
            var folderRows = document.getElementById("MyCommandsFolderPermissions");
            if (folderRows) {
                folderRows.innerHTML = "";
                (settings.folders || []).forEach(function (folder) {
                    var row = document.createElement("div"); row.className = "mycommands-folder-permission-row";
                    var folderLabel = document.createElement("strong"); folderLabel.textContent = folder.name; folderLabel.title = folder.path; row.appendChild(folderLabel);
                    var choices = document.createElement("div"); choices.className = "mycommands-group-checkboxes"; choices.setAttribute("data-folder-path", folder.path);
                    (settings.groups || []).forEach(function (item) { var label = document.createElement("label"); label.className = "mycommands-group-checkbox"; var checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = item.id; checkbox.checked = (folder.groupIds || []).indexOf(item.id) >= 0; label.appendChild(checkbox); label.appendChild(document.createTextNode(" " + item.name)); choices.appendChild(label); });
                    row.appendChild(choices); folderRows.appendChild(row);
                });
            }
            var group = document.getElementById("MyCommandsAccessGroups");
            if (group) {
                group.innerHTML = "";
                if (!(settings.groups || []).length) group.textContent = "No user groups found.";
                (settings.groups || []).forEach(function (item) {
                    var label = document.createElement("label"); label.className = "mycommands-group-checkbox";
                    var checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = item.id; checkbox.checked = (settings.accessGroupIds || []).indexOf(item.id) >= 0;
                    label.appendChild(checkbox); label.appendChild(document.createTextNode(" " + item.name)); group.appendChild(label);
                });
            }
            var showInMenu = document.getElementById("MyCommandsShowInMenu"); if (showInMenu) showInMenu.checked = settings.showInMenu === true;
            var showOnDevice = document.getElementById("MyCommandsShowOnDevice"); if (showOnDevice) showOnDevice.checked = settings.showOnDevice !== false;
            if (status) status.textContent = "";
        }).catch(function (error) { if (status) status.textContent = error.message || "Could not load settings."; });
    };

    plugin.saveSettings = function () {
        var group = document.getElementById("MyCommandsAccessGroups");
        var showInMenu = document.getElementById("MyCommandsShowInMenu");
        var showOnDevice = document.getElementById("MyCommandsShowOnDevice");
        var status = document.getElementById("MyCommandsSettingsStatus");
        if (!group || !showInMenu || !showOnDevice || !status) return;
        var groupIds = Array.from(group.querySelectorAll("input[type=checkbox]:checked")).map(function (input) { return input.value; });
        var folderPermissions = {};
        Array.prototype.forEach.call(document.querySelectorAll("#MyCommandsFolderPermissions [data-folder-path]"), function (control) { folderPermissions[control.getAttribute("data-folder-path")] = Array.prototype.map.call(control.querySelectorAll("input[type=checkbox]:checked"), function (input) { return input.value; }); });
        status.textContent = "Saving settings...";
        core.apiRequest(window.MyCompanyAssetUrl("commands", "settings"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: "groupIds=" + encodeURIComponent(JSON.stringify(groupIds)) + "&folderPermissionsJson=" + encodeURIComponent(JSON.stringify(folderPermissions)) + "&showInMenu=" + encodeURIComponent(showInMenu.checked) + "&showOnDevice=" + encodeURIComponent(showOnDevice.checked)
        }).then(function (result) {
            plugin.state.config = result.config || plugin.state.config;
            plugin.state.ui = { showInMenu: showInMenu.checked, showOnDevice: showOnDevice.checked };
            plugin.syncIntegrations();
            status.textContent = "Settings saved.";
            status.className = "mycommands-status mycommands-success";
        }).catch(function (error) { status.textContent = error.message || "Could not save settings."; status.className = "mycommands-status mycommands-error"; });
    };


    plugin.ensureDeviceIntegration = function () {
        if (!plugin.state.access || !plugin.state.access.allowed || !plugin.state.ui || !plugin.state.ui.showOnDevice) return false;
        if (typeof window.pluginHandler === "undefined" || !window.pluginHandler || typeof window.pluginHandler.registerPluginTab !== "function") return false;
        window.pluginHandler.registerPluginTab({ tabId: "mycommands-device-page", tabTitle: "Commands" });
        plugin.ensureDeviceTab();
        plugin.renderDevicePage();
        return true;
    };

    plugin.removeDeviceIntegration = function () {
        var tab = document.getElementById("MainDevMyCommands");
        if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
        var header = document.getElementById("p19ph-mycommands-device-page");
        if (header && header.parentNode) header.parentNode.removeChild(header);
        var page = document.getElementById("mycommands-device-page");
        if (page && page.parentNode) page.parentNode.removeChild(page);
    };

    plugin.ensureDeviceTab = function () {
        if (!document.getElementById("mycommands-device-page")) return false;
        var terminal = document.getElementById("MainDevTerminal");
        var plugins = document.getElementById("MainDevPlugins");
        var anchor = terminal || plugins;
        if (!anchor || !anchor.parentNode) return false;
        var tab = document.getElementById("MainDevMyCommands");
        if (!tab) {
            tab = document.createElement("td");
            tab.id = "MainDevMyCommands";
            tab.tabIndex = 0;
            tab.className = "topbar_td style3x";
            tab.textContent = "Commands";
            tab.onmouseup = plugin.openDeviceTab;
            tab.onkeypress = function (event) { if (event && event.key === "Enter") return plugin.openDeviceTab(event); };
            mark(tab, "Commands device tab");
            anchor.parentNode.insertBefore(tab, anchor.nextSibling);
        }
        tab.style.display = "";
        return true;
    };

    plugin.openDeviceTab = function (event) {
        if (event && ((event.which === 3) || (event.button === 2))) return false;
        if (typeof window.putstore === "function") window.putstore("_curPluginPage", "mycommands-device-page");
        if (typeof window.go === "function") window.go(19, event);
        window.setTimeout(function () {
            var header = document.getElementById("p19ph-mycommands-device-page");
            if (header && window.pluginHandler && typeof window.pluginHandler.callPluginPage === "function") window.pluginHandler.callPluginPage("mycommands-device-page", header);
            plugin.renderDevicePage();
            plugin.updateDeviceTab(19);
        }, 0);
        if (event && event.preventDefault) event.preventDefault();
        return false;
    };

    plugin.updateDeviceTab = function (view) {
        var tab = document.getElementById("MainDevMyCommands");
        if (!tab) return;
        if (view == null && typeof window.xxcurrentView !== "undefined") view = window.xxcurrentView;
        var activeHeader = document.querySelector("#p19headers span.on");
        var commandHeader = document.getElementById("p19ph-mycommands-device-page");
        var active = Number(view) === 19 && activeHeader === commandHeader;
        tab.classList.remove("style3x", "style3sel");
        tab.classList.add(active ? "style3sel" : "style3x");
        var pluginTab = document.getElementById("MainDevPlugins");
        if (pluginTab && active) { pluginTab.classList.remove("style3sel"); pluginTab.classList.add("style3x"); }
        var headers = document.getElementById("p19headers");
        if (headers) headers.style.display = active ? "none" : "";
        var title = document.getElementById("p19title");
        if (title) {
            var heading = title.querySelector("h1") || title.querySelector(".fs-4.fw-bold") || title;
            var titleText = null;
            for (var index = 0; index < heading.childNodes.length; index++) {
                if (heading.childNodes[index].nodeType === 3) { titleText = heading.childNodes[index]; break; }
            }
            if (!titleText) { titleText = document.createTextNode(""); heading.insertBefore(titleText, heading.firstChild); }
            if (active) {
                if (!heading.hasAttribute("data-mycommands-title")) heading.setAttribute("data-mycommands-title", titleText.nodeValue || "Plugins");
                titleText.nodeValue = "commands - ";
            } else if (heading.hasAttribute("data-mycommands-title")) {
                titleText.nodeValue = heading.getAttribute("data-mycommands-title");
                heading.removeAttribute("data-mycommands-title");
            }
        }
    };

    plugin.onDeviceRefreshEnd = function (nodeId) {
        plugin.pendingNodeId = nodeId;
        var changed = plugin.state.nodeId && String(plugin.state.nodeId) !== String(nodeId);
        plugin.state.nodeId = String(nodeId || "");
        if (changed) plugin.resetResult();
        if (plugin.state.access && plugin.state.access.allowed && plugin.state.ui && plugin.state.ui.showOnDevice) plugin.ensureDeviceIntegration();
    };

    plugin.onNativePageStart = function () {
        if (plugin.state.standaloneActive) plugin.closeStandalone(true);
    };

    plugin.onNativePageEnd = function (view) {
        if (plugin.state.access && plugin.state.access.allowed && plugin.state.ui && plugin.state.ui.showInMenu) plugin.ensureMenus();
        if (plugin.state.access && plugin.state.access.allowed && plugin.state.ui && plugin.state.ui.showOnDevice && plugin.state.nodeId) plugin.ensureDeviceTab();
        plugin.updateDeviceTab(view);
    };

    plugin.loadCatalog = function () {
        if (plugin.state.catalog) return Promise.resolve(plugin.state.catalog);
        return core.apiRequest(window.MyCompanyAssetUrl("commands", "catalog")).then(function (result) { plugin.state.catalog = result.catalog || {}; return plugin.state.catalog; });
    };

    plugin.loadScripts = function (force) {
        if (plugin.state.scripts && !force) return Promise.resolve(plugin.state.scripts);
        return core.apiRequest(window.MyCompanyAssetUrl("commands", "scripts")).then(function (result) { plugin.state.scripts = result.tree || null; return plugin.state.scripts; });
    };

    plugin.allowedCategoryKeys = function () {
        var categories = plugin.state.access && plugin.state.access.categories || {};
        return ["scripts", "network", "system", "other", "settings"].filter(function (key) { return categories[key] === true || (key === "settings" && plugin.state.access && plugin.state.access.siteAdmin); });
    };

    plugin.createTabs = function (root) {
        var tabs = document.createElement("table");
        tabs.className = "style1 mycommands-tabs";
        var row = tabs.insertRow();
        plugin.allowedCategoryKeys().forEach(function (key) {
            var cell = row.insertCell();
            cell.id = "MyCommandsTab-" + key;
            cell.className = "topbar_td " + (plugin.state.category === key ? "style3sel" : "style3x");
            cell.tabIndex = 0;
            cell.textContent = key === "settings" ? "Settings" : key.charAt(0).toUpperCase() + key.slice(1);
            cell.onmouseup = function () { plugin.selectCategory(key); };
            cell.onkeypress = function (event) { if (event && event.key === "Enter") plugin.selectCategory(key); };
            mark(cell, "Category " + key);
        });
        root.appendChild(tabs);
    };

    plugin.renderDevicePage = function () {
        var root = document.getElementById("mycommands-device-page");
        if (!root) return;
        var allowedKeys = plugin.allowedCategoryKeys();
        if (allowedKeys.indexOf(plugin.state.category) < 0) plugin.state.category = allowedKeys[0] || "scripts";
        root.className = "mycommands-root";
        mark(root, "Commands page");
        root.innerHTML = "";
        plugin.createTabs(root);
        var layout = document.createElement("div"); layout.className = "mycommands-device-layout"; root.appendChild(layout);
        var content = document.createElement("div"); content.id = "MyCommandsContent"; content.className = "mycommands-content"; layout.appendChild(content);
        var result = document.createElement("div"); result.id = "MyCommandsResult"; result.className = "mycommands-result-panel"; layout.appendChild(result);
        plugin.renderCategory();
        plugin.renderResult();
    };

    plugin.selectCategory = function (key) {
        if (plugin.allowedCategoryKeys().indexOf(key) < 0) return;
        plugin.state.category = key;
        plugin.state.selected = null;
        var root = document.getElementById("mycommands-device-page");
        if (root) plugin.renderDevicePage();
        if (key === "settings") plugin.loadSettings();
    };

    plugin.renderCategory = function () {
        var content = document.getElementById("MyCommandsContent");
        if (!content) return;
        content.innerHTML = "";
        if (plugin.state.category === "settings") { content.appendChild(plugin.buildSettings()); plugin.loadSettings(); return; }
        if (plugin.state.category === "scripts") { plugin.renderScripts(content); return; }
        if (plugin.state.category === "custom") { content.textContent = "This tab has been removed."; return; }
        content.textContent = "Loading commands...";
        plugin.loadCatalog().then(function (catalog) {
            content.innerHTML = "";
            var category = catalog[plugin.state.category];
            if (!category) { content.textContent = "No commands are configured."; return; }
            var list = document.createElement("div"); list.className = "mycommands-item-list";
            category.commands.forEach(function (command) {
                var row = document.createElement("div"); row.className = "mycommands-item-row";
                var action = document.createElement("div"); action.className = "mycommands-item-action"; var actionButton = button(command.label, function () { plugin.chooseCommand(command); }, modernUi() ? "btn btn-primary btn-sm" : ""); actionButton.title = command.description || command.label; action.appendChild(actionButton); row.appendChild(action); list.appendChild(row);
            });
            content.appendChild(list);
        }).catch(function (error) { content.textContent = error.message || "Could not load commands."; });
    };

    plugin.chooseCommand = function (command) {
        plugin.state.selected = { kind: "preset", item: command };
        if (!command.variables || !command.variables.length) { plugin.run({ pluginaction: "runPreset", commandId: command.id, variableValues: {} }); return; }
        plugin.renderVariableForm();
    };

    plugin.renderVariableForm = function () {
        var content = document.getElementById("MyCommandsContent");
        var selected = plugin.state.selected;
        if (!content || !selected || !selected.item) return;
        var old = document.getElementById("MyCommandsVariableForm"); if (old && old.parentNode) old.parentNode.removeChild(old);
        var form = document.createElement("div"); form.id = "MyCommandsVariableForm"; form.className = "mycommands-variable-form";
        var title = document.createElement("strong"); title.textContent = selected.item.label || selected.item.name; form.appendChild(title);
        if (selected.item.summary || selected.item.description) { var summary = document.createElement("p"); summary.textContent = selected.item.summary || selected.item.description; form.appendChild(summary); }
        (selected.item.variables || []).forEach(function (variable, index) {
            var label = document.createElement("label"); label.textContent = variable.label + (variable.required ? " *" : ""); label.htmlFor = "MyCommandsVariable-" + index; form.appendChild(label);
            var input;
            if (variable.control === "switch" || variable.control === "select") {
                input = document.createElement("select");
                var values = variable.control === "switch" ? ["true", "false"] : (variable.options || []);
                values.forEach(function (value) { var option = document.createElement("option"); option.value = value; option.textContent = variable.control === "switch" ? (value === "true" ? "Yes" : "No") : value; input.appendChild(option); });
            } else { input = document.createElement("input"); input.type = "text"; }
            input.id = "MyCommandsVariable-" + index; input.value = variable.defaultValue || ""; input.setAttribute("data-variable-name", variable.name); if (variable.required) input.required = true; form.appendChild(input);
        });
        form.appendChild(button(selected.kind === "script" && selected.item.requiresApproval !== true ? "Run script" : (selected.kind === "script" ? "Request script" : "Request command"), plugin.runSelected, modernUi() ? "btn btn-primary btn-sm" : ""));
        var error = document.createElement("span"); error.id = "MyCommandsVariableError"; error.className = "mycommands-status mycommands-error"; form.appendChild(error);
        content.appendChild(form);
    };

    plugin.runSelected = function () {
        var selected = plugin.state.selected;
        if (!selected || !selected.item) return;
        var values = {};
        var missing = [];
        (selected.item.variables || []).forEach(function (variable, index) {
            var input = document.getElementById("MyCommandsVariable-" + index); var value = input ? String(input.value || "") : ""; values[variable.name] = value; if (variable.required && !value.trim()) missing.push(variable.label);
        });
        var error = document.getElementById("MyCommandsVariableError");
        if (missing.length) { if (error) error.textContent = "Complete the required fields: " + missing.join(", "); return; }
        plugin.run(selected.kind === "script" ? { pluginaction: "runScript", scriptPath: selected.item.path, variableValues: values, direct: selected.item.requiresApproval !== true } : { pluginaction: "runPreset", commandId: selected.item.id, variableValues: values });
    };

    plugin.renderScripts = function (content) {
        var toolbar = document.createElement("div"); toolbar.className = "mycommands-script-toolbar";
        var collapse = document.createElement("button"); collapse.type = "button"; collapse.className = "btn btn-secondary btn-sm mycommands-toolbar-button"; collapse.onclick = function () { plugin.state.folderMenuCollapsed = !plugin.state.folderMenuCollapsed; plugin.saveUiPrefs(); plugin.updateScriptToolbar(); }; toolbar.appendChild(collapse);
        var searchToggle = document.createElement("button"); searchToggle.type = "button"; searchToggle.className = "btn btn-secondary btn-sm mycommands-toolbar-button"; searchToggle.onclick = function () { plugin.state.searchVisible = !plugin.state.searchVisible; plugin.saveUiPrefs(); plugin.updateScriptToolbar(); }; toolbar.appendChild(searchToggle);
        var searchHost = document.createElement("div"); searchHost.className = "mycommands-script-search"; var search = document.createElement("input"); search.type = "search"; search.id = "MyCommandsScriptSearch"; search.placeholder = "Search"; search.value = plugin.state.scriptFilter; search.oninput = function () { plugin.state.scriptFilter = search.value; window.clearTimeout(search._mycommandsTimer); search._mycommandsTimer = window.setTimeout(plugin.renderScriptTree, 120); }; searchHost.appendChild(search); toolbar.appendChild(searchHost); content.appendChild(toolbar);
        var layout = document.createElement("div"); layout.className = "mycommands-script-layout"; var roots = document.createElement("nav"); roots.id = "MyCommandsScriptRoots"; roots.className = "mycommands-script-roots"; roots.setAttribute("aria-label", "Script folders"); var tree = document.createElement("div"); tree.id = "MyCommandsScriptTree"; tree.className = "mycommands-script-content"; layout.appendChild(roots); layout.appendChild(tree); content.appendChild(layout);
        plugin.updateScriptToolbar();
        plugin.loadScripts(false).then(plugin.renderScriptTree).catch(function (error) { tree.textContent = error.message || "Could not load scripts."; });
    };

    plugin.updateScriptToolbar = function () {
        var buttons = document.querySelectorAll("#MyCommandsContent .mycommands-toolbar-button"), search = document.querySelector("#MyCommandsContent .mycommands-script-search"), roots = document.getElementById("MyCommandsScriptRoots"), layout = document.querySelector("#MyCommandsContent .mycommands-script-layout");
        if (buttons[0]) { buttons[0].textContent = plugin.state.folderMenuCollapsed ? "▶" : "◀"; buttons[0].title = plugin.state.folderMenuCollapsed ? "Expand folders" : "Collapse folders"; }
        if (buttons[1]) { buttons[1].textContent = "⌕"; buttons[1].title = plugin.state.searchVisible ? "Hide search" : "Show search"; }
        if (search) search.hidden = !plugin.state.searchVisible;
        if (roots) roots.classList.toggle("mycommands-script-roots-collapsed", plugin.state.folderMenuCollapsed);
        if (layout) layout.classList.toggle("mycommands-script-layout-collapsed", plugin.state.folderMenuCollapsed);
    };

    plugin.folderIcon = function (name) {
        var key = String(name || "").toLowerCase();
        if (key.indexOf("network") >= 0) return "🌐";
        if (key.indexOf("system") >= 0) return "⚙";
        if (key.indexOf("active") >= 0 || key.indexOf("directory") >= 0) return "♟";
        if (key.indexOf("server") >= 0) return "▤";
        if (key.indexOf("other") >= 0) return "◆";
        return "📁";
    };

    plugin.renderScriptTree = function () {
        var root = document.getElementById("MyCommandsScriptTree"), roots = document.getElementById("MyCommandsScriptRoots");
        if (!root || !roots) return;
        root.innerHTML = ""; roots.innerHTML = "";
        var query = String(plugin.state.scriptFilter || "").toLowerCase();
        function contains(node) {
            if (!query) return true;
            if (node.type === "script") return [node.name, node.path, node.summary].join(" ").toLowerCase().indexOf(query) >= 0;
            return (node.children || []).some(contains);
        }
        function renderNode(node, host, skipFolderHeader) {
            if (!contains(node)) return;
            if (node.type === "script") {
                var row = document.createElement("div"); row.className = "mycommands-item-row mycommands-script-row";
                var action = document.createElement("div"); action.className = "mycommands-item-action"; var item = document.createElement("button"); item.type = "button"; item.className = "mycommands-script"; item.title = node.summary || node.path; var label = document.createElement("span"); label.textContent = node.name; item.appendChild(label); if (node.requiresApproval === true) { var approval = document.createElement("span"), levels = node.approvalLevels || [1]; approval.className = "mycommands-approval-indicator"; approval.textContent = "⏳"; approval.title = "Requires approval levels: " + levels.join(", "); approval.setAttribute("aria-label", approval.title); item.appendChild(approval); } item.onclick = function () { plugin.state.selected = { kind: "script", item: node }; plugin.renderResult(); if (node.variables && node.variables.length) plugin.renderVariableForm(); else plugin.run({ pluginaction: "runScript", scriptPath: node.path, variableValues: {}, direct: node.requiresApproval !== true }); }; action.appendChild(mark(item, "Script " + node.path));
                row.appendChild(action); host.appendChild(row); return;
            }
            if (skipFolderHeader) { (node.children || []).forEach(function (child) { renderNode(child, host, false); }); return; }
            var details = document.createElement("details"); details.open = !!query;
            var summary = document.createElement("summary"); summary.textContent = node.name; details.appendChild(summary);
            var children = document.createElement("div"); children.className = "mycommands-script-children"; (node.children || []).forEach(function (child) { renderNode(child, children); }); details.appendChild(children); host.appendChild(details);
        }
        var folders = plugin.state.scripts && (plugin.state.scripts.children || []).filter(function (node) { return node.type === "directory" && contains(node); }) || [];
        if (!folders.length) { root.textContent = "No script folders were found."; return; }
        if (!plugin.state.selectedRoot || !folders.some(function (folder) { return folder.path === plugin.state.selectedRoot; })) plugin.state.selectedRoot = folders[0].path;
        folders.forEach(function (folder) { var item = document.createElement("button"); item.type = "button"; item.className = "mycommands-root-button" + (folder.path === plugin.state.selectedRoot ? " active" : ""); item.title = folder.name; var icon = document.createElement("span"); icon.className = "mycommands-root-icon"; icon.textContent = plugin.folderIcon(folder.name); item.appendChild(icon); var label = document.createElement("span"); label.className = "mycommands-root-label"; label.textContent = folder.name; item.appendChild(label); item.onclick = function () { plugin.state.selectedRoot = folder.path; plugin.renderScriptTree(); }; roots.appendChild(item); });
        var selectedFolder = folders.filter(function (folder) { return folder.path === plugin.state.selectedRoot; })[0];
        if (selectedFolder) renderNode(selectedFolder, root, true);
        if (!root.childNodes.length) root.textContent = "This folder contains no matching scripts.";
        plugin.updateScriptToolbar();
    };

    plugin.renderCustom = function (content) {
        var form = document.createElement("div"); form.className = "mycommands-custom";
        var typeLabel = document.createElement("label"); typeLabel.textContent = "Command type"; form.appendChild(typeLabel);
        var type = document.createElement("select"); type.id = "MyCommandsCustomType"; [{ value: "2", text: "PowerShell" }, { value: "1", text: "CMD" }].forEach(function (item) { var option = document.createElement("option"); option.value = item.value; option.textContent = item.text; type.appendChild(option); }); form.appendChild(type);
        var runLabel = document.createElement("label"); runLabel.textContent = "Run as"; form.appendChild(runLabel);
        var runAs = document.createElement("select"); runAs.id = "MyCommandsCustomRunAs"; [{ value: "0", text: "Agent" }, { value: "1", text: "Interactive user" }, { value: "2", text: "Interactive GUI" }].forEach(function (item) { var option = document.createElement("option"); option.value = item.value; option.textContent = item.text; runAs.appendChild(option); }); form.appendChild(runAs);
        var commandLabel = document.createElement("label"); commandLabel.textContent = "Command"; form.appendChild(commandLabel);
        var command = document.createElement("textarea"); command.id = "MyCommandsCustomText"; command.rows = 8; form.appendChild(command);
        form.appendChild(button("Request command", function () { plugin.run({ pluginaction: "runCustom", type: Number(type.value), runAsUser: Number(runAs.value), cmds: command.value, variableValues: {} }); }, modernUi() ? "btn btn-primary btn-sm" : ""));
        content.appendChild(form);
    };

    plugin.closeApprovalDialog = function () {
        var modal = document.getElementById("xxAddAgentModal"), cancel = document.getElementById("idx_dlgCancelButton");
        if (modal && document.activeElement && modal.contains(document.activeElement) && typeof document.activeElement.blur === "function") document.activeElement.blur();
        if (cancel) cancel.click();
    };

    plugin.run = function (request) {
        if (plugin.state.running) { plugin.setStatus("Another request is being submitted.", true); return; }
        if (!plugin.state.nodeId) { plugin.setStatus("No device is selected.", true); return; }
        if (request && request.direct === true) {
            plugin.state.running = true; plugin.setStatus("Running script...", false);
            core.apiRequest(window.MyCompanyAssetUrl("commands", "direct"), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: "nodeid=" + encodeURIComponent(plugin.state.nodeId) + "&pluginaction=runScript&scriptPath=" + encodeURIComponent(request.scriptPath || "") + "&variableValues=" + encodeURIComponent(JSON.stringify(request.variableValues || {})) }).then(function (result) { plugin.state.running = false; var output = result.result && result.result.message || "Script completed."; plugin.setStatus(output, false); }).catch(function (error) { plugin.state.running = false; plugin.setStatus(error.message || "Could not run script.", true); });
            return;
        }
        if (!plugin.state.config || plugin.state.config.approvalAvailable !== true) {
            plugin.setStatus("Approval Center is required. Install it from: " + String(plugin.state.config && plugin.state.config.approvalCenterInstallUrl || ""), true);
            return;
        }
        var modern = modernUi() && document.getElementById("xxAddAgentModal");
        var html = modern
            ? '<div id="MyCommandsApprovalDialog" data-meshcentral-plugin-pin="mycommands" data-meshcentral-plugin-click="Approval dialog"><p class="mb-4">The command will run only after it is approved in Approval Center.</p><div class="row mb-1"><div class="form-floating mb-3 col-md-12"><textarea id="MyCommandsRequesterNote" class="form-control" maxlength="2000" placeholder="Requester Note" style="height:100px"></textarea><label class="ms-2" for="MyCommandsRequesterNote">Requester Note</label></div></div><div id="MyCommandsApprovalStatus" class="small text-muted" role="status"></div></div>'
            : '<div id="MyCommandsApprovalDialog" data-meshcentral-plugin-pin="mycommands" data-meshcentral-plugin-click="Approval dialog"><p>The command will run only after it is approved in Approval Center.</p><label for="MyCommandsRequesterNote">Requester Note</label><textarea id="MyCommandsRequesterNote" rows="4" maxlength="2000" style="display:block;margin-top:4px;min-width:280px"></textarea><div id="MyCommandsApprovalStatus" style="margin-top:8px" role="status"></div></div>';
        var submit = function () {
            if (plugin.state.running) return false;
            var note = document.getElementById("MyCommandsRequesterNote"), status = document.getElementById("MyCommandsApprovalStatus"), ok = document.getElementById("idx_dlgOkButton");
            plugin.resetResult();
            plugin.state.running = true;
            if (ok) ok.disabled = true;
            if (status) { status.textContent = "Submitting request..."; status.className = modern ? "small text-muted" : ""; }
            core.apiRequest(window.MyCompanyAssetUrl("commands", "submit"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
                body: "nodeid=" + encodeURIComponent(plugin.state.nodeId) +
                    "&pluginaction=" + encodeURIComponent(request.pluginaction || "") +
                    "&commandId=" + encodeURIComponent(request.commandId || "") +
                    "&scriptPath=" + encodeURIComponent(request.scriptPath || "") +
                    "&type=" + encodeURIComponent(request.type || 2) +
                    "&runAsUser=" + encodeURIComponent(request.runAsUser || 0) +
                    "&cmds=" + encodeURIComponent(request.cmds || "") +
                    "&variableValues=" + encodeURIComponent(JSON.stringify(request.variableValues || {})) +
                    "&note=" + encodeURIComponent(note ? note.value : "")
            }).then(function () {
                plugin.state.running = false;
                plugin.setStatus("Request submitted to Approval Center.", false);
                if (modern) plugin.closeApprovalDialog();
            }).catch(function (error) {
                plugin.state.running = false;
                if (modern) {
                    if (ok) ok.disabled = false;
                    if (status) { status.textContent = error.message || "Could not submit request."; status.className = "small text-danger"; }
                } else if (typeof window.setDialogMode === "function") {
                    window.setDialogMode(2, "My Commands", 1, null, '<div style="color:#b00020">' + String(error.message || "Could not submit request.").replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]; }) + "</div>");
                }
            });
            return false;
        };
        if (modern) {
            window.setModalContent("xxAddAgent", "Submit for approval", html);
            window.showModal("xxAddAgentModal", "idx_dlgOkButton", submit);
        } else if (typeof window.setDialogMode === "function") {
            window.setDialogMode(2, "Submit for approval", 3, function (confirmed) { if (confirmed) submit(); }, html);
        }
    };

    plugin.commandResult = function (message) {
        if (!message || message.responseid !== plugin.state.responseId) return;
        if (!message.ok) { plugin.stopPolling(); plugin.state.running = false; plugin.setStatus(message.error || "Could not start the command.", true); }
        else plugin.setStatus("Command sent. Waiting for output...", false);
    };

    plugin.startPolling = function () {
        plugin.stopPolling();
        var poll = function () {
            if (!plugin.state.responseId) return;
            core.apiRequest(window.MyCompanyAssetUrl("commands", "output") + "&responseid=" + encodeURIComponent(plugin.state.responseId)).then(function (result) {
                plugin.consumeOutput(result.output || "", result.ready === true);
                if (result.ready) { plugin.stopPolling(); plugin.state.running = false; }
            }).catch(function () { });
        };
        poll();
        plugin.state.pollTimer = window.setInterval(poll, 1000);
    };

    plugin.stopPolling = function () { if (plugin.state.pollTimer) window.clearInterval(plugin.state.pollTimer); plugin.state.pollTimer = null; };

    plugin.decodeUtf8Base64 = function (value) {
        try {
            var binary = window.atob(value); var bytes = new Uint8Array(binary.length); for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
            if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
            var escaped = ""; for (var i = 0; i < bytes.length; i++) escaped += "%" + bytes[i].toString(16).padStart(2, "0"); return decodeURIComponent(escaped);
        } catch (error) { return ""; }
    };

    plugin.consumeOutput = function (raw, ready) {
        var text = String(raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        var begin = text.indexOf("__MYCOMMANDS_BEGIN__"), end = text.indexOf("__MYCOMMANDS_END__");
        if (begin >= 0) text = text.slice(begin + "__MYCOMMANDS_BEGIN__".length);
        if (end >= 0) text = text.slice(0, text.indexOf("__MYCOMMANDS_END__"));
        var output = [];
        text.split("\n").forEach(function (line) {
            var trimmed = line.trim();
            var progress = trimmed.match(/^__(?:MYCOMMANDS|COMMANDTABS)_PROGRESS__\s+(.+)$/i);
            var table = trimmed.match(/^__MYCOMMANDS_TABLE_B64__(.+)$/i);
            if (progress) { plugin.state.progress = progress[1]; return; }
            if (table) { try { plugin.state.table = JSON.parse(plugin.decodeUtf8Base64(table[1])); plugin.state.tablePage = 1; } catch (error) { output.push("[error] Invalid table data."); } return; }
            if (!/^__MYCOMMANDS_(?:BEGIN|END)__$/.test(trimmed)) output.push(line);
        });
        plugin.state.output = output.join("\n").replace(/^\s+|\s+$/g, "");
        plugin.renderResult();
        if (ready) plugin.setStatus("Command completed.", false);
        else if (plugin.state.progress) plugin.setStatus("Progress: " + plugin.state.progress, false);
    };

    plugin.resetResult = function () {
        plugin.stopPolling();
        plugin.state.running = false;
        plugin.state.responseId = "";
        plugin.state.output = "";
        plugin.state.progress = "";
        plugin.state.table = null;
        plugin.state.tablePage = 1;
        plugin.renderResult();
    };

    plugin.setStatus = function (message, error) {
        var status = document.getElementById("MyCommandsRunStatus");
        if (status) { status.textContent = message || ""; status.className = "mycommands-status " + (error ? "mycommands-error" : ""); }
        var selected = plugin.state.selected && plugin.state.selected.item;
        if (selected) {
            var key = plugin.state.selected.kind === "script" ? "script:" + selected.path : "command:" + selected.id;
            plugin.state.resultByKey[key] = message || "";
            plugin.state.output = message || "";
            plugin.renderResult();
        }
    };

    plugin.normalizeTable = function (value) {
        var rows = [], columns = [];
        if (value && Array.isArray(value.rows)) { rows = value.rows; columns = Array.isArray(value.columns) ? value.columns.map(String) : []; }
        else if (Array.isArray(value)) rows = value;
        else if (value != null) rows = [value];
        rows = rows.map(function (row) { return row && typeof row === "object" && !Array.isArray(row) ? row : { Value: row }; });
        if (!columns.length) rows.forEach(function (row) { Object.keys(row).forEach(function (key) { if (columns.indexOf(key) < 0) columns.push(key); }); });
        return { columns: columns, rows: rows };
    };

    plugin.renderTable = function (host) {
        var data = plugin.normalizeTable(plugin.state.table);
        var toolbar = document.createElement("div"); toolbar.className = "mycommands-table-toolbar";
        var search = document.createElement("input"); search.type = "search"; search.placeholder = "Search table"; search.value = plugin.state.tableQuery; search.oninput = function () { plugin.state.tableQuery = search.value; plugin.state.tablePage = 1; plugin.renderResult(); }; toolbar.appendChild(search);
        var sizeLabel = document.createElement("label"); sizeLabel.textContent = "Per page "; var size = document.createElement("select"); [20, 50].forEach(function (count) { var option = document.createElement("option"); option.value = count; option.textContent = count; size.appendChild(option); }); size.value = plugin.state.tablePageSize; size.onchange = function () { plugin.state.tablePageSize = Number(size.value); plugin.state.tablePage = 1; plugin.renderResult(); }; sizeLabel.appendChild(size); toolbar.appendChild(sizeLabel); host.appendChild(toolbar);
        var query = plugin.state.tableQuery.toLowerCase();
        var rows = data.rows.filter(function (row) { return !query || data.columns.some(function (column) { return String(row[column] == null ? "" : row[column]).toLowerCase().indexOf(query) >= 0; }); });
        var pages = Math.max(1, Math.ceil(rows.length / plugin.state.tablePageSize)); if (plugin.state.tablePage > pages) plugin.state.tablePage = pages;
        var visible = rows.slice((plugin.state.tablePage - 1) * plugin.state.tablePageSize, plugin.state.tablePage * plugin.state.tablePageSize);
        var table = document.createElement("table"); table.className = modernUi() ? "table table-hover table-striped align-middle mycommands-data-table" : "style1 mycommands-data-table"; table.style.width = "100%";
        var head = table.createTHead().insertRow(); data.columns.forEach(function (column) { var th = document.createElement("th"); th.textContent = column; head.appendChild(th); });
        var body = table.createTBody(); visible.forEach(function (row) { var tr = body.insertRow(); data.columns.forEach(function (column) { var td = tr.insertCell(); var value = row[column]; td.textContent = value == null ? "" : (typeof value === "object" ? JSON.stringify(value) : String(value)); }); });
        host.appendChild(table);
        var pager = document.createElement("div"); pager.className = "mycommands-pager";
        var previous = button("Previous", function () { if (plugin.state.tablePage > 1) { plugin.state.tablePage--; plugin.renderResult(); } }); previous.disabled = plugin.state.tablePage <= 1;
        var label = document.createElement("span"); label.textContent = "Page " + plugin.state.tablePage + " of " + pages + " (" + rows.length + ")";
        var next = button("Next", function () { if (plugin.state.tablePage < pages) { plugin.state.tablePage++; plugin.renderResult(); } }); next.disabled = plugin.state.tablePage >= pages;
        pager.appendChild(previous); pager.appendChild(label); pager.appendChild(next); host.appendChild(pager);
    };

    plugin.renderResult = function () {
        var root = document.getElementById("MyCommandsResult");
        if (!root) return;
        root.innerHTML = "";
        var status = document.createElement("span"); status.id = "MyCommandsRunStatus"; status.className = "mycommands-status"; status.textContent = plugin.state.running ? (plugin.state.progress ? "Progress: " + plugin.state.progress : "Command is running...") : ""; root.appendChild(status);
        if (plugin.state.table) { var tableHost = document.createElement("div"); tableHost.className = "mycommands-table-host"; root.appendChild(tableHost); plugin.renderTable(tableHost); }
        var output = document.createElement("textarea"); output.className = "mycommands-output"; output.readOnly = true; output.placeholder = "Select a command or script to see its result."; output.value = plugin.state.output || ""; root.appendChild(output);
    };

    plugin.buildStandalone = function (body) {
        body.innerHTML = "";
        var tabs = document.createElement("table"); tabs.className = "style1"; var row = tabs.insertRow(); var mainTab = row.insertCell(); var settingsTab = row.insertCell();
        mainTab.textContent = "Main"; settingsTab.textContent = "Settings"; mainTab.className = "topbar_td style3sel"; settingsTab.className = "topbar_td style3x"; mark(mainTab, "Main"); mark(settingsTab, "Settings"); body.appendChild(tabs);
        var main = document.createElement("div"); main.className = "mycommands-standalone"; main.textContent = "Open a device and select the Commands tab to run commands or scripts."; body.appendChild(main);
        var settings = plugin.buildSettings(); settings.style.display = "none"; body.appendChild(settings);
        mainTab.onmouseup = function () { main.style.display = ""; settings.style.display = "none"; mainTab.className = "topbar_td style3sel"; settingsTab.className = "topbar_td style3x"; };
        settingsTab.onmouseup = function () { if (!plugin.state.access.siteAdmin) return; main.style.display = "none"; settings.style.display = ""; mainTab.className = "topbar_td style3x"; settingsTab.className = "topbar_td style3sel"; plugin.loadSettings(); };
        settingsTab.style.display = plugin.state.access.siteAdmin ? "" : "none";
    };

    plugin.openStandalone = function (event) {
        if (event && ((event.which === 3) || (event.button === 2))) return false;
        if (!plugin.state.access || !plugin.state.access.allowed || !plugin.state.ui.showInMenu) return false;
        if (typeof window.go === "function") window.go(1);
        var page = document.getElementById("p1"), title = document.getElementById("p1title"); if (!page || !title) return false;
        var body = document.getElementById("MyCommandsStandalone"); if (!body) { body = document.createElement("div"); body.id = "MyCommandsStandalone"; page.appendChild(body); }
        plugin.buildStandalone(body);
        var heading = title.querySelector("h1") || title.querySelector(".fs-4"); var hidden = [];
        for (var child = page.firstElementChild; child; child = child.nextElementSibling) if (child !== title && child !== body) hidden.push(core.hideNativeElement(child));
        plugin.state.nativeState = { heading: heading, text: heading ? heading.textContent : "", hidden: hidden };
        if (heading) heading.textContent = plugin.state.config.name;
        body.style.display = ""; page.style.display = ""; plugin.state.standaloneActive = true; window.xxcurrentView = plugin.state.config.viewMode;
        var url = new URL(window.location.href); url.searchParams.set("viewmode", String(plugin.state.config.viewMode)); window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        core.setPluginMenuActive(document.getElementById("MainMenuMyCommands"), document.getElementById("LeftMenuMyCommands"), true);
        if (event && event.preventDefault) event.preventDefault(); return false;
    };

    plugin.closeStandalone = function (clearUrl) {
        var state = plugin.state.nativeState;
        if (state) { if (state.heading) state.heading.textContent = state.text; state.hidden.forEach(core.restoreNativeElement); }
        var body = document.getElementById("MyCommandsStandalone"); if (body) body.style.display = "none";
        plugin.state.nativeState = null; plugin.state.standaloneActive = false; core.setPluginMenuActive(document.getElementById("MainMenuMyCommands"), document.getElementById("LeftMenuMyCommands"), false);
        if (clearUrl) { var url = new URL(window.location.href); if (Number(url.searchParams.get("viewmode")) === plugin.state.config.viewMode) url.searchParams.delete("viewmode"); window.history.replaceState({}, document.title, url.pathname + url.search + url.hash); }
    };
}());
