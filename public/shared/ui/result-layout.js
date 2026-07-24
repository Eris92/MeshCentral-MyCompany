(function () {
    "use strict";

    if (window.__sirkPlatformResultLayoutInstalled) return;
    window.__sirkPlatformResultLayoutInstalled = true;

    function moveCopyBelowResult(host) {
        host.querySelectorAll(".mc-results-inline-actions").forEach(function (actions) {
            var content = actions.nextElementSibling;
            if (!content || !content.classList.contains("mc-results-inline-content")) return;
            var debug = content.querySelector(":scope > .mc-results-debug");
            if (!debug) return;
            actions.classList.add("mc-results-copy-after-output");
            actions.style.marginTop = "12px";
            actions.style.marginBottom = "0";
            content.insertBefore(actions, debug);
        });
    }

    function removeExecutedCommandForm(host) {
        host.querySelectorAll(".mc-command-inline-result").forEach(function (result) {
            if (result.getAttribute("data-result-only") === "1") return;
            var card = result.parentElement;
            if (!card || !card.classList.contains("mc-shared-card")) return;
            var text = String(result.textContent || "").trim();
            if (!text || /^Select Run or Request/i.test(text)) return;

            var detailsHost = card.parentElement;
            if (!detailsHost) return;
            result.setAttribute("data-result-only", "1");
            detailsHost.innerHTML = "";
            detailsHost.appendChild(result);
        });
    }

    function normalize(host) {
        host = host || document;
        moveCopyBelowResult(host);
        removeExecutedCommandForm(host);
    }

    var scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () {
            scheduled = false;
            normalize(document);
        });
    }

    new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    normalize(document);
}());
