(function () {
    "use strict";

    if (!window.SharedScriptTools || window.SharedScriptTools.__definitionFormInstalled) return;
    window.SharedScriptTools.__definitionFormInstalled = true;

    var originalCreate = window.SharedScriptTools.create;

    function text(value) {
        return String(value == null ? "" : value);
    }

    function element(tag, className, value) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }

    function field(labelText, control) {
        var row = element("label", "mc-definition-field");
        row.appendChild(element("span", "mc-definition-label", labelText));
        row.appendChild(control);
        return row;
    }

    function splitDirective(item) {
        item = item || {};
        function splitRaw(raw) {
            var pieces = text(raw).trim().split(",");
            var name = text(pieces.shift()).trim().replace(/^[\s$%]+/, "");
            return { name: name, value: pieces.join(",").trim() };
        }
        var fallback = splitRaw(item.value);
        var values = item.values && typeof item.values === "object" ? item.values : {};
        return {
            directive: text(item.directive || "Variable"),
            name: text(item.name || fallback.name),
            pl: text(values.pl || fallback.value),
            en: text(values.en || fallback.value)
        };
    }

    function directiveValue(row) {
        var name = text(row.name.value).trim().replace(/^[\s$%]+/, "");
        if (!name) return null;
        return {
            directive: row.type.value,
            name: name,
            values: {
                pl: text(row.pl.value).trim(),
                en: text(row.en.value).trim()
            }
        };
    }

    function createSelect(values, selected) {
        var select = element("select", "mc-definition-input mc-definition-type");
        values.forEach(function (value) {
            var option = element("option", "", value);
            option.value = value;
            option.selected = value === selected;
            select.appendChild(option);
        });
        return select;
    }

    function createDirectiveTable(title, rows, types, emptyType) {
        var section = element("section", "mc-definition-section");
        var header = element("div", "mc-definition-section-header");
        header.appendChild(element("h4", "", title));
        var headerActions = element("div", "mc-definition-section-actions");
        var add = element("button", "btn btn-secondary btn-sm", "Add variable");
        add.type = "button";
        headerActions.appendChild(add);
        header.appendChild(headerActions);
        section.appendChild(header);

        var wrapper = element("div", "mc-definition-table-wrap");
        var table = element("table", "style1 mc-definition-table");
        var head = table.createTHead().insertRow();
        ["Type", "Variable name", "PL — label | description | options", "EN — label | description | options", ""].forEach(function (name) {
            head.appendChild(element("th", "", name));
        });
        var body = table.createTBody();
        wrapper.appendChild(table);
        section.appendChild(wrapper);

        var controls = [];

        function addRow(value) {
            value = value || { directive: emptyType, name: "", pl: "", en: "" };
            var tr = body.insertRow();
            var type = createSelect(types, types.indexOf(value.directive) >= 0 ? value.directive : emptyType);
            var name = element("input", "mc-definition-input");
            name.type = "text";
            name.value = value.name || "";
            name.placeholder = "ApiToken";
            var pl = element("input", "mc-definition-input");
            pl.type = "text";
            pl.value = value.pl || "";
            pl.placeholder = "Polska nazwa | Polski opis";
            var en = element("input", "mc-definition-input");
            en.type = "text";
            en.value = value.en || "";
            en.placeholder = "English name | English description";
            var remove = element("button", "btn btn-secondary btn-sm mc-definition-remove", "×");
            remove.type = "button";
            tr.insertCell().appendChild(type);
            tr.insertCell().appendChild(name);
            tr.insertCell().appendChild(pl);
            tr.insertCell().appendChild(en);
            tr.insertCell().appendChild(remove);
            var record = { row: tr, type: type, name: name, pl: pl, en: en };
            controls.push(record);
            remove.onclick = function () {
                var index = controls.indexOf(record);
                if (index >= 0) controls.splice(index, 1);
                tr.remove();
            };
            return record;
        }

        (rows || []).map(splitDirective).forEach(addRow);
        add.onclick = function () { addRow(); };

        return {
            element: section,
            headerActions: headerActions,
            addRow: addRow,
            names: function () {
                return controls.map(function (row) {
                    return text(row.name.value).trim().replace(/^[\s$%]+/, "").toLowerCase();
                }).filter(Boolean);
            },
            values: function () {
                return controls.map(function (row) {
                    return directiveValue(row);
                }).filter(Boolean);
            }
        };
    }

    function detectExternalVariables(sourceText) {
        var source = text(sourceText);
        var assigned = Object.create(null);
        var referenced = Object.create(null);
        var excluded = {
            args: true, error: true, false: true, home: true, host: true, input: true,
            matches: true, myinvocation: true, null: true, pid: true, profile: true,
            psboundparameters: true, pscmdlet: true, pscommandpath: true, psitem: true,
            psscriptroot: true, pwd: true, shellid: true, this: true, true: true,
            _: true, env: true, foreach: true, switch: true, executioncontext: true,
            lastexitcode: true, nestedpromptlevel: true, ofS: true
        };

        source.split(/\r?\n/).forEach(function (line) {
            var code = line.replace(/#.*$/, "");
            var assignment = code.match(/^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]+\]\s*)?(?:=|\+=|-=|\*=|\/=)/);
            if (assignment) assigned[assignment[1].toLowerCase()] = true;
            var match;
            var pattern = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
            while ((match = pattern.exec(code))) {
                referenced[match[1].toLowerCase()] = match[1];
            }
        });

        return Object.keys(referenced).filter(function (key) {
            return !assigned[key] && !excluded[key];
        }).map(function (key) {
            return referenced[key];
        }).sort(function (a, b) {
            return a.localeCompare(b);
        });
    }

    function createSystemCredentialsSection(state) {
        state = state || { profiles: [] };
        var section = element("section", "mc-definition-section mc-definition-system-credentials");
        section.appendChild(element("h4", "", "Credentials / secrets - System"));
        section.appendChild(element(
            "div",
            "mc-shared-muted mc-system-credentials-description",
            "Use credentials configured globally in SirkPlatform. Secrets remain encrypted and are not copied into the script."
        ));
        var list = element("div", "mc-system-credentials-list");
        var boxes = [];
        var profiles = Array.isArray(state.profiles) ? state.profiles : [];

        profiles.forEach(function (profile) {
            var label = element("label", "mc-system-credential-item");
            var box = element("input");
            box.type = "checkbox";
            box.value = profile.name;
            box.checked = profile.selected === true;
            box.disabled = profile.configured !== true;
            label.appendChild(box);
            label.appendChild(element("span", "mc-system-credential-name", profile.label || profile.name));
            label.appendChild(element(
                "span",
                profile.configured ? "mc-system-credential-configured" : "mc-system-credential-unavailable",
                profile.configured ? "Configured" : "Not configured globally"
            ));
            list.appendChild(label);
            boxes.push(box);
        });

        if (!profiles.length) {
            list.appendChild(element("div", "mc-shared-muted", "No global integration profiles are available."));
        }
        section.appendChild(list);
        return {
            element: section,
            selected: function () {
                return boxes.filter(function (box) { return box.checked && !box.disabled; })
                    .map(function (box) { return box.value; });
            }
        };
    }

    function installDefinitionEditor(tool) {
        tool.openDefinitionEditor = function (shell, script, onSaved) {
            Promise.all([
                shell.api("definition", { path: script.path }),
                shell.api("script-secrets", { path: script.path }).catch(function () { return { secrets: { variables: [] } }; }),
                shell.api("system-credentials", { path: script.path }).catch(function () { return { systemCredentials: { profiles: [] } }; })
            ]).then(function (responses) {
                var value = responses[0].definition || {};
                var secretState = responses[1].secrets || { variables: [] };
                var systemState = responses[2].systemCredentials || { profiles: [] };
                var host = shell.state.page.details;
                host.innerHTML = "";

                var card = shell.card("Edit: " + (value.label || script.label || script.name), value.path || script.path);
                card.classList.add("mc-script-definition-card", "mc-script-definition-form");

                var locales = value.locales || {};
                var plLocale = locales.pl || {};
                var enLocale = locales.en || {};
                var namePl = element("input", "mc-definition-input");
                namePl.type = "text";
                namePl.value = plLocale.label || value.label || script.label || script.name || "";
                var descriptionPl = element("textarea", "mc-definition-input");
                descriptionPl.rows = 3;
                descriptionPl.value = plLocale.description || value.description || "";
                var nameEn = element("input", "mc-definition-input");
                nameEn.type = "text";
                nameEn.value = enLocale.label || value.label || script.label || script.name || "";
                var descriptionEn = element("textarea", "mc-definition-input");
                descriptionEn.rows = 3;
                descriptionEn.value = enLocale.description || value.description || "";

                var top = element("div", "mc-definition-top-grid");
                top.appendChild(field("Nazwa (PL)", namePl));
                top.appendChild(field("Opis (PL)", descriptionPl));
                top.appendChild(field("Name (EN)", nameEn));
                top.appendChild(field("Description (EN)", descriptionEn));
                card.appendChild(top);

                var approval = element("section", "mc-definition-section mc-definition-approval");
                approval.appendChild(element("h4", "", "Approval"));
                var approvalBoxes = element("div", "mc-script-approval-levels");
                [1, 2, 3].forEach(function (level) {
                    var item = element("label", "mc-definition-check");
                    var box = element("input");
                    box.type = "checkbox";
                    box.value = String(level);
                    box.checked = (value.approvalLevels || []).map(Number).indexOf(level) >= 0;
                    item.appendChild(box);
                    item.appendChild(document.createTextNode(" Level " + level));
                    approvalBoxes.appendChild(item);
                });
                approval.appendChild(approvalBoxes);
                card.appendChild(approval);

                var variables = createDirectiveTable(
                    "Variables",
                    value.variables || [],
                    ["Variable", "VariableRequired", "VariableSelect", "VariableSelectRequired", "VariableSwitch", "VariableSwitchRequired", "VariableUser", "VariableUserRequired", "VariableAsset", "VariableAssetRequired"],
                    "Variable"
                );
                card.appendChild(variables.element);

                var secrets = createDirectiveTable(
                    "Credentials / secrets",
                    value.secretVariables || [],
                    ["SaveSecret", "SaveSecretRequired"],
                    "SaveSecretRequired"
                );
                card.appendChild(secrets.element);

                var systemCredentials = createSystemCredentialsSection(systemState);
                card.appendChild(systemCredentials.element);

                var execution = element("section", "mc-definition-section");
                execution.appendChild(element("h4", "", "Execution"));
                var runAs = createSelect(["0", "1", "2"], String(value.runAsUser || 0));
                Array.prototype.forEach.call(runAs.options, function (option) {
                    option.textContent = option.value === "1" ? "Logged-on user" : option.value === "2" ? "SYSTEM" : "Default";
                });
                execution.appendChild(field("Run as", runAs));
                var multiLabel = element("label", "mc-definition-check");
                var multi = element("input");
                multi.type = "checkbox";
                multi.checked = value.multiHost === true;
                multiLabel.appendChild(multi);
                multiLabel.appendChild(document.createTextNode(" Allow multi-device execution"));
                execution.appendChild(multiLabel);
                card.appendChild(execution);

                var sourceDetails = element("details", "mc-definition-source");
                sourceDetails.open = true;
                sourceDetails.appendChild(element("summary", "", "Script code"));
                var source = element("textarea", "mc-script-editor mc-definition-source-editor");
                source.spellcheck = false;
                source.value = text(value.body);
                sourceDetails.appendChild(source);
                card.appendChild(sourceDetails);

                var detect = element("button", "btn btn-secondary btn-sm", "Detect variables from script");
                detect.type = "button";
                detect.onclick = function () {
                    var existing = variables.names();
                    var added = 0;
                    detectExternalVariables(source.value).forEach(function (variableName) {
                        if (existing.indexOf(variableName.toLowerCase()) >= 0) return;
                        variables.addRow({ directive: "VariableRequired", name: variableName, pl: variableName, en: variableName });
                        existing.push(variableName.toLowerCase());
                        added++;
                    });
                    detect.textContent = added ? ("Added " + added + " variable" + (added === 1 ? "" : "s")) : "No new variables detected";
                    window.setTimeout(function () { detect.textContent = "Detect variables from script"; }, 1600);
                };
                variables.headerActions.insertBefore(detect, variables.headerActions.firstChild);

                if ((secretState.variables || []).length) {
                    var hint = element("div", "mc-definition-secret-state");
                    hint.appendChild(element("strong", "", "Credential status: "));
                    hint.appendChild(document.createTextNode(secretState.variables.map(function (item) {
                        return item.name + " — " + (item.configured ? "configured" : item.required ? "required" : "not configured");
                    }).join(" | ")));
                    card.appendChild(hint);
                }

                var actions = element("div", "mc-script-manage-actions");
                var save = shell.element("button", "btn btn-primary btn-sm", "Save");
                var credentials = shell.element("button", "btn btn-secondary btn-sm", "Credentials");
                var cancel = shell.element("button", "btn btn-secondary btn-sm", "Cancel");
                save.type = credentials.type = cancel.type = "button";

                save.onclick = function () {
                    save.disabled = true;
                    Promise.all([
                        shell.post("definition", {
                            path: script.path,
                            definition: {
                                locales: {
                                    pl: { label: namePl.value, description: descriptionPl.value },
                                    en: { label: nameEn.value, description: descriptionEn.value }
                                },
                                approvalLevels: Array.prototype.map.call(approvalBoxes.querySelectorAll("input:checked"), function (box) { return Number(box.value); }),
                                variables: variables.values(),
                                secretVariables: secrets.values(),
                                runAsUser: Number(runAs.value) || 0,
                                multiHost: multi.checked,
                                body: source.value
                            }
                        }),
                        shell.post("system-credentials", {
                            path: script.path,
                            selected: systemCredentials.selected()
                        }).catch(function () { return null; })
                    ]).then(function (results) {
                        tool.state.editMode = false;
                        if (typeof onSaved === "function") onSaved(results[0]);
                    }).catch(function (error) {
                        save.disabled = false;
                        var note = element("div", "mc-shared-error", error.message || String(error));
                        card.appendChild(note);
                    });
                };

                credentials.onclick = function () {
                    tool.openCredentialsEditor(shell, script, function (result) {
                        if (typeof onSaved === "function") onSaved(result || null);
                    });
                };
                cancel.onclick = function () {
                    tool.state.editMode = false;
                    if (typeof onSaved === "function") onSaved(null);
                };

                actions.appendChild(save);
                actions.appendChild(credentials);
                actions.appendChild(cancel);
                card.appendChild(actions);
                host.appendChild(card);
                namePl.focus();
            }).catch(function (error) {
                shell.error(shell.state.page.details, error);
            });
        };
    }

    window.SharedScriptTools.create = function (options) {
        var tool = originalCreate.call(window.SharedScriptTools, options);
        installDefinitionEditor(tool);
        return tool;
    };
}());
