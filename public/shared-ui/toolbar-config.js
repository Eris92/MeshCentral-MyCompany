(function () {
    "use strict";

    var definitions = {
        collapse: { title: "Collapse", icon: "◀", side: "left", order: 10, handler: "onCollapse" },
        favorites: { title: "Favorites", icon: "★", side: "left", order: 20, handler: "onFavorites" },
        link: { title: "Copy link", icon: "🔗", side: "left", order: 30, handler: "onLink" },
        manage: { title: "Edit", icon: "✎", side: "left", order: 40, handler: "onManage" },
        refresh: { title: "Refresh", icon: "↻", side: "left", order: 50, handler: "onRefresh" },
        multi: { title: "Multi-device execution", icon: "⟳", side: "left", order: 60, handler: "onMulti" },
        search: { title: "Search", icon: "⌕", side: "left", order: 70, handler: "onSearchToggle", search: true },
        clear: { title: "Clear", icon: "⌫", side: "right", order: 110, handler: "onClear" },
        settings: { title: "Settings", icon: "⚙", side: "right", order: 140, handler: "onSettings" }
    };

    var presets = {
        approvalcenter: { collapse: true, link: false, refresh: true, clear: false, favorites: false, search: true, manage: false, multi: false, settings: false },
        myscripts: { collapse: false, favorites: true, link: true, manage: true, refresh: true, multi: false, search: true, clear: false, settings: false },
        mycommands: { collapse: true, favorites: true, link: true, manage: true, refresh: true, multi: true, search: true, clear: false, settings: false },
        standard: { collapse: false, link: true, manage: false, refresh: true, multi: false, search: true, clear: false, favorites: false, settings: true },
        minimal: { collapse: false, refresh: true, search: true }
    };

    function clone(value) {
        var result = {};
        Object.keys(value || {}).forEach(function (key) { result[key] = value[key]; });
        return result;
    }

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
