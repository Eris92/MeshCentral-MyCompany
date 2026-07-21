(function () {
    "use strict";
    var statuses = [
        { key: "", title: "All", icon: "▤" }, { key: "pending", title: "Pending", icon: "⌛" },
        { key: "executing", title: "Executing", icon: "▶" }, { key: "approved", title: "Approved", icon: "✓" },
        { key: "completed", title: "Completed", icon: "✓" }, { key: "failed", title: "Failed", icon: "!" },
        { key: "rejected", title: "Rejected", icon: "×" }
    ];
    window.SharedStatusNav = {
        list: function (counts) { return statuses.map(function (item) { return { key: item.key, title: item.title, icon: item.icon, badge: counts && counts[item.key] }; }); },
        mount: function (host, options) {
            host.innerHTML = ""; options = options || {};
            this.list(options.counts).forEach(function (item) {
                var button = document.createElement("button"); button.type = "button"; button.className = "mc-shared-nav-item"; button.textContent = item.icon + " " + item.title + (item.badge == null ? "" : " (" + item.badge + ")");
                button.classList.toggle("active", item.key === options.selected); button.onclick = function () { if (typeof options.onSelect === "function") options.onSelect(item.key); }; host.appendChild(button);
            });
        }
    };
}());
