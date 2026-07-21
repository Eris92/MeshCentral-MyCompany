(function () {
    "use strict";

    var root = document.getElementById("mycompany-admin");
    var tabs = root && root.querySelector(".mc-admin-tabs");
    var content = document.getElementById("mycompany-admin-content");
    if (!root || !tabs || !content) return;

    var shell = document.createElement("div");
    shell.className = "mc-admin-shell";
    root.insertBefore(shell, tabs);
    shell.appendChild(tabs);
    shell.appendChild(content);

    function activeTab() {
        var activeButton = tabs.querySelector("[data-tab].active");
        return activeButton
            ? activeButton.getAttribute("data-tab")
            : "overview";
    }

    function cleanApprovalProviderOptions() {
        var header = content.querySelector(".mc-admin-section-header h3");
        if (!header || header.textContent.trim() !== "Approval Center") return;

        content.querySelectorAll(".mc-admin-card").forEach(function (card) {
            var title = card.querySelector("h3");
            if (!title || [
                "Move Requests",
                "My Commands",
                "Scripts"
            ].indexOf(title.textContent.trim()) < 0) {
                return;
            }

            card.querySelectorAll(".mc-admin-check").forEach(function (field) {
                var label = field.querySelector("strong");
                var text = label ? label.textContent.trim() : "";
                if ([
                    "Provider enabled",
                    "Show in Requests",
                    "Show in Overview"
                ].indexOf(text) >= 0) {
                    field.remove();
                }
            });
        });
    }

    function relocateSettingsNavigation() {
        var fresh = content.querySelector(".mc-admin-settings-nav");
        var current = tabs.querySelector(".mc-admin-settings-subnav");

        if (fresh) {
            if (current && current !== fresh && current.parentNode) {
                current.parentNode.removeChild(current);
            }

            fresh.classList.add("mc-admin-settings-subnav");
            var settingsButton = tabs.querySelector('[data-tab="settings"]');
            tabs.insertBefore(fresh, settingsButton.nextSibling);

            var layout = content.querySelector(".mc-admin-settings-layout");
            if (layout) {
                layout.classList.add("mc-admin-settings-layout-single");
            }
            current = fresh;
        }

        if (current) {
            current.style.display = activeTab() === "settings"
                ? "block"
                : "none";
        }

        cleanApprovalProviderOptions();
    }

    tabs.addEventListener("click", function () {
        window.setTimeout(relocateSettingsNavigation, 0);
    });

    var observer = new MutationObserver(function () {
        relocateSettingsNavigation();
    });

    observer.observe(content, {
        childList: true,
        subtree: true
    });

    relocateSettingsNavigation();
}());
