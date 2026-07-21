(function () {
    "use strict";

    if (window.__myCompanyPortalFolderCollapseLoaded) return;
    window.__myCompanyPortalFolderCollapseLoaded = true;

    var STORAGE_KEY = "mycompany.portal.management.expandedFolders.v1";
    var expanded = loadState();
    var scheduled = false;

    function loadState() {
        try {
            var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) {
            return {};
        }
    }

    function saveState() {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); }
        catch (error) {}
    }

    function depth(node) {
        var value = node && node.style && node.style.getPropertyValue("--sirk-depth");
        var number = parseInt(value || "0", 10);
        return isFinite(number) ? number : 0;
    }

    function text(node) {
        var labels = node.querySelectorAll(":scope > span");
        var label = labels.length ? labels[labels.length - 1] : node;
        return String(label && label.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function rootKey(shell) {
        var selected = shell.querySelector('.sirk-management-workspace > .sirk-management-column:first-child [data-management-root].is-active');
        return String(selected && selected.getAttribute("data-management-root") || "root");
    }

    function chevron() {
        var host = document.createElement("span");
        host.className = "sirk-folder-chevron";
        host.setAttribute("aria-hidden", "true");
        host.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';
        return host;
    }

    function assignKeys(shell, list) {
        var stack = [];
        var occurrence = Object.create(null);
        var root = rootKey(shell);

        Array.prototype.forEach.call(list.children, function (node) {
            if (!node.classList.contains("sirk-folder-heading")) return;
            var level = depth(node);
            var label = text(node) || "folder";
            stack.length = level;
            stack[level] = label;
            var base = root + "|" + stack.slice(0, level + 1).join("/");
            occurrence[base] = (occurrence[base] || 0) + 1;
            var key = base + "#" + occurrence[base];
            node.setAttribute("data-folder-collapse-key", key);
            node.setAttribute("data-folder-depth", String(level));
            node.setAttribute("role", "button");
            node.setAttribute("tabindex", "0");

            if (!node.querySelector(":scope > .sirk-folder-chevron")) {
                node.insertBefore(chevron(), node.firstChild);
            }

            // New folders are expanded by default. Stored false means collapsed.
            var isExpanded = expanded[key] !== false;
            node.classList.toggle("is-expanded", isExpanded);
            node.classList.toggle("is-collapsed", !isExpanded);
            node.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        });
    }

    function applyVisibility(list) {
        var collapsed = [];

        Array.prototype.forEach.call(list.children, function (node) {
            var level = depth(node);
            while (collapsed.length && level <= collapsed[collapsed.length - 1]) collapsed.pop();

            var hiddenByParent = collapsed.length > 0;
            node.classList.toggle("is-folder-child-hidden", hiddenByParent);
            node.hidden = hiddenByParent;

            if (node.classList.contains("sirk-folder-heading")) {
                var ownExpanded = node.getAttribute("aria-expanded") !== "false";
                if (!ownExpanded) collapsed.push(level);
            }
        });
    }

    function enhance(shell) {
        if (!shell) return;
        var list = shell.querySelector('.sirk-management-workspace > .sirk-management-column:nth-child(2) > .sirk-management-list');
        if (!list) return;
        assignKeys(shell, list);
        applyVisibility(list);
    }

    function schedule(shell) {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () {
            scheduled = false;
            enhance(shell || document.querySelector(".sirk-management-shell"));
        });
    }

    function toggle(heading) {
        var key = heading.getAttribute("data-folder-collapse-key");
        if (!key) return;
        var next = heading.getAttribute("aria-expanded") === "false";
        expanded[key] = next;
        saveState();
        heading.classList.toggle("is-expanded", next);
        heading.classList.toggle("is-collapsed", !next);
        heading.setAttribute("aria-expanded", next ? "true" : "false");
        var list = heading.parentElement;
        if (list) applyVisibility(list);
    }

    document.addEventListener("click", function (event) {
        var heading = event.target && event.target.closest && event.target.closest("#sirkPortalRoot .sirk-management-shell .sirk-folder-heading");
        if (!heading) return;
        event.preventDefault();
        event.stopPropagation();
        toggle(heading);
    }, true);

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        var heading = event.target && event.target.closest && event.target.closest("#sirkPortalRoot .sirk-management-shell .sirk-folder-heading");
        if (!heading) return;
        event.preventDefault();
        event.stopPropagation();
        toggle(heading);
    }, true);

    function bind() {
        var portal = document.getElementById("sirkPortalRoot");
        if (!portal) return false;
        schedule(portal.querySelector(".sirk-management-shell"));
        if (!portal.__myCompanyFolderCollapseObserver) {
            portal.__myCompanyFolderCollapseObserver = new MutationObserver(function (records) {
                for (var index = 0; index < records.length; index++) {
                    var target = records[index].target;
                    var shell = target && target.nodeType === 1 && target.closest && target.closest(".sirk-management-shell");
                    if (shell || portal.querySelector(".sirk-management-shell")) {
                        schedule(shell || portal.querySelector(".sirk-management-shell"));
                        break;
                    }
                }
            });
            portal.__myCompanyFolderCollapseObserver.observe(portal, { childList: true, subtree: true });
        }
        return true;
    }

    var attempts = 0;
    var timer = window.setInterval(function () {
        attempts++;
        if (bind() || attempts > 120) window.clearInterval(timer);
    }, 100);
}());