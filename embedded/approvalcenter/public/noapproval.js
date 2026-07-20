(function () {
    "use strict";

    if (!window.ApprovalCenter || !window.MeshPluginCore) return;
    var plugin = window.ApprovalCenter;
    var core = window.MeshPluginCore;
    if (plugin.__noApprovalPatchInstalled) return;
    plugin.__noApprovalPatchInstalled = true;

    function isApprovalRequest(parsed, asset) {
        var pin = parsed.searchParams.get("pin");
        var moduleName = parsed.searchParams.get("module");
        return parsed.searchParams.get("asset") === asset &&
            (pin === "approvalcenter" || (pin === "mycompany" && moduleName === "approvals"));
    }

    var originalApiRequest = core.apiRequest;
    core.apiRequest = function (url, options) {
        options = options || {};
        try {
            var parsed = new URL(url, window.location.href);
            if (isApprovalRequest(parsed, "provider-settings") && typeof options.body === "string") {
                var params = new URLSearchParams(options.body);
                var type = params.get("type") || "";
                var checkbox = document.querySelector('input[data-approvalcenter-noapproval="' + CSS.escape(type) + '"]');
                params.set("allowNoApproval", checkbox && checkbox.checked ? "1" : "0");
                options = Object.assign({}, options, { body: params.toString() });
            }
        } catch (error) { }
        return originalApiRequest.call(core, url, options);
    };

    function updateDisabledState(content, checkbox) {
        var disabled = !!checkbox.checked;
        Array.prototype.forEach.call(content.querySelectorAll(".approvalcenter-group-checkboxes input[type=checkbox]"), function (input) {
            input.disabled = disabled;
        });
        Array.prototype.forEach.call(content.querySelectorAll(".approvalcenter-group-checkboxes"), function (box) {
            box.style.opacity = disabled ? "0.45" : "";
        });
    }

    function injectCheckboxes() {
        var settings = plugin.__lastSettings;
        if (!settings || !Array.isArray(settings.providers)) return;
        var sections = document.querySelectorAll("#ApprovalCenterSettingsHost .approvalcenter-settings-section");
        settings.providers.forEach(function (provider, index) {
            var section = sections[index];
            if (!section) return;
            var content = section.querySelector(".approvalcenter-settings-content > div");
            if (!content || content.querySelector('input[data-approvalcenter-noapproval="' + CSS.escape(provider.type) + '"]')) return;

            var label = document.createElement("label");
            label.className = "approvalcenter-noapproval-option";
            label.style.display = "block";
            label.style.margin = "8px 0";
            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = provider.allowNoApproval === true;
            checkbox.setAttribute("data-approvalcenter-noapproval", provider.type);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(" No approval required"));

            var description = content.querySelector("p");
            if (description) content.insertBefore(label, description.nextSibling);
            else content.insertBefore(label, content.firstChild);

            checkbox.onchange = function () { updateDisabledState(content, checkbox); };
            updateDisabledState(content, checkbox);
        });
    }

    var originalLoadSettings = plugin.loadSettings;
    plugin.loadSettings = function () {
        var result = originalLoadSettings.apply(plugin, arguments);
        window.setTimeout(injectCheckboxes, 0);
        return result;
    };

    core.apiRequest = (function (wrapped) {
        return function (url, options) {
            var request = wrapped.call(core, url, options);
            try {
                var parsed = new URL(url, window.location.href);
                if (isApprovalRequest(parsed, "settings")) {
                    request.then(function (result) {
                        plugin.__lastSettings = result && result.settings || null;
                        window.setTimeout(injectCheckboxes, 0);
                    });
                }
            } catch (error) { }
            return request;
        };
    }(core.apiRequest));

    // Persistent MyCompany module navigation. Each embedded module rebuilds or
    // hides parts of p1, so the navigation is mounted directly inside the
    // currently visible module body instead of p1title.
    function isVisible(element) {
        if (!element) return false;
        var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
        if (style && (style.display === "none" || style.visibility === "hidden")) return false;
        return element.getClientRects().length > 0;
    }

    function currentTarget() {
        var scripts = document.getElementById("MyScriptsBody");
        if (isVisible(scripts)) return { host: scripts, key: "scripts" };

        var commands = document.getElementById("MyCommandsStandalone");
        if (isVisible(commands)) return { host: commands, key: "commands" };

        var approvals = document.getElementById("ApprovalCenterBody");
        if (isVisible(approvals)) {
            var activeTab = window.ApprovalCenter && window.ApprovalCenter.state && window.ApprovalCenter.state.activeTab;
            return { host: approvals, key: activeTab === "moverequest" ? "move" : "approvals" };
        }

        var workspace = document.getElementById("MyCompanyWorkspace");
        if (isVisible(workspace)) return { host: workspace, key: "settings" };
        return null;
    }

    function createNavigation() {
        var navigation = document.getElementById("MyCompanyPersistentNavigation");
        if (navigation) return navigation;

        navigation = document.createElement("div");
        navigation.id = "MyCompanyPersistentNavigation";
        navigation.style.display = "flex";
        navigation.style.flexWrap = "wrap";
        navigation.style.gap = "8px";
        navigation.style.alignItems = "center";
        navigation.style.position = "sticky";
        navigation.style.top = "0";
        navigation.style.zIndex = "100";
        navigation.style.boxSizing = "border-box";
        navigation.style.width = "100%";
        navigation.style.padding = "8px 0";
        navigation.style.margin = "0 0 10px 0";
        navigation.style.background = "var(--bs-body-bg, #202124)";
        navigation.style.borderBottom = "1px solid rgba(127,127,127,.35)";

        [
            ["Scripts", "scripts"],
            ["Commands", "commands"],
            ["Approvals", "approvals"],
            ["Move Requests", "move"],
            ["Settings", "settings"]
        ].forEach(function (pair) {
            var button = document.createElement("button");
            button.type = "button";
            button.textContent = pair[0];
            button.className = "btn btn-secondary btn-sm";
            button.setAttribute("data-mycompany-persistent-module", pair[1]);
            button.onclick = function (event) {
                if (event) {
                    if (event.preventDefault) event.preventDefault();
                    if (event.stopPropagation) event.stopPropagation();
                }
                if (window.MyCompany && typeof window.MyCompany.showModule === "function") {
                    return window.MyCompany.showModule(pair[1]);
                }
                return false;
            };
            navigation.appendChild(button);
        });
        return navigation;
    }

    function updateSelection(navigation, key) {
        Array.prototype.forEach.call(navigation.querySelectorAll("[data-mycompany-persistent-module]"), function (button) {
            var active = button.getAttribute("data-mycompany-persistent-module") === key;
            button.className = active ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm";
        });
    }

    function mountNavigation() {
        var oldNavigation = document.getElementById("MyCompanyNavigation");
        if (oldNavigation) oldNavigation.style.display = "none";

        var target = currentTarget();
        var navigation = createNavigation();
        if (!target) {
            navigation.style.display = "none";
            return;
        }

        navigation.style.display = "flex";
        updateSelection(navigation, target.key);
        if (navigation.parentNode !== target.host || target.host.firstChild !== navigation) {
            target.host.insertBefore(navigation, target.host.firstChild);
        }
    }

    var originalActivateTab = plugin.activateTab;
    plugin.activateTab = function () {
        var result = originalActivateTab.apply(plugin, arguments);
        window.setTimeout(mountNavigation, 0);
        return result;
    };

    var observer = new MutationObserver(function () {
        window.clearTimeout(observer._myCompanyTimer);
        observer._myCompanyTimer = window.setTimeout(mountNavigation, 20);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden", "class"] });

    window.setInterval(mountNavigation, 500);
    window.setTimeout(mountNavigation, 0);
    window.setTimeout(mountNavigation, 250);
    window.setTimeout(mountNavigation, 1000);
}());
