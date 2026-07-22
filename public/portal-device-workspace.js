(function () {
    "use strict";

    if (window.__myCompanyPortalDeviceWorkspaceLoaded) return;
    window.__myCompanyPortalDeviceWorkspaceLoaded = true;

    var content = document.getElementById("sirkStandaloneContent");
    var core = window.MyCompanyCore;
    var selectedNodeId = "";
    var selectedNode = null;
    var inventory = null;
    var activeTab = "general";
    var bridge = null;
    var bridgeSequence = 0;
    var transformScheduled = false;

    var VIEWMODES = { desktop: 11, terminal: 12, files: 13, registry: 9, software: 18, amt: 14 };
    var PANEL_IDS = {
        desktop: ["p11"],
        terminal: ["p12"],
        files: ["p13"],
        registry: ["p9", "p9registry", "p9Registry"],
        software: ["p18", "p18software", "p18Software"],
        amt: ["p14", "p14amt", "p14Amt"]
    };

    var TEXT = {
        pl: {
            general: "Ogólne", desktop: "Pulpit", terminal: "Terminal", files: "Pliki",
            registry: "Rejestr", software: "Oprogramowanie", amt: "Intel AMT",
            back: "Wróć do urządzeń", online: "Online", offline: "Offline",
            name: "Nazwa", status: "Status", group: "Grupa", system: "System",
            ip: "Adres IP", lastSeen: "Ostatnio widziany", agent: "Wersja agenta", nodeId: "Node ID",
            openMesh: "Otwórz w MeshCentral", noGroup: "Bez grupy", noOs: "Brak danych o systemie",
            method: "Metoda połączenia", meshAgent: "MeshAgent", amtKvm: "Intel AMT KVM",
            connect: "Połącz", disconnect: "Rozłącz", ready: "Gotowy — kliknij Połącz.",
            loadingNative: "Ładowanie natywnej sesji MeshCentral…", preparing: "Przygotowanie modułu MeshCentral…",
            connecting: "Łączenie…", connected: "Połączono.", disconnected: "Rozłączono.",
            nativeReady: "Natywny moduł MeshCentral jest gotowy.", sessionError: "Nie udało się uruchomić natywnego modułu MeshCentral.",
            sessionMissing: "Sesja MeshCentral nie jest dostępna albo host nie został odnaleziony.", clickCanvas: "Kliknij ekran, aby przejąć klawiaturę."
        },
        en: {
            general: "Overview", desktop: "Desktop", terminal: "Terminal", files: "Files",
            registry: "Registry", software: "Software", amt: "Intel AMT",
            back: "Back to devices", online: "Online", offline: "Offline",
            name: "Name", status: "Status", group: "Group", system: "Operating system",
            ip: "IP address", lastSeen: "Last seen", agent: "Agent version", nodeId: "Node ID",
            openMesh: "Open in MeshCentral", noGroup: "No group", noOs: "No operating system data",
            method: "Connection method", meshAgent: "MeshAgent", amtKvm: "Intel AMT KVM",
            connect: "Connect", disconnect: "Disconnect", ready: "Ready — click Connect.",
            loadingNative: "Loading the native MeshCentral session…", preparing: "Preparing the MeshCentral module…",
            connecting: "Connecting…", connected: "Connected.", disconnected: "Disconnected.",
            nativeReady: "The native MeshCentral module is ready.", sessionError: "The native MeshCentral module could not be started.",
            sessionMissing: "The MeshCentral session is unavailable or the host could not be found.", clickCanvas: "Click the screen to capture the keyboard."
        }
    };

    function language() {
        try { return localStorage.getItem("sirkPortal.language") === "en" ? "en" : "pl"; }
        catch (error) { return document.documentElement.lang === "en" ? "en" : "pl"; }
    }

    function t(key) { return TEXT[language()][key] || key; }

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function shortId(value) {
        var parts = String(value || "").split("/");
        return parts[parts.length - 1] || "";
    }

    function sameNodeId(left, right) {
        left = String(left || "");
        right = String(right || "");
        return left === right || (shortId(left) && shortId(left) === shortId(right));
    }

    function formatLastSeen(value) {
        if (value == null || value === "") return "—";
        var number = Number(value);
        var date = Number.isFinite(number) ? new Date(number < 100000000000 ? number * 1000 : number) : new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(language() === "pl" ? "pl-PL" : "en-US");
    }

    function nodeOnline(node) { return Number(node && node.conn || 0) > 0; }

    function meshMap(value) {
        var map = Object.create(null);
        ((value && value.meshes) || []).forEach(function (mesh) {
            map[String(mesh.id || mesh._id || "")] = mesh;
        });
        return map;
    }

    function nodeGroup(node) {
        var map = meshMap(inventory);
        var mesh = map[String(node && (node.meshId || node.meshid) || "")];
        return String(mesh && mesh.name || t("noGroup"));
    }

    function getInventory() {
        if (inventory) return Promise.resolve(inventory);
        if (!core || typeof core.api !== "function") return Promise.reject(new Error("MyCompany API is unavailable."));
        return core.api("portal", "devices").then(function (value) {
            inventory = {
                nodes: Array.isArray(value && value.nodes) ? value.nodes : [],
                meshes: Array.isArray(value && value.meshes) ? value.meshes : []
            };
            return inventory;
        });
    }

    function findNode(value, id) {
        var nodes = value && value.nodes || [];
        for (var i = 0; i < nodes.length; i += 1) {
            if (sameNodeId(nodes[i].id || nodes[i]._id, id)) return nodes[i];
        }
        return null;
    }

    function nativeRootUrl() {
        var url = new URL(String(window.__MYCOMPANY_NATIVE_URL__ || "/meshcentral/"), window.location.href);
        url.searchParams.set("sirkNative", "1");
        return url.href;
    }

    function nativeDeviceUrl(node) {
        var url = new URL(String(window.__MYCOMPANY_NATIVE_URL__ || "/meshcentral/"), window.location.href);
        url.pathname = url.pathname.replace(/meshcentral\/?$/i, "");
        if (!url.pathname) url.pathname = "/";
        if (url.pathname.charAt(url.pathname.length - 1) !== "/") url.pathname += "/";
        url.search = "";
        url.hash = "";
        url.searchParams.set("viewmode", "10");
        url.searchParams.set("gotonode", String(node.id || node._id || ""));
        return url.href;
    }

    function detailItem(label, value) {
        return '<div class="sirk-device-detail-item"><span>' + esc(label) + '</span><strong>' + esc(value == null || value === "" ? "—" : value) + '</strong></div>';
    }

    function fakeEvent() {
        return { shiftKey: false, preventDefault: function () {}, stopPropagation: function () {}, target: null, currentTarget: null };
    }

    function setBridgeStatus(value) {
        var element = document.getElementById("sirkNativeBridgeStatus");
        if (element) element.textContent = String(value || "");
    }

    function showBridgeOverlay(value, error) {
        var overlay = document.getElementById("sirkNativeBridgeOverlay");
        if (!overlay) return;
        overlay.hidden = false;
        overlay.innerHTML = '<div class="' + (error ? "sirk-native-bridge-error" : "") + '">' + esc(value) + '</div>';
    }

    function hideBridgeOverlay() {
        var overlay = document.getElementById("sirkNativeBridgeOverlay");
        if (overlay) overlay.hidden = true;
    }

    function activeNativeObject(win, type) {
        if (!win) return null;
        if (type === "desktop") return win.desktop;
        if (type === "terminal") return win.terminal;
        if (type === "files") return win.files;
        if (type === "registry") return win.registry || win.regedit || win.registryConnection;
        return null;
    }

    function stopBridge(removeFrame) {
        var current = bridge;
        bridge = null;
        bridgeSequence += 1;
        if (!current) return;
        if (current.timer) clearInterval(current.timer);
        if (current.timeout) clearTimeout(current.timeout);
        try {
            var object = activeNativeObject(current.win, current.type);
            if (object && typeof object.Stop === "function") object.Stop();
        } catch (error) {}
        if (removeFrame !== false && current.frame && current.frame.parentNode) current.frame.parentNode.removeChild(current.frame);
    }

    function nativeNode(win, nodeId) {
        var sets = [win && win.nodes, win && win.xxnodes];
        for (var s = 0; s < sets.length; s += 1) {
            var set = sets[s];
            if (!set || typeof set !== "object") continue;
            if (set[nodeId]) return set[nodeId];
            if (set[shortId(nodeId)]) return set[shortId(nodeId)];
            var keys = Object.keys(set);
            for (var i = 0; i < keys.length; i += 1) {
                var node = set[keys[i]];
                var id = String(node && (node._id || node.id || keys[i]) || "");
                if (sameNodeId(id, nodeId)) return node;
            }
        }
        return null;
    }

    function injectNativeNode(win, node) {
        win.currentNode = node;
        win.xxcurrentNode = node;
        win.currentNodeId = node._id || node.id;
        win.currentNodeid = node._id || node.id;
        win.desktopNode = node;
        win.terminalNode = node;
        win.filesNode = node;
        var meshId = node.meshid || node.meshId;
        if (win.meshes && meshId && win.meshes[meshId]) {
            win.currentMesh = win.meshes[meshId];
            win.xxcurrentMesh = win.meshes[meshId];
        }
    }

    function findPanel(doc, type) {
        var ids = PANEL_IDS[type] || [];
        for (var i = 0; i < ids.length; i += 1) {
            var panel = doc.getElementById(ids[i]);
            if (panel) return panel;
        }
        return null;
    }

    function nativeAnchor(panel, type) {
        if (!panel) return null;
        if (type === "desktop") return panel.querySelector("#Desk") || panel.querySelector("canvas");
        if (type === "terminal") return panel.querySelector("#termarea3xdiv") || panel.querySelector(".xterm");
        if (type === "files") return panel.querySelector("#p13toolbar") || panel.querySelector("#fileArea4") || panel.querySelector("#p13files");
        return null;
    }

    function hideChromeBefore(panel, anchor) {
        if (!panel || !anchor || !panel.contains(anchor)) return;
        var current = anchor;
        while (current && current !== panel) {
            var parent = current.parentElement;
            if (!parent) break;
            var child = parent.firstElementChild;
            while (child && child !== current) {
                if (!child.contains(anchor)) child.classList.add("mycompany-native-bridge-hidden");
                child = child.nextElementSibling;
            }
            current = parent;
        }
    }

    function installNativeStage(win, panel, type) {
        var doc = win.document;
        var style = doc.getElementById("myCompanyNativeBridgeStyle");
        if (!style) {
            style = doc.createElement("style");
            style.id = "myCompanyNativeBridgeStyle";
            style.textContent = [
                "html,body{width:100%!important;height:100%!important;margin:0!important;overflow:hidden!important;background:#111!important}",
                "#myCompanyNativeBridgeStage{position:fixed!important;inset:0!important;z-index:2147483640!important;display:block!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#111!important}",
                ".mycompany-native-bridge-panel{position:relative!important;inset:auto!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;display:block!important;width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;margin:0!important}",
                ".mycompany-native-bridge-information{overflow:auto!important;background:#fff!important;color:#111!important}",
                ".mycompany-native-bridge-hidden{display:none!important}",
                ".mycompany-native-bridge-panel #termarea3xdiv{top:0!important;bottom:30px!important}",
                ".mycompany-native-bridge-panel #p13toolbar{top:0!important}",
                ".mycompany-native-bridge-panel #fileArea4{height:calc(100% - 54px)!important}",
                ".mycompany-native-bridge-panel #Desk{max-width:100%!important;max-height:100%!important}"
            ].join("");
            (doc.head || doc.documentElement).appendChild(style);
        }
        var stage = doc.getElementById("myCompanyNativeBridgeStage");
        if (!stage) {
            stage = doc.createElement("div");
            stage.id = "myCompanyNativeBridgeStage";
            doc.body.appendChild(stage);
        }
        hideChromeBefore(panel, nativeAnchor(panel, type));
        stage.appendChild(panel);
        panel.classList.add("mycompany-native-bridge-panel");
        if (type === "registry" || type === "software" || type === "amt") panel.classList.add("mycompany-native-bridge-information");
        return panel;
    }

    function waitForNative(frame, nodeId, type, sequence) {
        return new Promise(function (resolve, reject) {
            var started = Date.now();
            function poll() {
                if (sequence !== bridgeSequence || !frame.parentNode) { reject(new Error("Native bridge was cancelled.")); return; }
                try {
                    var win = frame.contentWindow;
                    var doc = win && win.document;
                    var node = nativeNode(win, nodeId);
                    if (win && doc && doc.body && typeof win.go === "function" && node) {
                        resolve({ win: win, doc: doc, node: node });
                        return;
                    }
                } catch (error) {
                    reject(new Error("Same-origin access to MeshCentral was blocked: " + (error.message || error)));
                    return;
                }
                if (Date.now() - started > 25000) { reject(new Error(t("sessionMissing"))); return; }
                setTimeout(poll, 200);
            }
            poll();
        });
    }

    function waitForPanel(win, type, sequence) {
        return new Promise(function (resolve, reject) {
            var started = Date.now();
            function poll() {
                if (sequence !== bridgeSequence) { reject(new Error("Native bridge was cancelled.")); return; }
                var panel = findPanel(win.document, type);
                if (panel) { resolve(panel); return; }
                if (Date.now() - started > 12000) { reject(new Error("Native panel " + type + " was not found.")); return; }
                setTimeout(poll, 120);
            }
            poll();
        });
    }

    function nativeDiagnostics(current) {
        var object = activeNativeObject(current.win, current.type);
        var state = object && (object.State != null ? object.State : object.state);
        var socket = object && object.socket;
        return [
            "type=" + current.type,
            "node=" + (current.node && (current.node._id || current.node.id) || "BRAK"),
            "view=" + VIEWMODES[current.type],
            "object=" + (object ? "OK" : "BRAK"),
            "state=" + (state != null ? state : "n/a"),
            "socket=" + (socket ? socket.readyState : "BRAK")
        ].join(" | ");
    }

    function prepareNative(frame, node, type, sequence) {
        setBridgeStatus(t("preparing"));
        showBridgeOverlay(t("preparing"), false);
        return waitForNative(frame, node.id || node._id, type, sequence).then(function (native) {
            if (sequence !== bridgeSequence) throw new Error("Native bridge was cancelled.");
            injectNativeNode(native.win, native.node);
            native.win.go(VIEWMODES[type]);
            return waitForPanel(native.win, type, sequence).then(function (panel) {
                installNativeStage(native.win, panel, type);
                if (!bridge || sequence !== bridgeSequence) throw new Error("Native bridge was cancelled.");
                bridge.win = native.win;
                bridge.node = native.node;
                bridge.panel = panel;
                hideBridgeOverlay();
                return bridge;
            });
        });
    }

    function connectNative(method) {
        var current = bridge;
        if (!current || !current.frame) return;
        var sequence = current.sequence;
        var connectButton = document.getElementById("sirkNativeConnect");
        var disconnectButton = document.getElementById("sirkNativeDisconnect");
        if (connectButton) connectButton.disabled = true;
        setBridgeStatus(t("connecting"));
        prepareNative(current.frame, current.portalNode, current.type, sequence).then(function (prepared) {
            var win = prepared.win;
            if (prepared.type === "desktop") {
                if (typeof win.connectDesktop !== "function") throw new Error("connectDesktop is unavailable.");
                win.connectDesktop(fakeEvent(), Number(method || 3));
            } else if (prepared.type === "terminal") {
                if (typeof win.setupTerminal === "function") win.setupTerminal();
                if (typeof win.connectTerminal !== "function") throw new Error("connectTerminal is unavailable.");
                win.connectTerminal(fakeEvent(), 1);
            } else if (prepared.type === "files") {
                if (typeof win.setupFiles === "function") win.setupFiles();
                if (typeof win.connectFiles !== "function") throw new Error("connectFiles is unavailable.");
                win.connectFiles(fakeEvent());
            }
            if (disconnectButton) disconnectButton.disabled = false;
            prepared.timer = setInterval(function () {
                if (!bridge || bridge.sequence !== sequence) return;
                var object = activeNativeObject(win, prepared.type);
                var state = object && (object.State != null ? object.State : object.state);
                if (state === 3 || state === 4) {
                    setBridgeStatus(t("connected") + (prepared.type === "desktop" ? " " + t("clickCanvas") : ""));
                    if (prepared.type === "terminal" && win.xterm) { try { win.xterm.focus(); } catch (error) {} }
                } else setBridgeStatus(t("connecting") + (state != null ? " [" + state + "]" : ""));
            }, 250);
            prepared.timeout = setTimeout(function () {
                if (!bridge || bridge.sequence !== sequence) return;
                var object = activeNativeObject(win, prepared.type);
                var state = object && (object.State != null ? object.State : object.state);
                if (!object || (state !== 3 && state !== 4)) showBridgeOverlay(t("sessionError") + "\n" + nativeDiagnostics(prepared), true);
            }, 22000);
        }).catch(function (error) {
            if (connectButton) connectButton.disabled = false;
            if (disconnectButton) disconnectButton.disabled = true;
            showBridgeOverlay(t("sessionError") + "\n" + (error && (error.stack || error.message) || error), true);
            setBridgeStatus(t("sessionError"));
        });
    }

    function disconnectNative() {
        if (!bridge) return;
        try {
            var object = activeNativeObject(bridge.win, bridge.type);
            if (object && typeof object.Stop === "function") object.Stop();
        } catch (error) {}
        if (bridge.timer) { clearInterval(bridge.timer); bridge.timer = null; }
        if (bridge.timeout) { clearTimeout(bridge.timeout); bridge.timeout = null; }
        var connectButton = document.getElementById("sirkNativeConnect");
        var disconnectButton = document.getElementById("sirkNativeDisconnect");
        if (connectButton) connectButton.disabled = false;
        if (disconnectButton) disconnectButton.disabled = true;
        setBridgeStatus(t("disconnected"));
    }

    function renderNativeTab(host, node, type) {
        stopBridge(true);
        var interactive = type === "desktop" || type === "terminal" || type === "files";
        var selector = type === "desktop"
            ? '<label class="sirk-native-bridge-label" for="sirkNativeMethod">' + esc(t("method")) + '</label><select id="sirkNativeMethod" class="sirk-native-bridge-select"><option value="3">' + esc(t("meshAgent")) + '</option><option value="2">' + esc(t("amtKvm")) + '</option></select>'
            : '<span class="sirk-native-bridge-label">' + esc(t(type)) + '</span>';
        var controls = interactive
            ? '<button id="sirkNativeConnect" class="sirk-native-bridge-button" type="button">' + esc(t("connect")) + '</button><button id="sirkNativeDisconnect" class="sirk-native-bridge-button" type="button" disabled>' + esc(t("disconnect")) + '</button>'
            : "";
        host.innerHTML = '<div class="sirk-native-bridge-shell"><div class="sirk-native-bridge-toolbar">' + selector + controls + '<span id="sirkNativeBridgeStatus" class="sirk-native-bridge-status">' + esc(interactive ? t("ready") : t("loadingNative")) + '</span></div><div class="sirk-native-bridge-stage"><iframe id="sirkNativeBridgeFrame" class="sirk-native-bridge-frame" title="MeshCentral native module" allow="clipboard-read; clipboard-write; fullscreen"></iframe><div id="sirkNativeBridgeOverlay" class="sirk-native-bridge-overlay"><div>' + esc(t("loadingNative")) + '</div></div></div></div>';
        var frame = document.getElementById("sirkNativeBridgeFrame");
        var sequence = ++bridgeSequence;
        bridge = { sequence: sequence, frame: frame, portalNode: node, type: type, win: null, node: null, panel: null, timer: null, timeout: null };
        frame.addEventListener("load", function () {
            if (!bridge || bridge.sequence !== sequence) return;
            hideBridgeOverlay();
            setBridgeStatus(interactive ? t("ready") : t("preparing"));
            if (!interactive) {
                prepareNative(frame, node, type, sequence).then(function () {
                    setBridgeStatus(t("nativeReady"));
                }).catch(function (error) {
                    showBridgeOverlay(t("sessionError") + "\n" + (error && (error.stack || error.message) || error), true);
                    setBridgeStatus(t("sessionError"));
                });
            }
        });
        frame.src = nativeRootUrl();
        if (interactive) {
            document.getElementById("sirkNativeConnect").addEventListener("click", function () {
                var method = type === "desktop" ? document.getElementById("sirkNativeMethod").value : 1;
                connectNative(method);
            });
            document.getElementById("sirkNativeDisconnect").addEventListener("click", disconnectNative);
        }
    }

    function renderGeneral(host, node) {
        stopBridge(true);
        var online = nodeOnline(node);
        host.innerHTML = '<div class="sirk-device-general"><div class="sirk-device-detail-grid">' +
            detailItem(t("name"), node.name) + detailItem(t("status"), online ? t("online") : t("offline")) +
            detailItem(t("group"), nodeGroup(node)) + detailItem(t("system"), node.os || t("noOs")) +
            detailItem(t("ip"), node.ip || "—") + detailItem(t("lastSeen"), formatLastSeen(node.lastSeen)) +
            detailItem(t("agent"), node.agentVersion || "—") + detailItem(t("nodeId"), node.id || node._id) +
            '</div><div class="sirk-device-general-actions"><a href="' + esc(nativeDeviceUrl(node)) + '">' + esc(t("openMesh")) + '</a></div></div>';
    }

    function renderTab(node, type) {
        activeTab = VIEWMODES[type] ? type : "general";
        var body = document.getElementById("sirkDeviceTabBody");
        if (!body) return;
        Array.prototype.forEach.call(document.querySelectorAll("[data-device-tab]"), function (button) {
            var active = button.getAttribute("data-device-tab") === activeTab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });
        if (activeTab === "general") renderGeneral(body, node);
        else renderNativeTab(body, node, activeTab);
    }

    function renderWorkspace(node) {
        if (!content || !node) return;
        selectedNode = node;
        var online = nodeOnline(node);
        content.innerHTML = '<div class="sirk-device-workspace"><header class="sirk-device-compact-header"><button type="button" class="sirk-device-compact-back" data-device-back="1" title="' + esc(t("back")) + '">‹</button><span class="sirk-device-compact-icon" aria-hidden="true">▣</span><div class="sirk-device-compact-main"><strong>' + esc(node.name || shortId(node.id)) + '</strong><small>' + esc(nodeGroup(node)) + ' · ' + esc(node.os || t("noOs")) + '</small></div><div class="sirk-device-compact-meta"><span class="sirk-device-connection ' + (online ? "is-online" : "is-offline") + '"><i></i>' + esc(online ? t("online") : t("offline")) + '</span><small>' + esc(node.ip || "—") + '</small></div></header><nav class="sirk-device-tabs" role="tablist">' +
            ["general", "desktop", "terminal", "files", "registry", "software", "amt"].map(function (type) {
                return '<button type="button" role="tab" data-device-tab="' + type + '">' + esc(t(type)) + '</button>';
            }).join("") + '</nav><section id="sirkDeviceTabBody" class="sirk-device-tab-body"></section></div>';
        renderTab(node, activeTab);
    }

    function extractNodeId() {
        if (selectedNodeId) return selectedNodeId;
        var link = content && content.querySelector(".sirk-device-native-button[href]");
        if (link) {
            try { return new URL(link.href, window.location.href).searchParams.get("gotonode") || ""; }
            catch (error) {}
        }
        return "";
    }

    function transformDetail() {
        transformScheduled = false;
        if (!content || content.querySelector(".sirk-device-workspace")) return;
        if (!content.querySelector(".sirk-device-native-card")) return;
        var nodeId = extractNodeId();
        if (!nodeId) return;
        getInventory().then(function (value) {
            var node = findNode(value, nodeId);
            if (!node || !content.querySelector(".sirk-device-native-card")) return;
            selectedNodeId = String(node.id || node._id || nodeId);
            renderWorkspace(node);
        }).catch(function () {});
    }

    function scheduleTransform() {
        if (transformScheduled) return;
        transformScheduled = true;
        setTimeout(transformDetail, 0);
    }

    document.addEventListener("click", function (event) {
        var row = event.target && event.target.closest && event.target.closest("[data-device-id]");
        if (row) {
            selectedNodeId = row.getAttribute("data-device-id") || "";
            selectedNode = null;
            activeTab = "general";
            stopBridge(true);
            scheduleTransform();
            return;
        }
        var tab = event.target && event.target.closest && event.target.closest("[data-device-tab]");
        if (tab && content && content.contains(tab)) {
            event.preventDefault();
            event.stopPropagation();
            renderTab(selectedNode, tab.getAttribute("data-device-tab"));
            return;
        }
        var back = event.target && event.target.closest && event.target.closest("[data-device-back]");
        if (back) {
            selectedNodeId = "";
            selectedNode = null;
            activeTab = "general";
            stopBridge(true);
            return;
        }
        var navigation = event.target && event.target.closest && event.target.closest(".sirk-standalone-nav [data-view]");
        if (navigation) {
            selectedNodeId = "";
            selectedNode = null;
            activeTab = "general";
            stopBridge(true);
        }
    }, true);

    window.addEventListener("sirkportal:languagechange", function () {
        if (selectedNode && content && content.querySelector(".sirk-device-workspace")) renderWorkspace(selectedNode);
    });

    window.addEventListener("beforeunload", function () { stopBridge(true); });

    if (content) {
        new MutationObserver(scheduleTransform).observe(content, { childList: true, subtree: true });
        scheduleTransform();
    }
}());
