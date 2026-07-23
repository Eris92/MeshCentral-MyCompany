(function () {
    "use strict";

    var base = String(window.__SIRK_PLATFORM_ASSET_BASE__ || window.__SIRK_PLATFORM_LOGIN_ASSET_BASE__ || "").replace(/\/$/, "");
    if (!base) return;

    var current = {};
    var DEVICE_TAB_STORAGE = "sirkPortal.deviceActiveTabs";
    var LANGUAGE_STORAGE = "sirkPortal.language";
    var THEME_STORAGE = "sirkPortal.theme";
    var restoreTimer = 0;

    function workspaceChild() {
        try { return new URL(window.location.href).searchParams.get("sirkWorkspaceChild") === "1"; }
        catch (error) { return false; }
    }

    function workspaceNodeId() {
        try {
            var direct = new URL(window.location.href).searchParams.get("gotonode");
            if (direct) return String(direct);
        } catch (error) {}
        var link = document.querySelector('.sirk-device-general-actions a[href*="gotonode="],.sirk-device-native-button[href*="gotonode="]');
        if (link) {
            try { return String(new URL(link.href, window.location.href).searchParams.get("gotonode") || ""); }
            catch (error) {}
        }
        return "__last__";
    }

    function readDeviceTabs() {
        try {
            var value = JSON.parse(localStorage.getItem(DEVICE_TAB_STORAGE) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) { return {}; }
    }

    function savedDeviceTab() {
        var state = readDeviceTabs();
        return String(state[workspaceNodeId()] || state.__last__ || "general");
    }

    function saveDeviceTab(tab) {
        tab = String(tab || "general");
        var state = readDeviceTabs();
        state[workspaceNodeId()] = tab;
        state.__last__ = tab;
        try { localStorage.setItem(DEVICE_TAB_STORAGE, JSON.stringify(state)); } catch (error) {}
    }

    function revealPortal() {
        var root = document.getElementById("sirkStandaloneRoot");
        var content = document.getElementById("sirkStandaloneContent");
        document.documentElement.classList.remove("sirk-portal-boot-pending", "sirk-device-restore-pending");
        if (root) {
            root.style.visibility = "";
            root.style.pointerEvents = "";
            root.removeAttribute("aria-busy");
        }
        if (content) {
            content.style.visibility = "";
            content.style.pointerEvents = "";
            content.removeAttribute("aria-busy");
            content.removeAttribute("data-device-tab-restore-pending");
        }
    }

    function restoreDeviceTab() {
        if (!workspaceChild()) return false;
        var content = document.getElementById("sirkStandaloneContent");
        var workspace = content && content.querySelector(".sirk-device-workspace");
        if (!workspace) return false;
        var desired = savedDeviceTab();
        var button = workspace.querySelector('[data-device-tab="' + desired.replace(/"/g, '\\"') + '"]');
        if (!button) button = workspace.querySelector('[data-device-tab="general"]');
        if (button && !button.classList.contains("is-active")) button.click();
        revealPortal();
        return true;
    }

    function language() {
        try { return localStorage.getItem(LANGUAGE_STORAGE) === "en" ? "en" : "pl"; }
        catch (error) { return "pl"; }
    }

    function darkTheme() {
        try { return localStorage.getItem(THEME_STORAGE) === "dark"; }
        catch (error) { return false; }
    }

    function applyWorkspaceTheme() {
        if (!workspaceChild()) return;
        var dark = darkTheme();
        var portalRoot = document.getElementById("sirkPortalRoot");
        if (portalRoot) {
            portalRoot.classList.toggle("sirk-theme-dark", dark);
            portalRoot.classList.toggle("sirk-theme-light", !dark);
        }
        document.documentElement.classList.toggle("sirk-theme-dark", dark);
        document.documentElement.classList.toggle("sirk-theme-light", !dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
        if (document.body) {
            document.body.classList.toggle("sirk-theme-dark", dark);
            document.body.classList.toggle("sirk-theme-light", !dark);
        }
    }

    var WORKSPACE_TEXT = {
        pl: { general: "Ogólne", desktop: "Pulpit", terminal: "Terminal", commands: "Polecenia", files: "Pliki", registry: "Rejestr", software: "Oprogramowanie", amt: "Intel AMT", online: "Online", offline: "Offline", name: "Nazwa", status: "Status", group: "Grupa", system: "System", ip: "Adres IP", lastSeen: "Ostatnio widziany", agent: "Wersja agenta", nodeId: "Node ID", openMesh: "Otwórz w MeshCentral" },
        en: { general: "Overview", desktop: "Desktop", terminal: "Terminal", commands: "Commands", files: "Files", registry: "Registry", software: "Software", amt: "Intel AMT", online: "Online", offline: "Offline", name: "Name", status: "Status", group: "Group", system: "Operating system", ip: "IP address", lastSeen: "Last seen", agent: "Agent version", nodeId: "Node ID", openMesh: "Open in MeshCentral" }
    };

    function translateWorkspace() {
        if (!workspaceChild()) return;
        var text = WORKSPACE_TEXT[language()];
        document.documentElement.lang = language();
        Array.prototype.forEach.call(document.querySelectorAll("[data-device-tab]"), function (button) {
            var key = button.getAttribute("data-device-tab");
            if (text[key]) button.textContent = text[key];
        });
        var connection = document.querySelector(".sirk-device-connection");
        if (connection) {
            var dot = connection.querySelector("i");
            connection.textContent = connection.classList.contains("is-online") ? text.online : text.offline;
            if (dot) connection.insertBefore(dot, connection.firstChild);
        }
        var labels = [text.name, text.status, text.group, text.system, text.ip, text.lastSeen, text.agent, text.nodeId];
        Array.prototype.forEach.call(document.querySelectorAll(".sirk-device-detail-item > span"), function (label, index) {
            if (labels[index]) label.textContent = labels[index];
        });
        var open = document.querySelector(".sirk-device-general-actions a");
        if (open) open.textContent = text.openMesh;
        var active = document.querySelector("[data-device-tab].is-active");
        if (active && active.getAttribute("data-device-tab") === "commands") {
            var module = window.SirkPlatformModules && window.SirkPlatformModules.mycommands;
            if (module && module.api && typeof module.api.render === "function") module.api.render();
        }
    }

    function propagateLanguage(event) {
        if (workspaceChild()) return;
        var detail = event && event.detail || { language: language() };
        Array.prototype.forEach.call(document.querySelectorAll('iframe[src*="sirkWorkspaceChild=1"]'), function (frame) {
            try { frame.contentWindow.dispatchEvent(new CustomEvent("sirkportal:languagechange", { detail: detail })); }
            catch (error) {}
        });
    }

    function applyDocument(doc, config) {
        if (!doc) return;
        var name = String(config.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(config.siteIconUrl || "").trim();
        var brand = doc.querySelector(".sirk-standalone-brand strong,.sirk-login-product");
        if (brand) brand.textContent = name;
        var mark = doc.querySelector(".sirk-brand-mark,.sirk-login-mark");
        if (mark) {
            if (icon) {
                var image = mark.querySelector("img[data-sirk-branding]");
                if (!image) {
                    mark.textContent = "";
                    image = doc.createElement("img");
                    image.setAttribute("data-sirk-branding", "1");
                    image.alt = "";
                    image.style.width = "100%";
                    image.style.height = "100%";
                    image.style.objectFit = "contain";
                    mark.appendChild(image);
                }
                image.src = icon;
            } else {
                mark.textContent = (name.charAt(0) || "S").toUpperCase();
            }
        }
        var reset = doc.querySelector(".sirk-password-reset");
        if (reset) {
            var visible = config.showPasswordReset !== false;
            reset.hidden = !visible;
            reset.style.display = visible ? "" : "none";
            reset.href = String(config.passwordResetUrl || "https://passwordreset.microsoftonline.com/");
        }
    }

    function synchronize() {
        applyDocument(document, current);
        var frame = document.getElementById("sirkLoginFrame");
        if (frame) {
            try { applyDocument(frame.contentDocument, current); }
            catch (error) {}
        }
        applyWorkspaceTheme();
        translateWorkspace();
        restoreDeviceTab();
    }

    function apply(config) {
        current = config && typeof config === "object" ? config : {};
        var name = String(current.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(current.siteIconUrl || "").trim();
        window.__SIRK_PLATFORM_PORTAL_BRANDING__ = current;
        document.title = document.getElementById("sirkLoginFrame") ? name + " — logowanie" : name;
        synchronize();
        var favicon = document.querySelector('link[rel="icon"][data-sirk-branding]');
        if (icon) {
            if (!favicon) {
                favicon = document.createElement("link");
                favicon.rel = "icon";
                favicon.setAttribute("data-sirk-branding", "1");
                document.head.appendChild(favicon);
            }
            favicon.href = icon;
        } else if (favicon) favicon.remove();
    }

    document.addEventListener("click", function (event) {
        var tab = event.target && event.target.closest && event.target.closest("[data-device-tab]");
        if (tab) saveDeviceTab(tab.getAttribute("data-device-tab"));
    }, true);
    window.addEventListener("sirkportal:languagechange", function () { translateWorkspace(); }, true);
    window.addEventListener("sirkportal:languagechange", propagateLanguage);
    window.addEventListener("storage", function (event) {
        if (event.key === LANGUAGE_STORAGE) translateWorkspace();
        if (event.key === THEME_STORAGE) applyWorkspaceTheme();
    });

    fetch(base + "/portal-branding.json?v=" + encodeURIComponent(String(window.__SIRK_PLATFORM_PORTAL_VERSION__ || Date.now())), {
        credentials: "same-origin",
        cache: "no-store"
    }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
    }).then(apply).catch(function () { apply({}); });

    restoreTimer = window.setInterval(function () {
        synchronize();
        if (restoreDeviceTab()) {
            window.clearInterval(restoreTimer);
            restoreTimer = 0;
        }
    }, 500);
    window.setTimeout(function () {
        revealPortal();
        if (restoreTimer) {
            window.clearInterval(restoreTimer);
            restoreTimer = 0;
        }
    }, 5000);
}());
