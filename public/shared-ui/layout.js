(function () {
    "use strict";
    function div(name) { var value = document.createElement("div"); value.className = name; return value; }
    window.SharedLayout = {
        mount: function (options) {
            var host = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
            var root = div("mc-shared-layout"); var primary = div("mc-shared-primary"); var secondary = div("mc-shared-secondary"); var details = div("mc-shared-details");
            root.appendChild(primary); root.appendChild(secondary); root.appendChild(details); host.appendChild(root);
            return { root: root, primary: primary, secondary: secondary, details: details, toggleCollapsed: function () { root.classList.toggle("is-collapsed"); }, clear: function () { primary.innerHTML = ""; secondary.innerHTML = ""; details.innerHTML = ""; } };
        }
    };
}());
