(function () {
    "use strict";

    if (window.__myCompanyDeviceTabsV7Loaded) return;
    window.__myCompanyDeviceTabsV7Loaded = true;

    var STORAGE_KEY = "mycompany.sirkportal.deviceTabs";
    var state = {
        shell: null,
        main: null,
        content: null,
        bar: null,
        cache: null,
        panes: Object.create(null),
        active: "all",
        pending: null,
        observer: null,
        finalizeTimer: 0,
        restoreTimer: 0,
        metadataRestored: false,
        restoreActive: "all"
    };

    function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
    function safeKey(value) { return clean(value).replace(/[^a-z0-9._:-]/gi, "_").slice(0, 180); }
    function language() {
        try { return localStorage.getItem("sirkPortal.language") === "en" ? "en" : "pl"; }
        catch (error) { return document.documentElement.lang === "en" ? "en" : "pl"; }
    }
    function allLabel() { return language() === "en" ? "All" : "Wszystkie"; }
    function currentView() {
        var active = document.querySelector('.sirk-standalone-nav button.is-active[data-view]');
        return active ? String(active.getAttribute("data-view") || "") : "";
    }
    function devicesActive() { return currentView() === "devices"; }

    function createStore(key) {
        var store = document.createElement("div");
        store.className = "sirk-device-tab-store";
        store.setAttribute("data-device-tab-store", key);
        return store;
    }

    function moveChildren(source, target) {
        if (!source || !target) return;
        while (source.firstChild) target.appendChild(source.firstChild);
    }

    function readPersisted() {
        try {
            var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) { return {}; }
    }

    function persist() {
        try {
            var tabs = Object.keys(state.panes).filter(function (key) { return key !== "all"; }).map(function (key) {
                var pane = state.panes[key];
                return { key: pane.key, nodeId: pane.nodeId, name: pane.name };
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: state.active, tabs: tabs }));
        } catch (error) {}
    }

    function restoreMetadata() {
        if (state.metadataRestored || !state.cache) return;
        state.metadataRestored = true;
        var saved = readPersisted();
        (Array.isArray(saved.tabs) ? saved.tabs : []).forEach(function (item) {
            var nodeId = clean(item && item.nodeId);
            var name = clean(item && item.name);
            var key = clean(item && item.key) || (nodeId ? "node:" + safeKey(nodeId) : "");
            if (!key || !nodeId || state.panes[key]) return;
            var pane = { key: key, nodeId: nodeId, name: name || nodeId, store: createStore(key), loaded: false };
            state.cache.appendChild(pane.store);
            state.panes[key] = pane;
        });
        state.restoreActive = state.panes[saved.active] ? saved.active : "all";
    }

    function ensureInfrastructure() {
        var shell = document.getElementById("sirkStandaloneRoot");
        var content = document.getElementById("sirkStandaloneContent");
        var main = content && content.closest(".sirk-standalone-main");
        if (!shell || !content || !main) return false;

        state.shell = shell;
        state.content = content;
        state.main = main;

        document.querySelectorAll(".sirk-standalone-sidebar .sirk-device-tabs,.sirk-standalone-nav .sirk-device-tabs").forEach(function (wrong) { wrong.remove(); });

        if (!state.cache || !state.cache.isConnected) {
            state.cache = document.createElement("div");
            state.cache.className = "sirk-device-tab-cache";
            state.cache.hidden = true;
            state.cache.setAttribute("aria-hidden", "true");
            shell.appendChild(state.cache);
        }

        if (!state.bar || !state.bar.isConnected) {
            state.bar = document.createElement("div");
            state.bar.className = "sirk-device-tabs sirk-device-tabs-standalone";
            state.bar.setAttribute("role", "tablist");
            main.insertBefore(state.bar, content);
        }

        if (!state.panes.all) {
            state.panes.all = { key: "all", name: allLabel(), nodeId: "", store: createStore("all"), loaded: false };
            state.cache.appendChild(state.panes.all.store);
        }

        restoreMetadata();
        updateLanguage();
        syncVisibility();
        renderTabs();
        bind();
        scheduleRestore();
        return true;
    }

    function updateLanguage() {
        if (!state.panes.all) return;
        state.panes.all.name = allLabel();
        if (state.bar) state.bar.setAttribute("aria-label", language() === "en" ? "Open devices" : "Otwarte urządzenia");
    }

    function syncVisibility() {
        if (!state.bar) return;
        var visible = devicesActive();
        state.bar.hidden = !visible;
        state.bar.style.display = visible ? "flex" : "none";
    }

    function contentIsDeviceList() {
        return !!(state.content && state.content.querySelector("[data-device-id],#sirkDevicesHost,.sirk-device-groups"));
    }

    function contentIsWorkspace() {
        return !!(state.content && state.content.querySelector(".sirk-device-workspace"));
    }

    function activeKeyFromDom() {
        var activeTab = state.bar && state.bar.querySelector('.sirk-device-tab.is-active[data-device-workspace-key]');
        var key = activeTab && activeTab.getAttribute("data-device-workspace-key");
        if (key && state.panes[key]) return key;
        if (contentIsDeviceList()) return "all";
        if (contentIsWorkspace() && state.active !== "all" && state.panes[state.active]) return state.active;
        return state.active;
    }

    function stashVisible() {
        if (!state.content || !state.content.childNodes.length) return false;
        var key = activeKeyFromDom();
        if (contentIsDeviceList()) key = "all";
        if (!key || !state.panes[key]) return false;
        var pane = state.panes[key];
        moveChildren(state.content, pane.store);
        pane.loaded = pane.store.childNodes.length > 0;
        state.active = key;
        return pane.loaded;
    }

    function showStored(key) {
        var pane = state.panes[key];
        if (!pane || !state.content || !pane.store.childNodes.length) return false;
        state.content.textContent = "";
        moveChildren(pane.store, state.content);
        pane.loaded = true;
        state.active = key;
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
        return true;
    }

    function activateAll() {
        if (!state.panes.all || !state.content) return;
        if (!contentIsDeviceList()) stashVisible();
        state.pending = null;
        if (!showStored("all")) {
            state.active = "all";
            renderTabs();
            persist();
        }
    }

    function findDeviceRow(nodeId) {
        var roots = [state.content, state.panes.all && state.panes.all.store];
        for (var r = 0; r < roots.length; r++) {
            var root = roots[r];
            if (!root) continue;
            var rows = root.querySelectorAll("[data-device-id]");
            for (var i = 0; i < rows.length; i++) {
                if (String(rows[i].getAttribute("data-device-id") || "") === String(nodeId || "")) return rows[i];
            }
        }
        return null;
    }

    function openUnloadedPane(pane) {
        if (!pane || !state.content || !state.panes.all) return;
        if (!contentIsDeviceList()) stashVisible();
        if (!showStored("all") && !contentIsDeviceList()) return;
        var row = findDeviceRow(pane.nodeId);
        if (!row) return;
        state.pending = { key: pane.key, nodeId: pane.nodeId, name: pane.name };
        row.click();
        window.clearTimeout(state.finalizeTimer);
        state.finalizeTimer = window.setTimeout(finalizeOpen, 80);
    }

    function activate(key) {
        var pane = state.panes[key];
        if (!pane || !state.content) return;
        if (key === "all") { activateAll(); return; }
        if (activeKeyFromDom() === key && contentIsWorkspace()) return;
        if (pane.loaded && pane.store.childNodes.length) {
            stashVisible();
            showStored(key);
            return;
        }
        openUnloadedPane(pane);
    }

    function disconnectPane(pane) {
        if (!pane || !pane.store) return;
        pane.store.querySelectorAll("button").forEach(function (button) {
            var label = clean(button.textContent).toLowerCase();
            if (label === "rozłącz" || label === "disconnect") {
                try { button.click(); } catch (error) {}
            }
        });
        pane.store.remove();
    }

    function closeTab(key) {
        if (key === "all" || !state.panes[key]) return;
        var pane = state.panes[key];
        var visibleKey = activeKeyFromDom();
        var wasVisible = visibleKey === key && contentIsWorkspace();
        if (wasVisible) stashVisible();
        disconnectPane(pane);
        delete state.panes[key];
        if (wasVisible) {
            state.active = "all";
            showStored("all");
        }
        renderTabs();
        persist();
    }

    function renderTabs() {
        if (!state.bar) return;
        state.bar.textContent = "";
        Object.keys(state.panes).forEach(function (key) {
            var pane = state.panes[key];
            var tab = document.createElement("button");
            tab.type = "button";
            tab.className = "sirk-device-tab" + (state.active === key ? " is-active" : "");
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", state.active === key ? "true" : "false");
            tab.setAttribute("data-device-workspace-key", key);
            tab.title = pane.name;

            var label = document.createElement("span");
            label.className = "sirk-device-tab-label";
            label.textContent = pane.name;
            tab.appendChild(label);

            tab.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                activate(key);
            }, true);

            if (key !== "all") {
                var close = document.createElement("span");
                close.className = "sirk-device-tab-close";
                close.textContent = "×";
                close.setAttribute("role", "button");
                close.setAttribute("aria-label", (language() === "en" ? "Close " : "Zamknij ") + pane.name);
                close.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                    closeTab(key);
                }, true);
                tab.appendChild(close);
            }
            state.bar.appendChild(tab);
        });
    }

    function candidate(target) {
        if (!devicesActive() || !state.content || !target || !target.closest) return null;
        if (!contentIsDeviceList()) return null;
        var row = target.closest("[data-device-id],.sirk-device-row");
        if (!row || !state.shell.contains(row)) return null;
        var nodeId = clean(row.getAttribute("data-device-id"));
        var nameNode = row.querySelector(".sirk-device-primary strong,[data-device-name],.sirk-device-name,strong");
        var name = clean(nameNode && nameNode.textContent || "");
        if (!nodeId || !name) return null;
        return { key: "node:" + safeKey(nodeId), nodeId: nodeId, name: name.slice(0, 64) };
    }

    function beginOpen(info, event) {
        var existing = state.panes[info.key];
        if (existing && existing.loaded && existing.store.childNodes.length) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            activate(info.key);
            return;
        }

        if (state.panes.all.store.childNodes.length === 0 && contentIsDeviceList()) {
            moveChildren(state.content, state.panes.all.store);
            state.panes.all.loaded = true;
        }

        state.pending = info;
        window.clearTimeout(state.finalizeTimer);
        state.finalizeTimer = window.setTimeout(finalizeOpen, 80);
    }

    function finalizeOpen() {
        if (!state.pending || !state.content) return;
        if (!contentIsWorkspace()) {
            state.finalizeTimer = window.setTimeout(finalizeOpen, 100);
            return;
        }

        var info = state.pending;
        state.pending = null;
        var pane = state.panes[info.key];
        if (!pane) {
            pane = { key: info.key, name: info.name, nodeId: info.nodeId, store: createStore(info.key), loaded: false };
            state.cache.appendChild(pane.store);
            state.panes[info.key] = pane;
        }
        pane.name = info.name || pane.name;
        pane.nodeId = info.nodeId || pane.nodeId;
        pane.loaded = false;
        state.active = info.key;
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
    }

    function captureInitialList() {
        if (!devicesActive() || !contentIsDeviceList()) return;
        state.active = "all";
        state.panes.all.loaded = true;
        renderTabs();
    }

    function scheduleRestore() {
        if (!state.metadataRestored || state.restoreActive === "all" || !devicesActive()) return;
        var pane = state.panes[state.restoreActive];
        if (!pane || !findDeviceRow(pane.nodeId)) return;
        window.clearTimeout(state.restoreTimer);
        state.restoreTimer = window.setTimeout(function () {
            var key = state.restoreActive;
            state.restoreActive = "all";
            activate(key);
        }, 180);
    }

    function bind() {
        if (!state.shell || state.shell.__myCompanyDeviceTabsV7Bound) return;
        state.shell.__myCompanyDeviceTabsV7Bound = true;

        state.shell.addEventListener("click", function (event) {
            ensureInfrastructure();
            var info = candidate(event.target);
            if (info) beginOpen(info, event);
        }, true);

        state.shell.addEventListener("click", function () {
            window.setTimeout(function () { syncVisibility(); captureInitialList(); scheduleRestore(); }, 0);
        });

        window.addEventListener("sirkportal:languagechange", function () {
            updateLanguage();
            renderTabs();
        });
    }

    function schedule() {
        window.setTimeout(function () {
            ensureInfrastructure();
            syncVisibility();
            captureInitialList();
            if (state.pending) finalizeOpen();
            scheduleRestore();
        }, 20);
    }

    function start() {
        ensureInfrastructure();
        if (!state.observer) {
            state.observer = new MutationObserver(schedule);
            state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
        }
        window.setInterval(function () { ensureInfrastructure(); syncVisibility(); captureInitialList(); scheduleRestore(); }, 1000);
    }

    window.MyCompanyDeviceTabs = {
        mount: ensureInfrastructure,
        activateAll: activateAll,
        activate: activate,
        close: closeTab,
        debug: function () {
            var result = { active: state.active, visible: activeKeyFromDom(), content: contentIsWorkspace() ? "workspace" : contentIsDeviceList() ? "all" : "other", stores: {} };
            Object.keys(state.panes).forEach(function (key) { result.stores[key] = state.panes[key].store.childElementCount; });
            return result;
        }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}());