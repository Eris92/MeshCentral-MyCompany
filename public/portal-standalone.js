(function () {
    "use strict";

    var STORAGE_LANGUAGE = "sirkPortal.language";
    var core = window.MyCompanyCore;
    var root = document.getElementById("sirkStandaloneRoot");
    var portalRoot = document.getElementById("sirkPortalRoot");
    var content = document.getElementById("sirkStandaloneContent");
    var title = document.getElementById("sirkStandaloneTitle");
    var bootstrap = null;
    var initialized = Object.create(null);
    var renderSequence = 0;
    var activeView = "overview";
    var deviceInventory = null;
    var selectedDeviceId = "";
    var deviceSearch = "";
    var deviceFilter = "all";

    var TEXT = {
        pl: {
            overview: "Przegląd", devices: "Urządzenia", approvals: "Akceptacje",
            automation: "Automatyzacja", monitoring: "Monitoring", assets: "Zasoby",
            management: "Zarządzanie", reports: "Raporty", security: "Security",
            settings: "Ustawienia", meshCentral: "MeshCentral",
            collapse: "Zwiń menu", expand: "Rozwiń menu", theme: "Zmień motyw",
            languageTitle: "Switch to English", loading: "Ładowanie…",
            loadingModules: "Ładowanie modułów MyCompany…", loadingDevices: "Ładowanie urządzeń…",
            unknownError: "Nieznany błąd Portalu.", moduleDisabled: "moduł jest wyłączony albo użytkownik nie ma dostępu.",
            loadFailed: "nie udało się załadować danych.",
            overviewDevicesTitle: "Urządzenia", overviewDevicesSuffix: "urządzeń dostępnych w MeshCentral.",
            overviewDevicesLoading: "Pobieranie listy urządzeń…",
            overviewApprovalsTitle: "Akceptacje",
            overviewApprovalsDescription: "Move Requests, Commands i Scripts wymagające zatwierdzenia.",
            overviewIntegrationsTitle: "Integracje",
            overviewIntegrationsDescription: "Jira, Zabbix, Defender XDR, Entra i automatyzacja.",
            total: "Wszystkie", online: "Online", offline: "Offline",
            searchDevices: "Szukaj hosta, grupy lub systemu…", refresh: "Odśwież",
            waitingDevices: "Oczekiwanie na dane urządzeń…", noDevices: "Brak urządzeń dostępnych dla tego konta.",
            noFilteredDevices: "Brak urządzeń zgodnych z aktualnym filtrem.",
            devicesCount: "urządzeń", open: "Otwórz", unknownHost: "Nieznany host", noGroup: "Bez grupy",
            noOs: "Brak danych o systemie", noIp: "Brak IP", deviceDetails: "Szczegóły urządzenia",
            backToDevices: "Wróć do urządzeń", openMesh: "Otwórz w MeshCentral",
            name: "Nazwa", status: "Status", group: "Grupa", system: "System",
            ipAddress: "Adres IP", lastSeen: "Ostatnio widziany", agentVersion: "Wersja agenta", nodeId: "Node ID",
            settingsAdminOnly: "Ustawienia są dostępne tylko dla Site Admin.",
            monitoringPlaceholder: "Moduł Zabbix/Monitoring zostanie podłączony do wspólnego API MyCompany.",
            reportsPlaceholder: "Raporty będą korzystać ze wspólnego rejestru wyników MyCompany.",
            genericPlaceholder: "Moduł będzie podłączony do niezależnego API MyCompany.",
            managementLoading: "Ładowanie Zarządzania…", approvalsLoading: "Ładowanie Akceptacji…"
        },
        en: {
            overview: "Overview", devices: "Devices", approvals: "Approval",
            automation: "Automation", monitoring: "Monitoring", assets: "Assets",
            management: "Management", reports: "Reports", security: "Security",
            settings: "Settings", meshCentral: "MeshCentral",
            collapse: "Collapse menu", expand: "Expand menu", theme: "Change theme",
            languageTitle: "Przełącz na polski", loading: "Loading…",
            loadingModules: "Loading MyCompany modules…", loadingDevices: "Loading devices…",
            unknownError: "Unknown Portal error.", moduleDisabled: "module is disabled or the user does not have access.",
            loadFailed: "failed to load data.",
            overviewDevicesTitle: "Devices", overviewDevicesSuffix: "devices available in MeshCentral.",
            overviewDevicesLoading: "Loading the device list…",
            overviewApprovalsTitle: "Approval",
            overviewApprovalsDescription: "Move Requests, Commands and Scripts awaiting approval.",
            overviewIntegrationsTitle: "Integrations",
            overviewIntegrationsDescription: "Jira, Zabbix, Defender XDR, Entra and automation.",
            total: "All", online: "Online", offline: "Offline",
            searchDevices: "Search host, group or operating system…", refresh: "Refresh",
            waitingDevices: "Waiting for device data…", noDevices: "No devices are available for this account.",
            noFilteredDevices: "No devices match the current filter.",
            devicesCount: "devices", open: "Open", unknownHost: "Unknown host", noGroup: "No group",
            noOs: "No operating system data", noIp: "No IP", deviceDetails: "Device details",
            backToDevices: "Back to devices", openMesh: "Open in MeshCentral",
            name: "Name", status: "Status", group: "Group", system: "Operating system",
            ipAddress: "IP address", lastSeen: "Last seen", agentVersion: "Agent version", nodeId: "Node ID",
            settingsAdminOnly: "Settings are available only to Site Admin.",
            monitoringPlaceholder: "The Zabbix/Monitoring module will use the shared MyCompany API.",
            reportsPlaceholder: "Reports will use the shared MyCompany results registry.",
            genericPlaceholder: "This module will use the independent MyCompany API.",
            managementLoading: "Loading Management…", approvalsLoading: "Loading Approval…"
        }
    };

    var moduleViews = { automation: "mycommands", assets: "myjira", security: "defendertools" };

    function language() {
        try { return window.localStorage.getItem(STORAGE_LANGUAGE) === "en" ? "en" : "pl"; }
        catch (error) { return document.documentElement.lang === "en" ? "en" : "pl"; }
    }

    function t(key) { return TEXT[language()][key] || key; }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function viewName(view) { return t(view); }

    function applyShellLanguage() {
        document.documentElement.lang = language();
        Array.prototype.forEach.call(root.querySelectorAll(".sirk-standalone-nav [data-view]"), function (button) {
            var key = button.getAttribute("data-view");
            var label = button.querySelector("b");
            if (label) label.textContent = viewName(key);
            button.title = viewName(key);
        });
        var nativeLabel = root.querySelector(".sirk-standalone-native b");
        if (nativeLabel) nativeLabel.textContent = t("meshCentral");
        var languageButton = root.querySelector('[data-action="language"]');
        if (languageButton) {
            languageButton.textContent = language() === "pl" ? "PL" : "EN";
            languageButton.title = t("languageTitle");
            languageButton.setAttribute("aria-label", languageButton.title);
        }
        var sidebarButton = root.querySelector('[data-action="sidebar"]');
        if (sidebarButton) {
            sidebarButton.title = root.classList.contains("is-collapsed") ? t("expand") : t("collapse");
            sidebarButton.setAttribute("aria-label", sidebarButton.title);
        }
        var themeButton = root.querySelector('[data-action="theme"]');
        if (themeButton) {
            themeButton.title = t("theme");
            themeButton.setAttribute("aria-label", themeButton.title);
        }
        title.textContent = viewName(activeView);
    }

    function setLanguage(value) {
        var next = value === "en" ? "en" : "pl";
        try { window.localStorage.setItem(STORAGE_LANGUAGE, next); } catch (error) {}
        document.documentElement.lang = next;
        applyShellLanguage();
        window.dispatchEvent(new CustomEvent("sirkportal:languagechange", { detail: { language: next } }));
        render(activeView);
    }

    function asset(name) {
        var base = String(window.__MYCOMPANY_ASSET_BASE__ || "").replace(/\/$/, "");
        return base + "/" + name + "?v=" + encodeURIComponent(window.__MYCOMPANY_PORTAL_VERSION__ || "1");
    }

    function load(id, name) { return core.loadScript(id, asset(name)); }
    function moduleState(key) { return bootstrap && bootstrap.modules && bootstrap.modules[key] || null; }
    function accessAllowed(state) {
        if (!state || state.enabled !== true || state.ready === false) return false;
        if (!state.access) return true;
        return state.access.allowed !== false || state.access.siteAdmin === true;
    }
    function moduleAllowed(key) { return accessAllowed(moduleState(key)); }
    function isCurrent(sequence) { return sequence === renderSequence; }

    function loading(message) {
        content.innerHTML = '<div class="sirk-standalone-loading"><span></span><p>' + escapeHtml(message || t("loading")) + '</p></div>';
    }

    function showError(message, detail) {
        content.innerHTML = "";
        var box = document.createElement("div");
        box.className = "sirk-standalone-error";
        var strong = document.createElement("strong");
        strong.textContent = String(message || t("unknownError"));
        box.appendChild(strong);
        if (detail) {
            var pre = document.createElement("pre");
            pre.textContent = String(detail);
            box.appendChild(pre);
        }
        content.appendChild(box);
    }

    function loadDevices(force) {
        if (deviceInventory && force !== true) return Promise.resolve(deviceInventory);
        return core.api("portal", "devices").then(function (value) {
            deviceInventory = {
                nodes: Array.isArray(value.nodes) ? value.nodes : [],
                meshes: Array.isArray(value.meshes) ? value.meshes : []
            };
            return deviceInventory;
        });
    }

    function meshMap(inventory) {
        var result = Object.create(null);
        (inventory.meshes || []).forEach(function (mesh) { result[String(mesh.id || "")] = mesh; });
        return result;
    }

    function nodeOnline(node) { return Number(node && node.conn || 0) > 0; }
    function nodeGroup(node, map) {
        var mesh = map[String(node && node.meshId || "")];
        return String(mesh && mesh.name || t("noGroup"));
    }

    function formatLastSeen(value) {
        if (value == null || value === "") return "—";
        var number = Number(value);
        var date = Number.isFinite(number) ? new Date(number < 100000000000 ? number * 1000 : number) : new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(language() === "pl" ? "pl-PL" : "en-US");
    }

    function overview(sequence) {
        content.innerHTML = '<div class="sirk-standalone-view-scroll"><div class="sirk-standalone-grid">' +
            '<button type="button" class="sirk-standalone-card sirk-overview-link" data-open-view="devices"><h2>' + escapeHtml(t("overviewDevicesTitle")) + '</h2><p><strong id="sirkOverviewDeviceCount">…</strong> <span id="sirkOverviewDeviceSuffix">' + escapeHtml(t("overviewDevicesLoading")) + '</span></p></button>' +
            '<button type="button" class="sirk-standalone-card sirk-overview-link" data-open-view="approvals"><h2>' + escapeHtml(t("overviewApprovalsTitle")) + '</h2><p>' + escapeHtml(t("overviewApprovalsDescription")) + '</p></button>' +
            '<section class="sirk-standalone-card"><h2>' + escapeHtml(t("overviewIntegrationsTitle")) + '</h2><p>' + escapeHtml(t("overviewIntegrationsDescription")) + '</p></section>' +
            '</div></div>';

        loadDevices(false).then(function (inventory) {
            if (!isCurrent(sequence) || activeView !== "overview") return;
            var count = document.getElementById("sirkOverviewDeviceCount");
            var suffix = document.getElementById("sirkOverviewDeviceSuffix");
            if (count) count.textContent = String(inventory.nodes.length);
            if (suffix) suffix.textContent = t("overviewDevicesSuffix");
        }).catch(function () {
            if (!isCurrent(sequence) || activeView !== "overview") return;
            var count = document.getElementById("sirkOverviewDeviceCount");
            var suffix = document.getElementById("sirkOverviewDeviceSuffix");
            if (count) count.textContent = "0";
            if (suffix) suffix.textContent = t("overviewDevicesSuffix");
        });
    }

    function initializeModule(key) {
        if (initialized[key]) return initialized[key];
        var module = window.MyCompanyModules && window.MyCompanyModules[key];
        if (!module) return Promise.reject(new Error("Module " + key + " was not loaded."));
        initialized[key] = Promise.resolve(typeof module.initialize === "function" ? module.initialize(moduleState(key) || {}) : null);
        return initialized[key];
    }

    function mountModule(view, key, sequence) {
        var state = moduleState(key);
        if (!moduleAllowed(key)) {
            showError(viewName(view) + ": " + t("moduleDisabled"), JSON.stringify(state || {}, null, 2));
            return;
        }
        loading(t("loading") + " " + viewName(view));
        initializeModule(key).then(function () {
            if (!isCurrent(sequence)) return;
            var module = window.MyCompanyModules[key];
            if (!module || typeof module.mount !== "function") throw new Error("Module " + key + " does not expose a Portal view.");
            content.innerHTML = "";
            return Promise.resolve(module.mount(content, "sirk-standalone-" + view));
        }).catch(function (reason) {
            if (isCurrent(sequence)) showError(viewName(view) + ": " + t("loadFailed"), reason && (reason.stack || reason.message) || reason);
        });
    }

    function management(sequence) {
        var state = moduleState("myscripts");
        if (!moduleAllowed("myscripts")) {
            showError("MyScripts: " + t("moduleDisabled"), JSON.stringify(state || {}, null, 2));
            return;
        }
        loading(t("managementLoading"));
        if (!window.MyCompanyPortalManagement || typeof window.MyCompanyPortalManagement.mount !== "function") {
            showError("MyScripts renderer is unavailable.");
            return;
        }
        var host = document.createElement("div");
        host.className = "mycompany-management-host";
        content.innerHTML = "";
        content.appendChild(host);
        var timer = window.setTimeout(function () {
            if (isCurrent(sequence) && !host.querySelector(".sirk-management-shell,.mc-shared-error,.sirk-card")) {
                showError("MyScripts did not finish initialization.", "pluginadmin.ashx?pin=MyCompany&module=myscripts&asset=scripts");
            }
        }, 12000);
        Promise.resolve(window.MyCompanyPortalManagement.mount(host)).then(function () {
            window.clearTimeout(timer);
            if (!isCurrent(sequence)) return;
            if (!host.querySelector(".sirk-management-shell,.mc-shared-error,.sirk-card")) throw new Error("MyScripts renderer did not create a view.");
        }).catch(function (reason) {
            window.clearTimeout(timer);
            if (isCurrent(sequence)) showError(viewName("management") + ": " + t("loadFailed"), reason && (reason.stack || reason.message) || reason);
        });
    }

    function approvals(sequence) {
        if (!moduleAllowed("approvalcenter")) {
            showError("Approval Center: " + t("moduleDisabled"), JSON.stringify(moduleState("approvalcenter") || {}, null, 2));
            return;
        }
        loading(t("approvalsLoading"));
        initializeModule("approvalcenter").then(function () {
            if (!isCurrent(sequence)) return;
            var module = window.MyCompanyModules.approvalcenter;
            if (!module || typeof module.mount !== "function") throw new Error("Approval Center does not expose a Portal view.");
            content.innerHTML = "";
            return Promise.resolve(module.mount(content, "sirk-standalone-approval"));
        }).catch(function (reason) {
            if (isCurrent(sequence)) showError(viewName("approvals") + ": " + t("loadFailed"), reason && (reason.stack || reason.message) || reason);
        });
    }

    function settings() {
        var portal = moduleState("portal") || {};
        var access = portal.access || bootstrap && bootstrap.access || {};
        if (access.siteAdmin !== true) { showError(t("settingsAdminOnly")); return; }
        content.innerHTML = "";
        var frame = document.createElement("iframe");
        frame.className = "sirk-standalone-settings-frame";
        frame.title = "MyCompany settings";
        var url = new URL(window.__MYCOMPANY_API_BASE__, window.location.href);
        url.searchParams.set("pin", "MyCompany");
        frame.src = url.href;
        content.appendChild(frame);
    }

    function nativeDeviceUrl(node) {
        var url = new URL(String(window.__MYCOMPANY_NATIVE_URL__ || "/meshcentral/"), window.location.href);
        url.searchParams.set("viewmode", "10");
        url.searchParams.set("gotonode", String(node.id || ""));
        return url.href;
    }

    function detailItem(label, value) {
        return '<div class="sirk-device-detail-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value == null || value === "" ? "—" : value) + '</strong></div>';
    }

    function renderDeviceDetails(node) {
        var map = meshMap(deviceInventory || { meshes: [] });
        var online = nodeOnline(node);
        content.innerHTML = '<div class="sirk-standalone-view-scroll">' +
            '<div class="sirk-device-detail-head"><button type="button" class="sirk-device-back" data-device-back="1">← ' + escapeHtml(t("backToDevices")) + '</button></div>' +
            '<section class="sirk-device-hero"><span class="sirk-device-hero-icon">▣</span><div><h2>' + escapeHtml(node.name || t("unknownHost")) + '</h2><p>' + escapeHtml(nodeGroup(node, map)) + ' · ' + escapeHtml(node.os || t("noOs")) + '</p></div><span class="sirk-device-connection ' + (online ? "is-online" : "is-offline") + '"><i></i>' + escapeHtml(online ? t("online") : t("offline")) + '</span></section>' +
            '<div class="sirk-device-detail-grid">' +
            detailItem(t("name"), node.name) + detailItem(t("status"), online ? t("online") : t("offline")) +
            detailItem(t("group"), nodeGroup(node, map)) + detailItem(t("system"), node.os || t("noOs")) +
            detailItem(t("ipAddress"), node.ip || t("noIp")) + detailItem(t("lastSeen"), formatLastSeen(node.lastSeen)) +
            detailItem(t("agentVersion"), node.agentVersion || "—") + detailItem(t("nodeId"), node.id) +
            '</div><section class="sirk-standalone-card sirk-device-native-card"><h2>' + escapeHtml(t("deviceDetails")) + '</h2><a class="sirk-device-native-button" href="' + escapeHtml(nativeDeviceUrl(node)) + '">' + escapeHtml(t("openMesh")) + '</a></section></div>';
    }

    function renderDeviceGroups(inventory) {
        var host = document.getElementById("sirkDevicesHost");
        var total = document.getElementById("sirkDeviceTotal");
        var onlineElement = document.getElementById("sirkDeviceOnline");
        var offlineElement = document.getElementById("sirkDeviceOffline");
        if (!host) return;
        var map = meshMap(inventory);
        var allNodes = inventory.nodes || [];
        var onlineCount = allNodes.filter(nodeOnline).length;
        if (total) total.textContent = String(allNodes.length);
        if (onlineElement) onlineElement.textContent = String(onlineCount);
        if (offlineElement) offlineElement.textContent = String(allNodes.length - onlineCount);

        var search = deviceSearch.trim().toLowerCase();
        var nodes = allNodes.filter(function (node) {
            var online = nodeOnline(node);
            if (deviceFilter === "online" && !online) return false;
            if (deviceFilter === "offline" && online) return false;
            if (!search) return true;
            return [node.name, node.os, node.ip, nodeGroup(node, map)].join(" ").toLowerCase().indexOf(search) >= 0;
        });

        if (!allNodes.length) {
            host.innerHTML = '<div class="sirk-device-status">' + escapeHtml(t("noDevices")) + '</div>';
            return;
        }
        if (!nodes.length) {
            host.innerHTML = '<div class="sirk-device-status">' + escapeHtml(t("noFilteredDevices")) + '</div>';
            return;
        }

        var groups = Object.create(null);
        nodes.forEach(function (node) {
            var group = nodeGroup(node, map);
            if (!groups[group]) groups[group] = [];
            groups[group].push(node);
        });

        host.innerHTML = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, language()); }).map(function (group) {
            var rows = groups[group].sort(function (a, b) { return String(a.name).localeCompare(String(b.name), language()); });
            return '<section class="sirk-device-group"><header class="sirk-device-group-header"><div><strong>' + escapeHtml(group) + '</strong><small>' + rows.length + ' ' + escapeHtml(t("devicesCount")) + '</small></div><span>' + rows.filter(nodeOnline).length + ' ' + escapeHtml(t("online").toLowerCase()) + '</span></header><div class="sirk-device-list">' +
                rows.map(function (node) {
                    var online = nodeOnline(node);
                    return '<button type="button" class="sirk-device-row" data-device-id="' + escapeHtml(node.id) + '"><span class="sirk-device-icon">▣</span><span class="sirk-device-primary"><strong>' + escapeHtml(node.name || t("unknownHost")) + '</strong><small>' + escapeHtml(group) + '</small></span><span class="sirk-device-os">' + escapeHtml(node.os || t("noOs")) + '</span><span class="sirk-device-network">' + escapeHtml(node.ip || "—") + '</span><span class="sirk-device-seen">' + escapeHtml(formatLastSeen(node.lastSeen)) + '</span><span class="sirk-device-connection ' + (online ? "is-online" : "is-offline") + '"><i></i>' + escapeHtml(online ? t("online") : t("offline")) + '</span><span class="sirk-device-open">' + escapeHtml(t("open")) + '</span></button>';
                }).join("") + '</div></section>';
        }).join("");
    }

    function renderDevices(inventory) {
        content.innerHTML = '<div class="sirk-standalone-view-scroll"><div class="sirk-device-toolbar"><div class="sirk-device-summary"><span><strong id="sirkDeviceTotal">0</strong>' + escapeHtml(t("total")) + '</span><span><strong id="sirkDeviceOnline">0</strong>' + escapeHtml(t("online")) + '</span><span><strong id="sirkDeviceOffline">0</strong>' + escapeHtml(t("offline")) + '</span></div><div class="sirk-device-controls"><input id="sirkDeviceSearch" class="sirk-device-input" type="search" value="' + escapeHtml(deviceSearch) + '" placeholder="' + escapeHtml(t("searchDevices")) + '" autocomplete="off"><select id="sirkDeviceFilter" class="sirk-device-select"><option value="all">' + escapeHtml(t("total")) + '</option><option value="online">' + escapeHtml(t("online")) + '</option><option value="offline">' + escapeHtml(t("offline")) + '</option></select><button id="sirkRefreshDevices" type="button" class="sirk-device-refresh">' + escapeHtml(t("refresh")) + '</button></div></div><div id="sirkDevicesHost" class="sirk-device-groups"><div class="sirk-device-status">' + escapeHtml(t("waitingDevices")) + '</div></div></div>';
        var search = document.getElementById("sirkDeviceSearch");
        var filter = document.getElementById("sirkDeviceFilter");
        var refresh = document.getElementById("sirkRefreshDevices");
        if (filter) filter.value = deviceFilter;
        if (search) search.addEventListener("input", function () { deviceSearch = search.value || ""; renderDeviceGroups(inventory); });
        if (filter) filter.addEventListener("change", function () { deviceFilter = filter.value || "all"; renderDeviceGroups(inventory); });
        if (refresh) refresh.addEventListener("click", function () { devices(renderSequence, true); });
        renderDeviceGroups(inventory);
    }

    function devices(sequence, force) {
        if (selectedDeviceId && deviceInventory) {
            var selected = deviceInventory.nodes.find(function (node) { return String(node.id) === String(selectedDeviceId); });
            if (selected) { renderDeviceDetails(selected); return; }
            selectedDeviceId = "";
        }
        loading(t("loadingDevices"));
        loadDevices(force).then(function (inventory) {
            if (!isCurrent(sequence) || activeView !== "devices") return;
            renderDevices(inventory);
        }).catch(function (reason) {
            if (isCurrent(sequence)) showError(viewName("devices") + ": " + t("loadFailed"), reason && (reason.stack || reason.message) || reason);
        });
    }

    function placeholder(view, description) {
        content.innerHTML = '<div class="sirk-standalone-view-scroll"><div class="sirk-standalone-card sirk-standalone-placeholder"><h2>' + escapeHtml(viewName(view)) + '</h2><p>' + escapeHtml(description) + '</p></div></div>';
    }

    function render(view) {
        view = TEXT.pl[view] ? view : "overview";
        activeView = view;
        var sequence = ++renderSequence;
        applyShellLanguage();
        title.textContent = viewName(view);
        Array.prototype.forEach.call(document.querySelectorAll(".sirk-standalone-nav [data-view]"), function (button) {
            var active = button.getAttribute("data-view") === view;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        });
        if (view === "overview") overview(sequence);
        else if (view === "management") management(sequence);
        else if (view === "approvals") approvals(sequence);
        else if (view === "settings") settings();
        else if (view === "devices") devices(sequence, false);
        else if (moduleViews[view]) mountModule(view, moduleViews[view], sequence);
        else if (view === "monitoring") placeholder(view, t("monitoringPlaceholder"));
        else if (view === "reports") placeholder(view, t("reportsPlaceholder"));
        else placeholder(view, t("genericPlaceholder"));
        if (window.location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    }

    function setTheme(dark) {
        portalRoot.classList.toggle("sirk-theme-dark", dark);
        portalRoot.classList.toggle("sirk-theme-light", !dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
        try { localStorage.setItem("mycompany.sirkportal.theme", dark ? "dark" : "light"); } catch (ignored) {}
    }

    function bind() {
        root.addEventListener("click", function (event) {
            var openView = event.target.closest("[data-open-view]");
            if (openView && root.contains(openView)) {
                event.preventDefault();
                selectedDeviceId = "";
                render(openView.getAttribute("data-open-view"));
                return;
            }
            var deviceRow = event.target.closest("[data-device-id]");
            if (deviceRow && root.contains(deviceRow)) {
                event.preventDefault();
                selectedDeviceId = deviceRow.getAttribute("data-device-id") || "";
                devices(renderSequence, false);
                return;
            }
            var deviceBack = event.target.closest("[data-device-back]");
            if (deviceBack && root.contains(deviceBack)) {
                event.preventDefault();
                selectedDeviceId = "";
                devices(renderSequence, false);
                return;
            }
            var nav = event.target.closest("[data-view]");
            if (nav && root.contains(nav)) {
                event.preventDefault();
                selectedDeviceId = "";
                render(nav.getAttribute("data-view"));
                return;
            }
            var action = event.target.closest("[data-action]");
            if (!action) return;
            event.preventDefault();
            var name = action.getAttribute("data-action");
            if (name === "sidebar") {
                var value = !root.classList.contains("is-collapsed");
                root.classList.toggle("is-collapsed", value);
                try { localStorage.setItem("mycompany.sirkportal.standaloneCollapsed", value ? "1" : "0"); } catch (ignored) {}
                applyShellLanguage();
            } else if (name === "theme") {
                setTheme(!portalRoot.classList.contains("sirk-theme-dark"));
            } else if (name === "language") {
                setLanguage(language() === "pl" ? "en" : "pl");
            }
        });
        try {
            if (localStorage.getItem("mycompany.sirkportal.standaloneCollapsed") === "1") root.classList.add("is-collapsed");
            setTheme(localStorage.getItem("mycompany.sirkportal.theme") === "dark");
        } catch (ignored) { setTheme(false); }
        applyShellLanguage();
        window.addEventListener("hashchange", function () {
            selectedDeviceId = "";
            render(location.hash.slice(1));
        });
    }

    function loadDependencies() {
        var files = [
            ["sirk-shared-toolbar-config", "shared-ui/toolbar-config.js"], ["sirk-shared-toolbar-api", "shared-ui/toolbar-api.js"],
            ["sirk-shared-toolbar", "shared-ui/toolbar.js"], ["sirk-shared-tabs", "shared-ui/tabs.js"],
            ["sirk-shared-layout", "shared-ui/layout.js"], ["sirk-shared-settings", "shared-ui/settings.js"],
            ["sirk-shared-status-nav", "shared-ui/status-nav.js"], ["sirk-shared-page", "shared-ui/page.js"],
            ["sirk-shared-tree", "shared-ui/tree.js"], ["sirk-shared-results", "shared-ui/results.js"],
            ["sirk-shared-result-layout", "shared-ui/result-layout.js"], ["sirk-shared-script-tools", "shared-ui/script-tools.js"],
            ["sirk-shared-script-definition", "shared-ui/script-definition-form.js"], ["sirk-shared-confirm", "shared-ui/confirm-execution-form.js"],
            ["sirk-shared-edit-actions", "shared-ui/script-edit-actions.js"], ["sirk-shared-system-credentials", "shared-ui/system-credentials-form.js"],
            ["sirk-module-shell", "module-shell.js"], ["sirk-icon-data", "portal-icon-data.js"],
            ["sirk-approval-module", "approvalcenter.js"], ["sirk-move-module", "moverequests.js"],
            ["sirk-commands-module", "mycommands.js"], ["sirk-jira-module", "myjira.js"],
            ["sirk-defender-module", "defendertools.js"], ["sirk-management-renderer", "portal-management.js"],
            ["sirk-subfolder-icons", "portal-subfolder-icons.js"], ["sirk-folder-collapse", "portal-folder-collapse.js"]
        ];
        var chain = Promise.resolve();
        files.forEach(function (entry) { chain = chain.then(function () { return load(entry[0], entry[1]); }); });
        return chain;
    }

    function start() {
        bind();
        loading(t("loadingModules"));
        core.api("", "bootstrap").then(function (value) {
            bootstrap = value || {};
            window.MyCompanyRuntime = window.MyCompanyRuntime || { state: {} };
            window.MyCompanyRuntime.state = window.MyCompanyRuntime.state || {};
            window.MyCompanyRuntime.state.bootstrap = bootstrap;
            bootstrap.access = bootstrap.access || (bootstrap.modules && bootstrap.modules.portal && bootstrap.modules.portal.access) || {};
            return loadDependencies();
        }).then(function () {
            render(location.hash.slice(1) || "overview");
        }).catch(function (reason) {
            showError("SirK Portal: " + t("loadFailed"), reason && (reason.stack || reason.message) || reason);
        });
    }

    start();
}());
