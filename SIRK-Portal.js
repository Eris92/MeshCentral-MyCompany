"use strict";

var implementation = require("./plugin-main-standalone.js");

module.exports["SIRK-Portal"] = function (parent) {
    return implementation.createPlugin(parent, "SIRK-Portal");
};
