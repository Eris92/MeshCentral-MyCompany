(function () {
    "use strict";
    window.MyCompanyRuntime = window.MyCompanyRuntime || {};
    window.MyCompanyModules = window.MyCompanyModules || {};
    var runtime = window.MyCompanyRuntime;
    var core = window.MyCompanyCore;
    runtime.state = runtime.state || { bootstrap: null, initializePromise: null, nodeId: "" };
    var files = {
        approvalcenter: "approvalcenter.js",
        moverequests: "moverequests.js",
        mycommands: "mycommands.js",
        myjira: "myjira.js",
        defendertools: "defendertools.js",
        myscripts: "myscripts.js"
    };
    var order = ["approvalcenter", "moverequests", "mycommands", "myjira", "defendertools", "myscripts"];
    runtime.initialize = function () {
        if (runtime.state.initializePromise) return runtime.state.initializePromise;
        runtime.state.initializePromise = core.api("", "bootstrap").then(function (bootstrap) {
            runtime.state.bootstrap = bootstrap;
            var chain = Promise.resolve();
            order.forEach(function (key) {
                var state = bootstrap.modules[key];
                if (!state || !state.enabled || state.ready === false) return;
                chain = chain.then(function () {
                    return core.loadScript("mycompany-module-" + key, core.assetUrl("", files[key]));
                }).then(function () {
                    var module = window.MyCompanyModules[key];
                    if (module && typeof module.initialize === "function") return module.initialize(state);
                });
            });
            return chain;
        }).catch(function (error) {
            runtime.state.initializePromise = null;
            throw error;
        });
        return runtime.state.initializePromise;
    };
    runtime.onNativePageStart = function (view) {
        if (core.workspaceState && Number(view) !== Number(window.xxcurrentView)) core.restoreWorkspace();
    };
    runtime.onNativePageEnd = function () {};
    runtime.onDeviceRefreshEnd = function (nodeId) { runtime.state.nodeId = nodeId; };
    runtime.commandResult = function (message) {
        Object.keys(window.MyCompanyModules).forEach(function (key) {
            var module = window.MyCompanyModules[key];
            if (module && typeof module.commandResult === "function") module.commandResult(message);
        });
    };
}());
