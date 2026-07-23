(function () {
    "use strict";

    var root = document.getElementById("sirk-platform-admin");
    if (!root || window.__sirkPlatformApprovalPolicyUi) return;
    window.__sirkPlatformApprovalPolicyUi = true;

    var data = window.SirkPlatformAdminData || {};
    var titleMap = {
        "Move Requests": "moverequests",
        "My Commands": "mycommands",
        "My Scripts": "myscripts"
    };

    function configured(type) {
        var modules = data.moduleSettings || {};
        var approval = modules.approvalcenter || {};
        var providers = approval.providers || {};
        return providers[type] && providers[type].allowNoApproval === true;
    }

    function inject() {
        Array.prototype.forEach.call(
            root.querySelectorAll(".mc-admin-settings-panel .mc-admin-card"),
            function (card) {
                var panel = card.closest(".mc-admin-settings-panel");
                var panelHeading = panel && panel.querySelector(".mc-admin-section-header h3");
                if (!panelHeading || !/^approval\s*center$/i.test(String(panelHeading.textContent || "").trim())) return;
                var heading = card.querySelector("h3");
                var type = heading && titleMap[String(heading.textContent || "").trim()];
                if (!type || card.querySelector('[data-sirk-platform-noapproval="' + type + '"]')) return;
                var label = document.createElement("label");
                label.className = "mc-admin-check mc-admin-noapproval";
                label.setAttribute("data-sirk-platform-noapproval", type);
                var input = document.createElement("input");
                input.type = "checkbox";
                input.checked = configured(type);
                var text = document.createElement("span");
                var strong = document.createElement("strong");
                strong.textContent = "No approval required";
                var small = document.createElement("small");
                small.textContent = "Explicitly allow immediate execution when the script does not declare approval levels.";
                text.appendChild(strong);
                text.appendChild(small);
                label.appendChild(input);
                label.appendChild(text);
                card.insertBefore(label, card.firstChild.nextSibling);
            }
        );
    }

    function selectedPolicies() {
        var result = {};
        Array.prototype.forEach.call(
            root.querySelectorAll(".mc-admin-settings-panel [data-sirk-platform-noapproval]"),
            function (label) {
                var type = label.getAttribute("data-sirk-platform-noapproval");
                var input = label.querySelector('input[type="checkbox"]');
                result[type] = !!(input && input.checked);
            }
        );
        return result;
    }

    function applyPolicies(moduleOptions) {
        moduleOptions = moduleOptions && typeof moduleOptions === "object" ? moduleOptions : {};
        moduleOptions.approvalcenter = moduleOptions.approvalcenter || {};
        moduleOptions.approvalcenter.providers = moduleOptions.approvalcenter.providers || {};
        var policies = selectedPolicies();
        Object.keys(policies).forEach(function (type) {
            moduleOptions.approvalcenter.providers[type] = moduleOptions.approvalcenter.providers[type] || {};
            moduleOptions.approvalcenter.providers[type].allowNoApproval = policies[type];
        });
        return moduleOptions;
    }

    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
        try {
            var url = new URL(typeof input === "string" ? input : input.url, window.location.href);
            if (/pluginadmin\.ashx$/i.test(url.pathname) && init && typeof init.body === "string") {
                var body = new URLSearchParams(init.body);
                if (url.searchParams.get("action") === "save-settings" && body.has("moduleOptions")) {
                    var moduleOptions = JSON.parse(body.get("moduleOptions") || "{}");
                    body.set("moduleOptions", JSON.stringify(applyPolicies(moduleOptions)));
                    init = Object.assign({}, init, { body: body.toString() });
                }
                if (url.searchParams.get("module") === "approvalcenter" && url.searchParams.get("asset") === "settings" && body.has("payload")) {
                    var payload = JSON.parse(body.get("payload") || "{}");
                    payload = applyPolicies({ approvalcenter: payload }).approvalcenter;
                    body.set("payload", JSON.stringify(payload));
                    init = Object.assign({}, init, { body: body.toString() });
                }
            }
        } catch (error) {}
        return originalFetch.call(this, input, init);
    };

    new MutationObserver(inject).observe(root, { childList: true, subtree: true });
    inject();
}());
