"use strict";

function wait(milliseconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });
}

function isRetryable(error) {
    return !!error && [
        "EACCES",
        "EBUSY",
        "EEXIST",
        "ENOTEMPTY",
        "EPERM"
    ].indexOf(String(error.code || "")) >= 0;
}

function retry(operation, attempts) {
    attempts = Math.max(1, Number(attempts) || 1);

    function run(index) {
        return Promise.resolve().then(operation).catch(function (error) {
            if (!isRetryable(error) || index >= attempts - 1) throw error;
            return wait(100 * (index + 1)).then(function () {
                return run(index + 1);
            });
        });
    }

    return run(0);
}

module.exports.write = function (fs, path, filePath, value) {
    var directory = path.dirname(filePath);
    var text = JSON.stringify(value, null, 2);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    return Promise.resolve().then(function () {
        if (!fs.existsSync(filePath)) return null;
        return fs.promises.chmod(filePath, 0o666).catch(function () {});
    }).then(function () {
        return retry(function () {
            return fs.promises.writeFile(filePath, text, {
                encoding: "utf8",
                flag: "w"
            });
        }, 12);
    });
};
