(function () {
    "use strict";
    var core = window.MyCompanyCore;
    function buttonRow(host, items, selected, onSelect) {
        host.innerHTML = "";
        (items || []).forEach(function (item) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "mc-shared-nav-item";
            button.classList.toggle("active", String(item.key) === String(selected));
            button.textContent = (item.icon ? item.icon + " " : "") + (item.title || item.name || item.key) + (item.badge == null ? "" : " (" + item.badge + ")");
            button.onclick = function () { onSelect(item); };
            host.appendChild(button);
        });
    }
    function renderError(host, error) {
        host.innerHTML = "";
        var card = core.card("Error", error && error.message || String(error));
        card.classList.add("mc-shared-error");
        host.appendChild(card);
    }
    function renderJson(host, value) {
        host.innerHTML = "";
        var pre = document.createElement("pre");
        pre.className = "mc-shared-output";
        pre.textContent = JSON.stringify(value, null, 2);
        host.appendChild(pre);
    }
    function registerMenu(definition, open) {
        core.ensureMenu({
            mainId: "MainMenuMyCompany-" + definition.key,
            leftId: "LeftMenuMyCompany-" + definition.key,
            title: definition.menuTitle || definition.title,
            order: definition.order || 200,
            open: open
        });
    }
    window.MyCompanyModuleShell = {
        create: function (definition) {
            var state = { page: null, tab: definition.defaultTab || "main", search: "" };
            function open() {
                return core.showWorkspace(definition.title, definition.viewMode || 960, function (host) {
                    state.page = window.SharedPage.mount({
                        container: host,
                        preset: definition.preset || definition.key,
                        buttons: definition.buttons || {},
                        customButtons: definition.customButtons || [],
                        tabs: definition.tabs || [{ key: "main", title: definition.title }],
                        activeTab: state.tab,
                        handlers: {
                            onCollapse: function () { state.page.layout.toggleCollapsed(); },
                            onRefresh: function () { if (definition.onRefresh) definition.onRefresh(api); else api.render(); },
                            onClear: function () { state.search = ""; state.page.toolbar.clearSearch(false); if (definition.onClear) definition.onClear(api); else api.render(); },
                            onSearch: function (value) { state.search = value || ""; if (definition.onSearch) definition.onSearch(state.search, api); else api.render(); },
                            onManage: function () { if (definition.onManage) definition.onManage(api); },
                            onSettings: function () { state.tab = "settings"; state.page.tabs.select("settings", true); },
                            onLink: function () { try { navigator.clipboard.writeText(window.location.href); } catch (error) {} },
                            onFavorites: function () { if (definition.onFavorites) definition.onFavorites(api); }
                        },
                        onTab: function (key) { state.tab = key; api.render(); }
                    });
                    api.render();
                });
            }
            var api = {
                definition: definition,
                state: state,
                open: open,
                render: function () {
                    if (!state.page) return;
                    state.page.layout.clear();
                    Promise.resolve(definition.render(api)).catch(function (error) { renderError(state.page.details, error); });
                },
                api: function (asset, parameters) { return core.api(definition.key, asset, null, parameters); },
                post: function (asset, values) { return core.post(definition.key, asset, values); },
                nav: function (host, items, selected, onSelect) { buttonRow(host, items, selected, onSelect); },
                json: renderJson,
                error: renderError,
                card: core.card,
                element: core.element
            };
            return {
                initialize: function () { if (definition.showInMenu !== false) registerMenu(definition, open); return Promise.resolve(); },
                open: open,
                render: api.render,
                api: api
            };
        }
    };
}());
