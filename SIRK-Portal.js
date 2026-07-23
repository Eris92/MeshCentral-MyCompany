"use strict";

var implementation = require("./plugin-main-standalone.js");

function create(parent, shortName) {
    return implementation.createPlugin(parent, shortName || "SIRK-Portal");
}

module.exports.create = create;
module.exports["SIRK-Portal"] = function (parent) {
    return create(parent, "SIRK-Portal");
};
module.exports.SIRKPortal = function (parent) {
    return create(parent, "SIRK-Portal");
};
