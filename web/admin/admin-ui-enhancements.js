(function () {
    "use strict";

    var root = document.getElementById("sirk-platform-admin");
    var content = document.getElementById("sirk-platform-admin-content");
    if (!root || !content || window.__sirkPlatformAdminUiEnhancements) return;
    window.__sirkPlatformAdminUiEnhancements = true;

    var scheduled = false;
    var providerDefinitions = [
        {
            type: "moverequests",
            title: "Move Requests",
            description: "Approval workflow for moving devices between MeshCentral groups."
        },
        {
            type: "mycommands",
            title: "My Commands",
            description: "Approval workflow for commands and multi-device operations."
        },
        {
            type: "myscripts",
            title: "My Scripts",
            description: "Provider visibility and approver groups. Required levels are selected separately in each script definition."
        }
    ];

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function adminData() {
        return window.SirkPlatformAdminData || {};
    }

    function moduleAvailable(type) {
        var modules = adminData().modules || [];
        return modules.some(function (module) {
            return module && module.key === type && module.ready !== false;
        });
    }

    function providerValue(type) {
        var data = adminData();
        var settings = data.moduleSettings || {};
        var approval = settings.approvalcenter || {};
        var providers = approval.providers || {};
        var value = providers[type] || {};
        var levels = value.levels || {};
        return {
            enabled: value.enabled !== false,
            showTab: value.showTab !== false,
            showOverview: value.showOverview !== false,
            allowNoApproval: value.allowNoApproval === true,
            levels: {
                1: Array.isArray(levels[1] || levels["1"]) ? (levels[1] || levels["1"]).map(String) : [],
                2: Array.isArray(levels[2] || levels["2"]) ? (levels[2] || levels["2"]).map(String) : [],
                3: Array.isArray(levels[3] || levels["3"]) ? (levels[3] || levels["3"]).map(String) : []
            }
        };
    }

    function checkField(host, labelText, checked, onChange, description) {
        var label = element("label", "mc-admin-check");
        var input = element("input");
        input.type = "checkbox";
        input.checked = checked === true;
        input.onchange = function () { onChange(input.checked); };
        label.appendChild(input);
        var text = element("span");
        text.appendChild(element("strong", "", labelText));
        if (description) text.appendChild(element("small", "", description));
        label.appendChild(text);
        host.appendChild(label);
        return input;
    }

    function groupField(host, labelText, selected, onChange) {
        var wrapper = element("div", "mc-admin-field");
        wrapper.appendChild(element("label", "mc-admin-field-label", labelText));
        var select = element("select", "mc-admin-input mc-admin-groups");
        select.multiple = true;
        select.size = 5;
        selected = Array.isArray(selected) ? selected.map(String) : [];
        var groups = adminData().integrations && adminData().integrations.groups || [];
        groups.forEach(function (group) {
            var option = element("option", "", group.name || group.id);
            option.value = String(group.id);
            option.selected = selected.indexOf(option.value) >= 0;
            select.appendChild(option);
        });
        select.onchange = function () {
            onChange(Array.prototype.slice.call(select.options).filter(function (option) {
                return option.selected;
            }).map(function (option) { return option.value; }));
        };
        wrapper.appendChild(select);
        host.appendChild(wrapper);
    }

    function postProvider(type, value) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", root.getAttribute("data-plugin") || "SirkPlatform");
        url.searchParams.set("module", "approvalcenter");
        url.searchParams.set("asset", "provider-settings");
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify({
            type: type,
            enabled: value.enabled,
            showTab: value.showTab,
            showOverview: value.showOverview,
            allowNoApproval: value.allowNoApproval === true,
            levels: value.levels
        }));
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(function (response) {
            return response.text().then(function (text) {
                var result;
                try { result = JSON.parse(text || "{}"); }
                catch (error) { throw new Error(text || ("HTTP " + response.status)); }
                if (!response.ok || result.ok === false) throw new Error(result.error || ("HTTP " + response.status));
                return result;
            });
        });
    }

    function panelIsApprovalCenter(panel) {
        if (!panel) return false;
        var heading = panel.querySelector(".mc-admin-section-header h3");
        if (heading && /approval\s*center/i.test(heading.textContent || "")) return true;
        return Array.prototype.some.call(panel.querySelectorAll("h2,h3,strong"), function (node) {
            return /^approval\s*center$/i.test(String(node.textContent || "").trim());
        });
    }

    function panelTitle(panel) {
        var heading = panel && panel.querySelector(".mc-admin-section-header h3");
        return String(heading && heading.textContent || "").trim();
    }

    function cardTitle(card) {
        var title = card && card.querySelector(":scope > h3, :scope > .mc-admin-card-toggle .mc-admin-card-toggle-text strong");
        return String(title && title.textContent || "").trim();
    }

    function existingProviderTitles(panel) {
        var result = Object.create(null);
        panel.querySelectorAll(".mc-admin-card").forEach(function (card) {
            var title = card.querySelector(":scope > h3, :scope > .mc-admin-card-toggle .mc-admin-card-toggle-text strong");
            if (title) result[String(title.textContent || "").trim().toLowerCase()] = true;
        });
        return result;
    }

    function addProviderCard(panel, definition) {
        var state = providerValue(definition.type);
        var card = element("section", "mc-admin-card mc-admin-provider-card mc-admin-provider-" + definition.type);
        card.setAttribute("data-provider", definition.type);
        card.appendChild(element("h3", "", definition.title));
        card.appendChild(element("div", "mc-admin-card-description", definition.description));

        if (!moduleAvailable(definition.type)) {
            card.appendChild(element("div", "mc-admin-notice", "The module is unavailable or failed to initialize."));
        }

        checkField(card, "Provider enabled", state.enabled, function (value) { state.enabled = value; });
        checkField(card, "Show in Requests", state.showTab, function (value) { state.showTab = value; });
        checkField(card, "Show in Overview", state.showOverview, function (value) { state.showOverview = value; });
        checkField(
            card,
            "No approval required",
            state.allowNoApproval,
            function (value) { state.allowNoApproval = value; },
            definition.type === "myscripts"
                ? "Allow immediate execution when the script does not declare Approval_1, Approval_2 or Approval_3. When disabled, Level 1 approval is required."
                : "Explicitly allow immediate execution when the request does not declare approval levels."
        );
        groupField(card, "Level 1 approvers", state.levels[1], function (value) { state.levels[1] = value; });
        groupField(card, "Level 2 approvers", state.levels[2], function (value) { state.levels[2] = value; });
        groupField(card, "Level 3 approvers", state.levels[3], function (value) { state.levels[3] = value; });

        var actions = element("div", "mc-admin-inline-actions");
        var save = element("button", "mc-admin-primary", "Save " + definition.title + " provider");
        save.type = "button";
        var status = element("span", "mc-admin-save-status");
        save.onclick = function () {
            save.disabled = true;
            status.className = "mc-admin-save-status";
            status.textContent = "Saving...";
            postProvider(definition.type, state).then(function () {
                status.textContent = "Saved";
                var data = adminData();
                data.moduleSettings = data.moduleSettings || {};
                data.moduleSettings.approvalcenter = data.moduleSettings.approvalcenter || {};
                data.moduleSettings.approvalcenter.providers = data.moduleSettings.approvalcenter.providers || {};
                data.moduleSettings.approvalcenter.providers[definition.type] = JSON.parse(JSON.stringify(state));
            }).catch(function (error) {
                status.className = "mc-admin-save-status mc-admin-error";
                status.textContent = error.message || String(error);
            }).then(function () { save.disabled = false; });
        };
        actions.appendChild(save);
        actions.appendChild(status);
        card.appendChild(actions);

        var saveBar = panel.querySelector(".mc-admin-actions");
        if (saveBar) panel.insertBefore(card, saveBar);
        else panel.appendChild(card);
        return card;
    }

    function addMissingProviders(panel) {
        if (!panelIsApprovalCenter(panel)) return;
        var titles = existingProviderTitles(panel);
        providerDefinitions.forEach(function (definition) {
            if (!titles[definition.title.toLowerCase()] && !panel.querySelector('[data-provider="' + definition.type + '"]')) {
                addProviderCard(panel, definition);
            }
        });
    }

    function globalSaveBar(panel) {
        return Array.prototype.filter.call(panel.children || [], function (node) {
            return node.classList && node.classList.contains("mc-admin-actions");
        })[0] || panel.querySelector(".mc-admin-actions");
    }

    function invokeGlobalSave(panel, localButton, localStatus) {
        var bar = globalSaveBar(panel);
        var globalButton = bar && bar.querySelector(".mc-admin-primary");
        var globalStatus = bar && bar.querySelector(".mc-admin-save-status");
        if (!globalButton) {
            localStatus.className = "mc-admin-save-status mc-admin-error";
            localStatus.textContent = "Save action is unavailable.";
            return;
        }

        localButton.disabled = true;
        localStatus.className = "mc-admin-save-status";
        localStatus.textContent = "Saving...";
        globalButton.click();

        var attempts = 0;
        function syncStatus() {
            if (!localButton.isConnected) return;
            var text = String(globalStatus && globalStatus.textContent || "").trim();
            if (text && text !== "Saving...") {
                localStatus.className = globalStatus.className || "mc-admin-save-status";
                localStatus.textContent = text;
                localButton.disabled = false;
                return;
            }
            attempts++;
            if (attempts < 300) window.setTimeout(syncStatus, 100);
            else {
                localStatus.className = "mc-admin-save-status mc-admin-error";
                localStatus.textContent = "Save status timeout.";
                localButton.disabled = false;
            }
        }
        window.setTimeout(syncStatus, 100);
    }

    function addSaveProxy(card, panel, label) {
        if (!card || card.querySelector(".mc-admin-inline-actions") || card.querySelector("[data-sirk-platform-save-proxy]")) return;
        var actions = element("div", "mc-admin-inline-actions");
        actions.setAttribute("data-sirk-platform-save-proxy", "1");
        var save = element("button", "mc-admin-primary", label);
        save.type = "button";
        var status = element("span", "mc-admin-save-status");
        save.onclick = function () { invokeGlobalSave(panel, save, status); };
        actions.appendChild(save);
        actions.appendChild(status);
        card.appendChild(actions);
    }

    function ensureInlineSaveActions(panel) {
        var bar = globalSaveBar(panel);
        if (!bar) return;
        panel.querySelectorAll("[data-sirk-platform-save-proxy]").forEach(function (proxy) {
            proxy.remove();
        });
        bar.style.display = "flex";
        bar.removeAttribute("aria-hidden");
    }

    function makeCollapsible(card) {
        if (!card || card.dataset.collapsibleReady === "1") return;
        card.dataset.collapsibleReady = "1";
        var title = card.querySelector(":scope > h3");
        if (!title) return;
        var description = card.querySelector(":scope > .mc-admin-card-description");
        var toggle = element("button", "mc-admin-card-toggle");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        toggle.appendChild(element("span", "mc-admin-card-arrow", "▶"));
        var heading = element("span", "mc-admin-card-toggle-text");
        heading.appendChild(element("strong", "", title.textContent));
        if (description) heading.appendChild(element("small", "", description.textContent));
        toggle.appendChild(heading);

        var body = element("div", "mc-admin-card-body");
        Array.prototype.slice.call(card.childNodes).forEach(function (node) {
            if (node !== title && node !== description) body.appendChild(node);
        });
        title.remove();
        if (description) description.remove();
        body.hidden = true;
        toggle.onclick = function () {
            var open = body.hidden;
            body.hidden = !open;
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.querySelector(".mc-admin-card-arrow").textContent = open ? "▼" : "▶";
            card.classList.toggle("is-open", open);
        };
        card.prepend(toggle);
        card.appendChild(body);
    }

    function enhance() {
        scheduled = false;
        var panels = content.querySelectorAll(".mc-admin-settings-panel");
        if (!panels.length) return;
        Array.prototype.forEach.call(panels, function (panel) {
            ensureInlineSaveActions(panel);
            panel.querySelectorAll(".mc-admin-card").forEach(makeCollapsible);
        });
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(enhance);
    }

    new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    root.addEventListener("click", function () { window.setTimeout(schedule, 0); });
    schedule();
}());
