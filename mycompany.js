"use strict";

var createMyCompany = require("./plugin.js").mycompany;

module.exports.mycompany = function (parent) {
    var obj = createMyCompany(parent);

    // Embedded modules are registered in parent.plugins only so backend modules
    // can discover each other. Their browser hooks are exported by MyCompany
    // under embedded*Startup names and must not be invoked a second time by the
    // MeshCentral plugin handler before MyCompanyAssetUrl exists.
    ["myscripts", "mycommands", "approvalcenter", "moverequest"].forEach(function (shortName) {
        if (parent && parent.exports) parent.exports[shortName] = [];
        if (parent && parent.plugins && parent.plugins[shortName]) parent.plugins[shortName].exports = [];
    });

    return obj;
};
