(function () {
    "use strict";

    if (window.__myCompanyStandaloneDeviceTabsV5Loaded) return;
    window.__myCompanyStandaloneDeviceTabsV5Loaded = true;

    var STORAGE_KEY = "mycompany.sirkportal.deviceTabs";
    var state = {
        root: null,
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
        restored: false,
        restoreActive: "all"
    };

    function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
    function safeKey(value) { return text(value).replace(/[^a-z0-9._:-]/gi, "_").slice(0, 180); }
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
        if (state.restored || !state.cache) return;
        state.restored = true;
        var saved = readPersisted();
        (Array.isArray(saved.tabs) ? saved.tabs : []).forEach(function (item) {
            var nodeId = text(item && item.nodeId);
            var name = text(item && item.name);
            var key = text(item && item.key) || (nodeId ? "node:" + safeKey(nodeId) : "");
            if (!key || !nodeId || state.panes[key]) return;
            var pane = { key: key, nodeId: nodeId, name: name || nodeId, store: createStore(key), loaded: false };
            state.cache.appendChild(pane.store);
            state.panes[key] = pane;
        });
        state.restoreActive = state.panes[saved.active] ? saved.active : "all";
    }

    function ensureInfrastructure() {
        var root = document.getElementById("sirkPortalRoot");
        var content = document.getElementById("sirkStandaloneContent");
        var main = content && content.closest(".sirk-standalone-main");
        if (!root || !content || !main) return false;

        state.root = root;
        state.content = content;
        state.main = main;

        document.querySelectorAll(".sirk-standalone-sidebar .sirk-device-tabs,.sirk-standalone-nav .sirk-device-tabs").forEach(function (wrong) { wrong.remove(); });

        if (!state.cache || !state.cache.isConnected) {
            state.cache = document.createElement("div");
            state.cache.className = "sirk-device-tab-cache";
            state.cache.hidden = true;
            state.cache.setAttribute("aria-hidden", "true");
            root.appendChild(state.cache);
        }

        if (!state.bar || !state.bar.isConnected) {
            state.bar = document.createElement("div");
            state.bar.className = "sirk-device-tabs sirk-device-tabs-standalone";
            state.bar.setAttribute("role", "tablist");
            main.insertBefore(state.bar, content);
        }

        if (!state.panes.all) {
            state.panes.all = { key: "all", name: allLabel(), nodeId: "", store: createStore("all"), loaded: true };
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

    function stashActive() {
        var pane = state.panes[state.active];
        if (!pane || !pane.store || !state.content) return;
        moveChildren(state.content, pane.store);
        pane.loaded = pane.store.childNodes.length > 0;
    }

    function showStored(key) {
        var pane = state.panes[key];
        if (!pane || !pane.store || !state.content) return false;
        state.content.textContent = "";
        moveChildren(pane.store, state.content);
        pane.loaded = state.content.childNodes.length > 0;
        return pane.loaded;
    }

    function activateAll() {
        if (!state.content || !state.panes.all) return;
        if (state.active !== "all") stashActive();
        state.active = "all";
        state.pending = null;
        showStored("all");
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
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

    function openPaneFromAll(pane) {
        if (!pane || !state.content || !state.panes.all) return;
        if (state.active !== "all") {
            stashActive();
            state.active = "all";
            showStored("all");
        }
        var row = findDeviceRow(pane.nodeId);
        if (!row) return;
        state.pending = { key: pane.key, nodeId: pane.nodeId, name: pane.name, existing: true };
        row.click();
    }

    function activate(key) {
        var pane = state.panes[key];
        if (!pane || !state.content) return;
        if (key === "all") { activateAll(); return; }
        if (state.active === key) return;
        if (state.active !== "all") stashActive();
        else if (state.panes.all.store.childNodes.length === 0) stashActive();
        state.active = key;
        if (pane.loaded && pane.store.childNodes.length) {
            showStored(key);
            renderTabs();
            persist();
            window.dispatchEvent(new Event("resize"));
            return;
        }
        state.active = "all";
        showStored("all");
        renderTabs();
        openPaneFromAll(pane);
    }

    function disconnectPane(pane) {
        if (!pane || !pane.store) return;
        pane.store.querySelectorAll("button").forEach(function (button) {
            var label = text(button.textContent).toLowerCase();
            if (label === "rozłącz" || label === "disconnect") {
                try { button.click(); } catch (error) {}
            }
        });
        pane.store.remove();
    }

    function closeTab(key) {
        if (key === "all" || !state.panes[key]) return;
        var pane = state.panes[key];
        var wasActive = state.active === key;
        if (wasActive) stashActive();
        disconnectPane(pane);
        delete state.panes[key];
        if (wasActive) {
            state.active = "all";
            showStored("all");
        }
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
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
            tab.title = pane.name;

            var label = document.createElement("span");
            label.className = "sirk-device-tab-label";
            label.textContent = pane.name;
            tab.appendChild(label);
            tab.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                activate(key);
            });

            if (key !== "all") {
                var close = document.createElement("span");
                close.className = "sirk-device-tab-close";
                close.textContent = "×";
                close.setAttribute("role", "button");
                close.setAttribute("aria-label", (language() === "en" ? "Close " : "Zamknij ") + pane.name);
                close.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeTab(key);
                });
                tab.appendChild(close);
            }
            state.bar.appendChild(tab);
        });
    }

    function attributeValue(element) {
        if (!element) return "";
        var names = ["data-device-id", "data-node-id", "data-nodeid", "data-deviceid", "data-node", "data-device"];
        var nodes = [element].concat(Array.prototype.slice.call(element.querySelectorAll ? element.querySelectorAll("[data-device-id],[data-node-id],[data-nodeid],[data-deviceid],[data-node],[data-device],a[href]") : []));
        for (var n = 0; n < nodes.length; n++) {
            for (var i = 0; i < names.length; i++) {
                var value = nodes[n].getAttribute && nodes[n].getAttribute(names[i]);
                if (value) return value;
            }
        }
        return "";
    }

    function candidate(target) {
        if (!devicesActive() || state.active !== "all" || !state.content || !target || !target.closest) return null;
        var element = target.closest('[data-device-id],.sirk-device-row');
        if (!element || !state.root.contains(element)) return null;
        var nodeId = attributeValue(element);
        var nameNode = element.querySelector && element.querySelector('.sirk-device-primary strong,[data-device-name],.sirk-device-name,.device-name,strong');
        var name = text(nameNode && nameNode.textContent || element.getAttribute("data-device-name") || "");
        if (!nodeId || !name) return null;
        return { key: "node:" + safeKey(nodeId), nodeId: nodeId, name: name.slice(0, 64) };
    }

    function beginOpen(info, event) {
        if (state.panes[info.key] && state.panes[info.key].loaded) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            activate(info.key);
            return;
        }
        if (state.panes.all.store.childNodes.length === 0) moveChildren(state.content, state.panes.all.store);
        state.pending = { key: info.key, nodeId: info.nodeId, name: info.name, existing: !!state.panes[info.key] };
        window.clearTimeout(state.finalizeTimer);
        state.finalizeTimer = window.setTimeout(finalizeOpen, 80);
    }

    function finalizeOpen() {
        if (!state.pending || !state.content) return;
        var workspace = state.content.querySelector(".sirk-device-workspace");
        if (!workspace) {
            state.finalizeTimer = window.setTimeout(finalizeOpen, 100);
            return;
        }
        var info = state.pending;
        state.pending = null;
        var pane = state.panes[info.key];
        if (!pane) {
            pane = { key: info.key, name: info.name, nodeId: info.nodeId, store: createStore(info.key), loaded: true };
            state.cache.appendChild(pane.store);
            state.panes[info.key] = pane;
        }
        pane.name = info.name || pane.name;
        pane.nodeId = info.nodeId || pane.nodeId;
        pane.loaded = true;
        state.active = info.key;
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
    }

    function scheduleRestore() {
        if (!state.restored || state.restoreActive === "all" || !devicesActive()) return;
        var pane = state.panes[state.restoreActive];
        if (!pane) { state.restoreActive = "all"; return; }
        if (!findDeviceRow(pane.nodeId)) return;
        window.clearTimeout(state.restoreTimer);
        state.restoreTimer = window.setTimeout(function () {
            var key = state.restoreActive;
            state.restoreActive = "all";
            activate(key);
        }, 150);
    }

    function bind() {
        if (!state.root || state.root.__myCompanyStandaloneDeviceTabsV5Bound) return;
        state.root.__myCompanyStandaloneDeviceTabsV5Bound = true;

        state.root.addEventListener("click", function (event) {
            ensureInfrastructure();
            var info = candidate(event.target);
            if (!info) return;
            beginOpen(info, event);
        }, true);

        state.root.addEventListener("click", function () { window.setTimeout(function () { syncVisibility(); scheduleRestore(); }, 0); });
        window.addEventListener("sirkportal:languagechange", function () {
            updateLanguage();
            renderTabs();
        });
    }

    function schedule() {
        window.setTimeout(function () {
            ensureInfrastructure();
            syncVisibility();
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
        window.setInterval(function () { ensureInfrastructure(); syncVisibility(); scheduleRestore(); }, 1000);
    }

    window.MyCompanyDeviceTabs = { mount: ensureInfrastructure, activateAll: activateAll, activate: activate, close: closeTab };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}());