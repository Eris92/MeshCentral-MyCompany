(function () {
    "use strict";

    if (!window.ApprovalCenter || !window.MeshPluginCore) return;
    var plugin = window.ApprovalCenter;
    var core = window.MeshPluginCore;
    if (plugin.__noApprovalPatchInstalled) return;
    plugin.__noApprovalPatchInstalled = true;

    var originalApiRequest = core.apiRequest;
    core.apiRequest = function (url, options) {
        options = options || {};
        try {
            var parsed = new URL(url, window.location.href);
            if (parsed.searchParams.get("pin") === "approvalcenter" && parsed.searchParams.get("asset") === "provider-settings" && typeof options.body === "string") {
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
                if (parsed.searchParams.get("pin") === "approvalcenter" && parsed.searchParams.get("asset") === "settings") {
                    request.then(function (result) {
                        plugin.__lastSettings = result && result.settings || null;
                        window.setTimeout(injectCheckboxes, 0);
                    });
                }
            } catch (error) { }
            return request;
        };
    }(core.apiRequest));
}());
