(function () {
    "use strict";
    var definitions = {
        collapse: { title: "Collapse", icon: "◀", side: "left", order: 10, handler: "onCollapse" },
        favorites: { title: "Favorites", icon: "★", side: "left", order: 20, handler: "onFavorites" },
        link: { title: "Copy link", icon: "🔗", side: "left", order: 30, handler: "onLink" },
        refresh: { title: "Refresh", icon: "↻", side: "right", order: 100, handler: "onRefresh" },
        clear: { title: "Clear", icon: "⌫", side: "right", order: 110, handler: "onClear" },
        search: { title: "Search", icon: "⌕", side: "right", order: 120, handler: "onSearchToggle", search: true },
        manage: { title: "Manage", icon: "✎", side: "right", order: 130, handler: "onManage" },
        settings: { title: "Settings", icon: "⚙", side: "right", order: 140, handler: "onSettings" }
    };
    var presets = {
        approvalcenter: { collapse: true, link: true, refresh: true, clear: true, favorites: false, search: true, manage: true, settings: true },
        myscripts: { collapse: true, favorites: true, link: true, refresh: true, clear: true, search: true, manage: true, settings: true },
        mycommands: { collapse: true, favorites: true, link: true, refresh: true, clear: true, search: true, manage: true, settings: true },
        standard: { collapse: true, link: true, refresh: true, clear: true, favorites: false, search: true, manage: false, settings: true },
        minimal: { collapse: true, refresh: true, search: true }
    };
    function clone(value) { var result = {}; Object.keys(value || {}).forEach(function (key) { result[key] = value[key]; }); return result; }
    window.SharedToolbarConfig = {
        definitions: definitions,
        presets: presets,
        resolve: function (preset, overrides) {
            var source = clone(presets[preset] || presets.standard);
            Object.keys(overrides || {}).forEach(function (key) { source[key] = overrides[key]; });
            return Object.keys(source).map(function (key) {
                var value = source[key];
                if (value === false || value == null) return null;
                var item = clone(definitions[key] || { title: key, icon: key, side: "right", order: 500 });
                item.key = key;
                if (typeof value === "object") Object.keys(value).forEach(function (name) { item[name] = value[name]; });
                return item;
            }).filter(Boolean).sort(function (a, b) {
                if (a.side !== b.side) return a.side === "left" ? -1 : 1;
                return Number(a.order) - Number(b.order);
            });
        }
    };
}());
