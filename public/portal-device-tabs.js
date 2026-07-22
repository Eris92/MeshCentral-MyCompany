(function () {
    "use strict";

    if (window.__myCompanyDeviceTabsLoaded) return;
    window.__myCompanyDeviceTabsLoaded = true;

    var state = {
        root: null,
        view: null,
        bar: null,
        cache: null,
        panes: Object.create(null),
        active: "all",
        pending: null,
        finalizeTimer: 0,
        ensureTimer: 0,
        observer: null
    };

    function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
    function safeKey(value) { return text(value).replace(/[^a-z0-9._:-]/gi, "_").slice(0, 180); }

    function findDeviceView(root) {
        if (!root) return null;
        var direct = root.querySelector([
            '[data-view="devices"]',
            '[data-view="device"]',
            '[data-sirk-view-content="devices"]',
            '#sirkDevicesView',
            '.sirk-devices-view',
            '.sirk-device-view'
        ].join(","));
        if (direct) return direct;

        var candidates = root.querySelectorAll("section,main,div");
        for (var i = 0; i < candidates.length; i++) {
            var heading = candidates[i].querySelector && candidates[i].querySelector(":scope > h1,:scope > h2,:scope > header h1,:scope > header h2");
            var title = text(heading && heading.textContent).toLowerCase();
            if ((title === "devices" || title === "urządzenia" || title === "urzadzenia") && candidates[i].querySelector(".sirk-device-row,.sirk-device-card,.sirk-device-item,[data-node-id],[data-nodeid]")) return candidates[i];
        }
        return null;
    }

    function newStore(key) {
        var store = document.createElement("div");
        store.className = "sirk-device-tab-store";
        store.setAttribute("data-device-tab-store", key);
        return store;
    }

    function ensureInfrastructure() {
        var root = document.getElementById("sirkPortalRoot");
        var view = findDeviceView(root);
        if (!root || !view) return false;

        state.root = root;
        if (state.view !== view) {
            state.view = view;
            state.bar = null;
        }

        if (!state.cache || !state.cache.isConnected) {
            state.cache = document.createElement("div");
            state.cache.className = "sirk-device-tab-cache";
            state.cache.hidden = true;
            state.cache.setAttribute("aria-hidden", "true");
            root.appendChild(state.cache);
        }

        if (!state.bar || !state.bar.isConnected) {
            state.bar = document.createElement("div");
            state.bar.className = "sirk-device-tabs";
            state.bar.setAttribute("role", "tablist");
            state.bar.setAttribute("aria-label", "Otwarte urządzenia");
            view.parentNode.insertBefore(state.bar, view);
        }

        if (!state.panes.all) {
            state.panes.all = { key: "all", name: "ALL | Wszystkie", nodeId: "", store: newStore("all") };
            state.cache.appendChild(state.panes.all.store);
        }

        syncBarVisibility();
        renderTabs();
        bindRoot();
        return true;
    }

    function syncBarVisibility() {
        if (!state.bar || !state.view) return;
        var hidden = state.view.hidden || state.view.style.display === "none";
        state.bar.hidden = hidden;
        state.bar.style.display = hidden ? "none" : "";
    }

    function moveChildren(source, target) {
        if (!source || !target) return;
        while (source.firstChild) target.appendChild(source.firstChild);
    }

    function stashActive() {
        var pane = state.panes[state.active];
        if (!pane || !state.view) return;
        moveChildren(state.view, pane.store);
    }

    function activate(key) {
        var pane = state.panes[key];
        if (!pane || !state.view) return;
        if (key !== state.active) stashActive();
        state.active = key;
        moveChildren(pane.store, state.view);
        renderTabs();
        state.view.dispatchEvent(new CustomEvent("mycompany:device-tab-activated", { bubbles: true, detail: { key: key, nodeId: pane.nodeId } }));
        window.dispatchEvent(new Event("resize"));
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
        if (state.active === key) {
            stashActive();
            state.active = "all";
            moveChildren(state.panes.all.store, state.view);
        }
        disconnectPane(pane);
        delete state.panes[key];
        renderTabs();
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
            tab.onclick = function () { activate(key); };

            if (key !== "all") {
                var close = document.createElement("span");
                close.className = "sirk-device-tab-close";
                close.textContent = "×";
                close.setAttribute("role", "button");
                close.setAttribute("aria-label", "Zamknij " + pane.name);
                close.onclick = function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeTab(key);
                };
                tab.appendChild(close);
            }
            state.bar.appendChild(tab);
        });
    }

    function attributeValue(element) {
        if (!element) return "";
        var names = ["data-node-id", "data-nodeid", "data-device-id", "data-deviceid", "data-node", "data-device"];
        var nodes = [element].concat(Array.prototype.slice.call(element.querySelectorAll ? element.querySelectorAll("[data-node-id],[data-nodeid],[data-device-id],[data-deviceid],[data-node],[data-device],a[href]") : []));
        for (var n = 0; n < nodes.length; n++) {
            for (var i = 0; i < names.length; i++) {
                var value = nodes[n].getAttribute && nodes[n].getAttribute(names[i]);
                if (value) return value;
            }
            var href = nodes[n].getAttribute && nodes[n].getAttribute("href") || "";
            var match = href.match(/[?&#](?:nodeid|node|device)=([^&#]+)/i);
            if (match) return decodeURIComponent(match[1]);
        }
        return "";
    }

    function candidate(target) {
        if (!state.view || state.active !== "all" || !target || !target.closest) return null;
        var element = target.closest('[data-node-id],[data-nodeid],[data-device-id],[data-deviceid],[data-node],[data-device],.sirk-device-row,.sirk-device-card,.sirk-device-item,.device-row,.device-card,[role="row"]');
        if (!element || !state.view.contains(element)) return null;
        if (target.closest("button,input,select,textarea") && !target.closest(".sirk-device-row,.sirk-device-card,.sirk-device-item,.device-row,.device-card")) return null;

        var nodeId = attributeValue(element);
        var nameNode = element.querySelector && element.querySelector('[data-device-name],.sirk-device-name,.device-name,[data-host-name],strong,b');
        var name = text(nameNode && nameNode.textContent || element.getAttribute("data-device-name") || element.getAttribute("data-host-name") || "");
        if (!name) {
            var raw = text(element.textContent);
            name = raw.split(/\s{2,}| · |\n/)[0];
        }
        if (!nodeId) nodeId = safeKey(name);
        if (!name || name.length > 100 || !nodeId) return null;
        return { element: element, key: "node:" + safeKey(nodeId), nodeId: nodeId, name: name.slice(0, 64) };
    }

    function beginOpen(info) {
        if (state.panes[info.key]) {
            activate(info.key);
            return false;
        }
        state.pending = info;
        stashActive();
        window.clearTimeout(state.finalizeTimer);
        state.finalizeTimer = window.setTimeout(finalizeOpen, 350);
        return true;
    }

    function finalizeOpen() {
        if (!state.pending || !state.view) return;
        var info = state.pending;
        var hasContent = state.view.childNodes.length > 0;
        if (!hasContent) {
            state.finalizeTimer = window.setTimeout(finalizeOpen, 200);
            return;
        }
        state.pending = null;
        var pane = { key: info.key, name: info.name, nodeId: info.nodeId, store: newStore(info.key) };
        state.cache.appendChild(pane.store);
        state.panes[info.key] = pane;
        state.active = info.key;
        renderTabs();
        window.dispatchEvent(new Event("resize"));
    }

    function bindRoot() {
        if (!state.root || state.root.__myCompanyDeviceTabsBound) return;
        state.root.__myCompanyDeviceTabsBound = true;
        state.root.addEventListener("click", function (event) {
            if (!ensureInfrastructure()) return;
            var info = candidate(event.target);
            if (!info) return;
            if (state.panes[info.key]) {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                activate(info.key);
                return;
            }
            beginOpen(info);
        }, true);
    }

    function scheduleEnsure() {
        window.clearTimeout(state.ensureTimer);
        state.ensureTimer = window.setTimeout(function () {
            ensureInfrastructure();
            if (state.pending) {
                window.clearTimeout(state.finalizeTimer);
                state.finalizeTimer = window.setTimeout(finalizeOpen, 120);
            }
            syncBarVisibility();
        }, 20);
    }

    function start() {
        ensureInfrastructure();
        if (!state.observer) {
            state.observer = new MutationObserver(scheduleEnsure);
            state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
        }
        window.setInterval(function () { ensureInfrastructure(); }, 1000);
    }

    window.MyCompanyDeviceTabs = {
        mount: ensureInfrastructure,
        activateAll: function () { if (state.panes.all) activate("all"); },
        close: closeTab
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}());