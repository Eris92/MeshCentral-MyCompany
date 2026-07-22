"use strict";

module.exports.resolve = function (context) {
    var fs = context.fs;
    var path = context.nativePath || context.path;
    var pluginParent = path.dirname(context.pluginRoot);
    var candidates = [
        path.join(pluginParent, "MyScripts", "scripts"),
        path.join(pluginParent, "MeshCentral-MyScripts", "scripts"),
        path.join(context.dataRoot, "myscripts", "scripts"),
        path.join(context.dataRoot, "scripts", "MyScripts"),
        path.join(pluginParent, "MyScripts"),
        path.join(pluginParent, "MeshCentral-MyScripts"),
        path.join(context.pluginRoot, "seed", "MyScripts")
    ];

    for (var index = 0; index < candidates.length; index++) {
        try {
            if (fs.statSync(candidates[index]).isDirectory()) return candidates[index];
        } catch (error) {}
    }

    return path.join(context.pluginRoot, "seed", "MyScripts");
};
