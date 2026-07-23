(function () {
    "use strict";

    if (window.__myCompanyDeviceTabsV10Loaded) return;
    window.__myCompanyDeviceTabsV10Loaded = true;

    var STORAGE_KEY = "mycompany.sirkportal.deviceTabs";
    var CHILD_PARAM = "sirkWorkspaceChild";
    var NODE_PARAM = "sirkWorkspaceNode";
    var NAME_PARAM = "sirkWorkspaceName";

    function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
    function safeKey(value) { return clean(value).replace(/[^a-z0-9._:-]/gi, "_").slice(0, 180); }
    function language() {
        try { return localStorage.getItem("sirkPortal.language") === "en" ? "en" : "pl"; }
        catch (error) { return document.documentElement.lang === "en" ? "en" : "pl"; }
    }
    function allLabel() { return language() === "en" ? "All" : "Wszystkie"; }
    function isChildWorkspace() {
        try { return new URL(window.location.href).searchParams.get(CHILD_PARAM) === "1"; }
        catch (error) { return false; }
    }

    function startChildWorkspace() {
        var url = new URL(window.location.href);
        var nodeId = clean(url.searchParams.get(NODE_PARAM));
        document.documentElement.classList.add("sirk-device-workspace-child");
        if (!nodeId) return;

        var opened = false;
        var attempts = 0;
        function openNode() {
            if (opened) return;
            attempts += 1;
            var devices = document.querySelector('.sirk-standalone-nav [data-view="devices"]');
            if (devices && !devices.classList.contains("is-active")) {
                try { devices.click(); } catch (error) {}
            }
            var rows = document.querySelectorAll("#sirkStandaloneContent [data-device-id]");
            for (var i = 0; i < rows.length; i += 1) {
                if (String(rows[i].getAttribute("data-device-id") || "") === nodeId) {
                    opened = true;
                    try { rows[i].click(); } catch (error) { opened = false; }
                    break;
                }
            }
            if (!opened && attempts < 300) window.setTimeout(openNode, 100);
        }
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", openNode, { once: true });
        else openNode();
        return;
    }

    if (isChildWorkspace()) {
        startChildWorkspace();
        return;
    }

    var state = {
        shell: null,
        main: null,
        content: null,
        bar: null,
        cache: null,
        panes: Object.create(null),
        active: "all",
        restored: false,
        restoreActive: "all",
        bound: false,
        observer: null
    };

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

    function workspaceUrl(pane) {
        var url = new URL(window.location.href);
        url.searchParams.set(CHILD_PARAM, "1");
        url.searchParams.set(NODE_PARAM, pane.nodeId);
        url.searchParams.set(NAME_PARAM, pane.name);
        url.searchParams.delete("sirkNative");
        url.hash = "";
        return url.href;
    }

    function createHostFrame(pane) {
        var wrapper = document.createElement("div");
        wrapper.className = "sirk-device-isolated-workspace";
        wrapper.setAttribute("data-device-isolated-key", pane.key);

        var frame = document.createElement("iframe");
        frame.className = "sirk-device-isolated-frame";
        frame.title = pane.name;
        frame.allow = "clipboard-read; clipboard-write; fullscreen";
        frame.src = workspaceUrl(pane);
        wrapper.appendChild(frame);
        return wrapper;
    }

    function ensurePane(key, nodeId, name, createFrame) {
        var pane = state.panes[key];
        if (!pane) {
            pane = { key: key, nodeId: nodeId || "", name: name || nodeId || key, store: createStore(key), frameCreated: false };
            state.cache.appendChild(pane.store);
            state.panes[key] = pane;
        }
        if (nodeId) pane.nodeId = nodeId;
        if (name) pane.name = name;
        if (createFrame && key !== "all" && !pane.frameCreated) {
            pane.store.appendChild(createHostFrame(pane));
            pane.frameCreated = true;
        }
        return pane;
    }

    function restoreMetadata() {
        if (state.restored || !state.cache) return;
        state.restored = true;
        var saved = readPersisted();
        (Array.isArray(saved.tabs) ? saved.tabs : []).forEach(function (item) {
            var nodeId = clean(item && item.nodeId);
            var name = clean(item && item.name);
            var key = clean(item && item.key) || (nodeId ? "node:" + safeKey(nodeId) : "");
            if (!key || !nodeId) return;
            ensurePane(key, nodeId, name || nodeId, false);
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
            state.panes.all = { key: "all", nodeId: "", name: allLabel(), store: createStore("all"), frameCreated: true };
            state.cache.appendChild(state.panes.all.store);
        }
        restoreMetadata();
        bind();
        sync();
        return true;
    }

    function contentIsDeviceList() {
        return !!(state.content && state.content.querySelector("[data-device-id],#sirkDevicesHost,.sirk-device-groups"));
    }

    function stashActive() {
        if (!state.content || !state.content.childNodes.length) return;
        var pane = state.panes[state.active];
        if (!pane) return;
        moveChildren(state.content, pane.store);
    }

    function showPane(key) {
        var pane = state.panes[key];
        if (!pane || !state.content) return false;
        if (state.active !== key) stashActive();
        if (key !== "all" && !pane.frameCreated) {
            pane.store.appendChild(createHostFrame(pane));
            pane.frameCreated = true;
        }
        if (!pane.store.childNodes.length) return false;
        moveChildren(pane.store, state.content);
        state.active = key;
        renderTabs();
        persist();
        window.dispatchEvent(new Event("resize"));
        return true;
    }

    function activate(key) {
        if (!state.panes[key]) return;
        showPane(key);
    }

    function activateAll() { activate("all"); }

    function closeTab(key) {
        if (key === "all" || !state.panes[key]) return;
        var pane = state.panes[key];
        var wasActive = state.active === key;
        if (wasActive) stashActive();
        pane.store.querySelectorAll("iframe").forEach(function (frame) { frame.src = "about:blank"; });
        pane.store.remove();
        delete state.panes[key];
        if (wasActive) {
            state.active = "all";
            showPane("all");
        }
        renderTabs();
        persist();
    }

    function renderTabs() {
        if (!state.bar) return;
        state.panes.all.name = allLabel();
        var signature = Object.keys(state.panes).map(function (key) { return key + ":" + state.panes[key].name; }).join("|") + "@" + state.active;
        if (state.bar.getAttribute("data-tabs-signature") === signature) return;
        state.bar.setAttribute("data-tabs-signature", signature);
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
            if (key !== "all") {
                var close = document.createElement("span");
                close.className = "sirk-device-tab-close";
                close.textContent = "×";
                close.setAttribute("role", "button");
                close.setAttribute("data-device-tab-close", key);
                close.setAttribute("aria-label", (language() === "en" ? "Close " : "Zamknij ") + pane.name);
                tab.appendChild(close);
            }
            state.bar.appendChild(tab);
        });
    }

    function hostInfo(target) {
        if (!devicesActive() || state.active !== "all" || !target || !target.closest || !contentIsDeviceList()) return null;
        var row = target.closest("[data-device-id],.sirk-device-row");
        if (!row || !state.content.contains(row)) return null;
        var nodeId = clean(row.getAttribute("data-device-id"));
        var nameNode = row.querySelector(".sirk-device-primary strong,[data-device-name],.sirk-device-name,strong");
        var name = clean(nameNode && nameNode.textContent || "");
        if (!nodeId || !name) return null;
        return { key: "node:" + safeKey(nodeId), nodeId: nodeId, name: name.slice(0, 64) };
    }

    function intercept(event) {
        if (!ensureInfrastructure()) return;
        var close = event.target && event.target.closest && event.target.closest("[data-device-tab-close]");
        if (close && state.bar.contains(close)) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            closeTab(close.getAttribute("data-device-tab-close"));
            return;
        }
        var tab = event.target && event.target.closest && event.target.closest(".sirk-device-tab[data-device-workspace-key]");
        if (tab && state.bar.contains(tab)) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            activate(tab.getAttribute("data-device-workspace-key"));
            return;
        }
        var info = hostInfo(event.target);
        if (!info) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if (state.panes.all.store.childNodes.length === 0) moveChildren(state.content, state.panes.all.store);
        ensurePane(info.key, info.nodeId, info.name, true);
        state.active = "all";
        showPane(info.key);
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        window.addEventListener("click", intercept, true);
        window.addEventListener("sirkportal:languagechange", function () { renderTabs(); });
    }

    function sync() {
        if (!state.bar) return;
        var visible = devicesActive();
        state.bar.hidden = !visible;
        state.bar.style.display = visible ? "flex" : "none";
        if (visible && state.active === "all" && contentIsDeviceList()) {
            state.panes.all.name = allLabel();
            renderTabs();
            if (state.restoreActive !== "all" && state.panes[state.restoreActive]) {
                var restore = state.restoreActive;
                state.restoreActive = "all";
                window.setTimeout(function () { activate(restore); }, 0);
            }
        }
    }

    function start() {
        ensureInfrastructure();
        state.observer = new MutationObserver(function () { window.setTimeout(function () { ensureInfrastructure(); sync(); }, 0); });
        state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
        window.setInterval(sync, 1000);
    }

    window.MyCompanyDeviceTabs = {
        mount: ensureInfrastructure,
        activateAll: activateAll,
        activate: activate,
        close: closeTab,
        debug: function () {
            var result = { active: state.active, mode: "isolated-iframes", stores: {} };
            Object.keys(state.panes).forEach(function (key) {
                result.stores[key] = { children: state.panes[key].store.childElementCount, frame: !!state.panes[key].store.querySelector("iframe") || !!(state.content && state.content.querySelector('[data-device-isolated-key="' + key.replace(/"/g, "\\\"") + '"] iframe')) };
            });
            return result;
        }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}());