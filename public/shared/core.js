(function () {
    "use strict";
    window.SirkPlatformCore = window.SirkPlatformCore || {};
    var core = window.SirkPlatformCore;
    core.assetVersion = String(window.__SIRK_PLATFORM_VERSION__ || "0");

    function svgData(svg) {
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    var menuIcons = {
        myscripts: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#7b1fa2" d="M12 5h31l9 9v45H12z"/><path fill="#fff" opacity=".9" d="M39 5v13h13z"/><path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="m25 29-7 6 7 6m14-12 7 6-7 6m-4-16-6 20"/></svg>'),
        approvalcenter: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="9" width="34" height="46" rx="4" fill="#7b1fa2"/><rect x="20" y="4" width="20" height="10" rx="4" fill="#4a148c"/><path fill="#fff" d="M20 23h18v4H20zm0 9h12v4H20z"/><circle cx="45" cy="43" r="13" fill="#2e7d32" stroke="#fff" stroke-width="3"/><path fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="m39 43 4 4 8-9"/></svg>'),
        myjira: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="48" rx="10" fill="#1868db"/><path d="M18 20h28v6H18zm0 10h20v6H18zm0 10h14v6H18z" fill="#fff"/><circle cx="47" cy="43" r="9" fill="#fff"/><path d="M43 43l3 3 6-7" fill="none" stroke="#1868db" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
        mycommands: "https://raw.githubusercontent.com/Eris92/MeshCentral-MyCommands/main/assets/LeftMenu.png"
    };

    core.assetUrl = function (moduleName, assetName, parameters) {
        var endpoint = new URL("pluginadmin.ashx", window.location.href);
        endpoint.searchParams.set("pin", "SirkPlatform");
        if (moduleName) endpoint.searchParams.set("module", moduleName);
        if (assetName) endpoint.searchParams.set("asset", assetName);
        endpoint.searchParams.set("v", core.assetVersion);
        Object.keys(parameters || {}).forEach(function (key) {
            if (parameters[key] != null) endpoint.searchParams.set(key, parameters[key]);
        });
        return endpoint.href;
    };
    core.api = function (moduleName, assetName, options, parameters) {
        var request = options || {};
        request.credentials = "same-origin";
        request.cache = "no-store";
        return window.fetch(core.assetUrl(moduleName, assetName, parameters), request).then(function (response) {
            return response.text().then(function (text) {
                var result = {};
                try { result = text ? JSON.parse(text) : {}; }
                catch (error) { throw new Error("HTTP " + response.status + ": invalid JSON response."); }
                if (!response.ok || result.ok === false) throw new Error(result.error || "HTTP " + response.status);
                return result;
            });
        });
    };
    core.post = function (moduleName, assetName, values) {
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values && typeof values === "object" ? values : {}));
        return core.api(moduleName, assetName, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        });
    };
    core.loadScript = function (id, source) {
        return new Promise(function (resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) { resolve(); return; }
            var script = document.createElement("script");
            script.id = id;
            script.src = source;
            script.async = false;
            script.onload = resolve;
            script.onerror = reject;
            (document.head || document.documentElement).appendChild(script);
        });
    };
    core.placeMenuItem = function (item, anchor, order) {
        if (!item || !anchor || !anchor.parentNode) return false;
        var host = anchor.parentNode;
        item.setAttribute("data-sirk-platform-order", String(order || 100));
        if (item.parentNode !== host) host.insertBefore(item, anchor.nextSibling);
        return true;
    };
    core.ensureMenu = function (definition) {
        var mainAnchor = document.getElementById("MainMenuMyDevices");
        var leftAnchor = document.getElementById("LeftMenuMyDevices");
        var key = String(definition.mainId || "").replace(/^MainMenuSirkPlatform-/, "").toLowerCase();
        var iconSource = definition.icon || menuIcons[key] || "";
        var open = definition.open;

        if (mainAnchor && mainAnchor.parentNode) {
            var main = document.getElementById(definition.mainId) || mainAnchor.cloneNode(false);
            var modern = String(main.tagName || "").toLowerCase() === "a" || main.classList.contains("nav-link");
            main.id = definition.mainId;
            main.textContent = definition.title;
            main.title = definition.title;
            main.tabIndex = 0;
            main.classList.remove("fullselect", "semiselect", "active");
            main.onclick = main.onmouseup = main.onkeypress = null;
            if (modern) {
                main.href = "#";
                main.onclick = open;
            } else {
                main.onmouseup = open;
                main.onkeypress = function (event) { if (event && event.key === "Enter") return open(event); };
            }
            main.setAttribute("data-sirk-platform-viewmode", String(definition.viewMode || ""));
            core.placeMenuItem(main, mainAnchor, definition.order);
        }

        if (leftAnchor && leftAnchor.parentNode) {
            var left = document.getElementById(definition.leftId) || leftAnchor.cloneNode(true);
            var leftModern = String(left.tagName || "").toLowerCase() === "a" || left.classList.contains("nav-link");
            left.id = definition.leftId;
            left.title = definition.title;
            left.setAttribute("aria-label", definition.title);
            left.tabIndex = 0;
            left.classList.remove("lbbuttonsel", "lbbuttonsel2", "active");
            left.onclick = left.onmouseup = left.onkeypress = null;
            if (leftModern) {
                left.href = "#";
                left.onclick = open;
            } else {
                left.onmouseup = open;
                left.onkeypress = function (event) { if (event && event.key === "Enter") return open(event); };
            }
            left.setAttribute("data-sirk-platform-viewmode", String(definition.viewMode || ""));

            if (iconSource) {
                var legacyIcon = left.querySelector(".lbtg");
                if (legacyIcon) {
                    legacyIcon.className = "lbtg";
                    legacyIcon.style.backgroundImage = 'url("' + iconSource + '")';
                    legacyIcon.style.backgroundPosition = "center";
                    legacyIcon.style.backgroundRepeat = "no-repeat";
                    legacyIcon.style.backgroundSize = "contain";
                } else if (leftModern) {
                    var nativeIcon = left.querySelector("svg, i, img");
                    var image = document.createElement("img");
                    image.className = "sirk-platform-menu-icon";
                    image.alt = "";
                    image.src = iconSource;
                    image.style.width = "24px";
                    image.style.height = "24px";
                    image.style.objectFit = "contain";
                    if (nativeIcon && nativeIcon.parentNode) nativeIcon.parentNode.replaceChild(image, nativeIcon);
                    else left.insertBefore(image, left.firstChild);
                }
            }
            core.placeMenuItem(left, leftAnchor, definition.order);
        }
    };
    core.restoreWorkspace = function () {
        var state = core.workspaceState;
        if (!state) return;
        if (state.heading) state.heading.textContent = state.headingText;
        (state.hidden || []).forEach(function (item) {
            item.element.style.cssText = item.cssText;
            item.element.hidden = item.hidden;
        });
        var workspace = document.getElementById("SirkPlatformWorkspace");
        if (workspace) {
            workspace.innerHTML = "";
            workspace.style.display = "none";
        }
        core.workspaceState = null;
    };

    core.isSirkPlatformTarget = function (target) {
        if (!target || !target.closest) return false;
        return !!target.closest("#SirkPlatformWorkspace,[id^='MainMenuSirkPlatform-'],[id^='LeftMenuSirkPlatform-'],#sirkPlatformPortalLauncher");
    };

    core.installNativeRestoreGuard = function () {
        if (core.nativeRestoreGuardInstalled) return;
        core.nativeRestoreGuardInstalled = true;
        document.addEventListener("pointerdown", function (event) {
            if (!core.workspaceState || core.isSirkPlatformTarget(event.target)) return;
            core.restoreWorkspace();
        }, true);
        document.addEventListener("keydown", function (event) {
            if ((event.key !== "Enter" && event.key !== " ") || !core.workspaceState || core.isSirkPlatformTarget(event.target)) return;
            core.restoreWorkspace();
        }, true);
    };

    core.showWorkspace = function (title, viewMode, render) {
        core.installNativeRestoreGuard();
        if (typeof window.go === "function" && Number(window.xxcurrentView) !== 1) {
            try { window.go(1); } catch (error) {}
        }
        var page = document.getElementById("p1");
        var titleHost = document.getElementById("p1title");
        if (!page || !titleHost) return false;
        var workspace = document.getElementById("SirkPlatformWorkspace");
        if (!workspace) {
            workspace = document.createElement("div");
            workspace.id = "SirkPlatformWorkspace";
            page.appendChild(workspace);
        }
        var heading = titleHost.querySelector("h1,h2,h3,.title,b,strong") || titleHost;
        if (!core.workspaceState) {
            var hidden = [];
            for (var child = page.firstElementChild; child; child = child.nextElementSibling) {
                if (child === titleHost || child === workspace) continue;
                hidden.push({ element: child, cssText: child.style.cssText, hidden: child.hidden });
                child.hidden = true;
                child.style.setProperty("display", "none", "important");
            }
            core.workspaceState = { heading: heading, headingText: heading.textContent, hidden: hidden, viewMode: viewMode };
        }
        heading.textContent = title;
        while (workspace.firstChild) workspace.removeChild(workspace.firstChild);
        workspace.style.display = "block";
        render(workspace);
        return false;
    };
    core.element = function (tag, className, text) {
        var value = document.createElement(tag);
        if (className) value.className = className;
        if (text != null) value.textContent = text;
        return value;
    };
    core.card = function (title, description) {
        var card = core.element("div", "mc-shared-card");
        card.appendChild(core.element("strong", "", title));
        if (description) card.appendChild(core.element("div", "mc-shared-muted", description));
        return card;
    };
    core.flattenScripts = function (node, target) {
        target = target || [];
        if (!node) return target;
        if (node.type === "script") target.push(node);
        (node.children || []).forEach(function (child) { core.flattenScripts(child, target); });
        return target;
    };
}());
