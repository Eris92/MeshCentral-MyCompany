(function () {
    "use strict";

    if (window.__sirkPlatformPortalFolderCollapseLoaded) return;
    window.__sirkPlatformPortalFolderCollapseLoaded = true;

    var expanded = {};
    var activeShell = null;
    var activeRoot = "";
    var scheduled = false;

    function ensureStyle() {
        if (document.getElementById("sirkPlatformPortalFolderCollapseStyle")) return;
        var style = document.createElement("style");
        style.id = "sirkPlatformPortalFolderCollapseStyle";
        style.textContent = [
            "#sirkPortalRoot .sirk-folder-heading{cursor:pointer;user-select:none;border-radius:7px;outline:0}",
            "#sirkPortalRoot .sirk-folder-heading:hover,#sirkPortalRoot .sirk-folder-heading:focus-visible{background:rgba(96,165,250,.10)}",
            "#sirkPortalRoot .sirk-folder-heading.is-active{background:rgba(96,165,250,.16);box-shadow:inset 3px 0 0 var(--portal-accent,#60a5fa);color:var(--sirk-text,#172033);font-weight:700}",
            "#sirkPortalRoot .is-folder-child-hidden{display:none!important}"
        ].join("");
        (document.head || document.documentElement).appendChild(style);
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

    function assignKeys(shell, list) {
        var stack = [];
        var occurrence = Object.create(null);
        var root = rootKey(shell);
        var managementHost = shell.closest(".sirk-platform-management-host");
        var openPath = String(managementHost && managementHost.getAttribute("data-management-open-path") || "");

        Array.prototype.forEach.call(list.children, function (node) {
            if (!node.classList.contains("sirk-folder-heading")) return;
            var level = depth(node);
            var label = text(node) || "folder";
            var folderPath = String(node.getAttribute("data-folder-path") || "");
            stack.length = level;
            stack[level] = label;
            var base = root + "|" + (folderPath || stack.slice(0, level + 1).join("/"));
            occurrence[base] = (occurrence[base] || 0) + 1;
            var key = base + "#" + occurrence[base];
            node.setAttribute("data-folder-collapse-key", key);
            node.setAttribute("data-folder-depth", String(level));
            node.setAttribute("role", "button");
            node.setAttribute("tabindex", "0");

            var opensLinkedScript = folderPath && openPath && openPath.indexOf(folderPath + "/") === 0;
            if (opensLinkedScript) expanded[key] = true;
            var isExpanded = expanded[key] === true;
            node.classList.toggle("is-expanded", isExpanded);
            node.classList.toggle("is-collapsed", !isExpanded);
            node.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        });
        if (managementHost && openPath) managementHost.removeAttribute("data-management-open-path");
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
        ensureStyle();
        var list = shell.querySelector('.sirk-management-workspace > .sirk-management-column:nth-child(2) > .sirk-management-list');
        if (!list) return;
        var currentRoot = rootKey(shell);
        if (shell !== activeShell || currentRoot !== activeRoot) {
            expanded = {};
            activeShell = shell;
            activeRoot = currentRoot;
        }
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
        heading.classList.toggle("is-expanded", next);
        heading.classList.toggle("is-collapsed", !next);
        Array.prototype.forEach.call(heading.parentElement.querySelectorAll(":scope > .sirk-folder-heading.is-active"), function (node) {
            node.classList.toggle("is-active", node === heading);
        });
        heading.classList.add("is-active");
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
        ensureStyle();
        schedule(portal.querySelector(".sirk-management-shell"));
        if (!portal.__sirkPlatformFolderCollapseObserver) {
            portal.__sirkPlatformFolderCollapseObserver = new MutationObserver(function (records) {
                for (var index = 0; index < records.length; index++) {
                    var target = records[index].target;
                    var shell = target && target.nodeType === 1 && target.closest && target.closest(".sirk-management-shell");
                    if (shell || portal.querySelector(".sirk-management-shell")) {
                        schedule(shell || portal.querySelector(".sirk-management-shell"));
                        break;
                    }
                }
            });
            portal.__sirkPlatformFolderCollapseObserver.observe(portal, { childList: true, subtree: true });
        }
        return true;
    }

    var attempts = 0;
    var timer = window.setInterval(function () {
        attempts++;
        if (bind() || attempts > 120) window.clearInterval(timer);
    }, 100);
}());
