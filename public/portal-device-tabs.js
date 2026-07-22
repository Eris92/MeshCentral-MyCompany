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
        timer: 0
    };

    function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
    function safeKey(value) { return text(value).replace(/[^a-z0-9._:-]/gi, "_").slice(0, 180); }

    function deviceView() {
        var root = document.getElementById("sirkPortalRoot");
        return root && root.querySelector('[data-view="devices"]');
    }

    function ensureInfrastructure() {
        var root = document.getElementById("sirkPortalRoot");
        var view = deviceView();
        if (!root || !view) return false;
        state.root = root;
        state.view = view;

        if (!state.cache || !state.cache.isConnected) {
            state.cache = document.createElement("div");
            state.cache.className = "sirk-device-tab-cache";
            state.cache.hidden = true;
            root.appendChild(state.cache);
        }
        if (!state.bar || !state.bar.isConnected) {
            state.bar = document.createElement("div");
            state.bar.className = "sirk-device-tabs";
            state.bar.setAttribute("role", "tablist");
            view.parentNode.insertBefore(state.bar, view);
        }
        if (!state.panes.all) {
            state.panes.all = { key: "all", name: "ALL | Wszystkie", nodeId: "", fragment: document.createDocumentFragment() };
            captureCurrent("all");
        }
        renderTabs();
        return true;
    }

    function currentNodes() {
        return Array.prototype.slice.call(state.view.childNodes);
    }

    function captureCurrent(key) {
        var pane = state.panes[key];
        if (!pane || !state.view) return;
        pane.fragment = document.createDocumentFragment();
        currentNodes().forEach(function (node) { pane.fragment.appendChild(node); });
    }

    function stashActive() {
        if (!state.panes[state.active] || !state.view) return;
        captureCurrent(state.active);
        state.cache.appendChild(state.panes[state.active].fragment);
    }

    function activate(key) {
        if (!state.panes[key] || key === state.active || !state.view) return;
        stashActive();
        state.active = key;
        state.view.appendChild(state.panes[key].fragment);
        renderTabs();
        state.view.dispatchEvent(new CustomEvent("mycompany:device-tab-activated", { bubbles: true, detail: { key: key } }));
        window.dispatchEvent(new Event("resize"));
    }

    function disconnectPane(pane) {
        if (!pane || !pane.fragment) return;
        var holder = document.createElement("div");
        holder.appendChild(pane.fragment);
        holder.querySelectorAll("button").forEach(function (button) {
            var label = text(button.textContent).toLowerCase();
            if (label === "rozłącz" || label === "disconnect") {
                try { button.click(); } catch (error) {}
            }
        });
        holder.remove();
    }

    function closeTab(key) {
        if (key === "all" || !state.panes[key]) return;
        var pane = state.panes[key];
        if (state.active === key) {
            captureCurrent(key);
            state.view.textContent = "";
            state.active = "all";
            state.view.appendChild(state.panes.all.fragment);
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
        for (var i = 0; i < names.length; i++) {
            var value = element.getAttribute && element.getAttribute(names[i]);
            if (value) return value;
        }
        var href = element.getAttribute && element.getAttribute("href") || "";
        var match = href.match(/[?&#](?:nodeid|node|device)=([^&#]+)/i);
        return match ? decodeURIComponent(match[1]) : "";
    }

    function candidate(target) {
        if (!state.view || state.active !== "all") return null;
        var element = target.closest('[data-node-id],[data-nodeid],[data-device-id],[data-deviceid],[data-node],[data-device],.sirk-device-row,.sirk-device-card,.sirk-device-item,[role="row"]');
        if (!element || !state.view.contains(element)) return null;
        if (element.closest("button,input,select,textarea,a") && !element.matches("button,a")) return null;
        var nodeId = attributeValue(element);
        var nameNode = element.querySelector && element.querySelector('[data-device-name],.sirk-device-name,.device-name,strong,b');
        var name = text(nameNode && nameNode.textContent || element.getAttribute("data-device-name") || element.textContent).split(" · ")[0];
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
        captureCurrent("all");
        state.cache.appendChild(state.panes.all.fragment);
        window.clearTimeout(state.timer);
        state.timer = window.setTimeout(finalizeOpen, 180);
        return true;
    }

    function finalizeOpen() {
        if (!state.pending || !state.view) return;
        var info = state.pending;
        state.pending = null;
        var nodes = currentNodes();
        if (!nodes.length) {
            state.view.appendChild(state.panes.all.fragment);
            state.active = "all";
            renderTabs();
            return;
        }
        var pane = { key: info.key, name: info.name, nodeId: info.nodeId, fragment: document.createDocumentFragment() };
        nodes.forEach(function (node) { pane.fragment.appendChild(node); });
        state.panes[info.key] = pane;
        state.active = info.key;
        state.view.appendChild(pane.fragment);
        renderTabs();
        window.dispatchEvent(new Event("resize"));
    }

    function bind() {
        if (!ensureInfrastructure() || state.root.__myCompanyDeviceTabsBound) return;
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
        new MutationObserver(function () {
            ensureInfrastructure();
            if (state.pending) {
                window.clearTimeout(state.timer);
                state.timer = window.setTimeout(finalizeOpen, 120);
            }
        }).observe(state.root, { childList: true, subtree: true });
    }

    function start() {
        if (bind()) return;
        var attempts = 0;
        var timer = window.setInterval(function () {
            attempts++;
            if (ensureInfrastructure()) {
                window.clearInterval(timer);
                bind();
            } else if (attempts > 120) window.clearInterval(timer);
        }, 100);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}());
