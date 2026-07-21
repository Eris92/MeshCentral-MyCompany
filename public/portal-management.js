(function () {
    "use strict";

    if (window.__myCompanyPortalManagementLoaded) return;
    window.__myCompanyPortalManagementLoaded = true;

    var core = window.MyCompanyCore;
    var tools = window.SharedScriptTools.create({
        storageKey: "mycompany.myscripts.preferences",
        deepLinkParameter: "myscript"
    });
    var state = {
        tree: null,
        root: "",
        script: "",
        search: "",
        results: false,
        status: "",
        collapsed: false,
        editMode: false,
        host: null,
        output: Object.create(null)
    };

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function svg(path) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
    }

    var icons = {
        collapse: svg('<path d="m15 18-6-6 6-6"/>'),
        star: svg('<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'),
        link: svg('<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>'),
        edit: svg('<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
        refresh: svg('<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 5M4 13l2 5a7 7 0 0 0 11.9-2"/>'),
        search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
        folder: svg('<path d="M3 6h6l2 2h10v11H3V6Z"/>'),
        script: svg('<path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 11h6M9 15h6"/>'),
        result: svg('<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8"/>'),
        key: svg('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>')
    };

    function api(asset, parameters) {
        return core.api("myscripts", asset, null, parameters || {});
    }

    function post(asset, values) {
        return core.post("myscripts", asset, values || {});
    }

    function bootstrap() {
        return window.MyCompanyRuntime && window.MyCompanyRuntime.state && window.MyCompanyRuntime.state.bootstrap || {};
    }

    function isAdmin() {
        return !!(bootstrap().access && bootstrap().access.siteAdmin);
    }

    function roots() {
        if (window.SharedDirectoryTree && typeof window.SharedDirectoryTree.roots === "function") {
            return window.SharedDirectoryTree.roots(state.tree);
        }
        return state.tree && state.tree.children || [];
    }

    function find(path) {
        if (window.SharedDirectoryTree && typeof window.SharedDirectoryTree.find === "function") {
            return window.SharedDirectoryTree.find(state.tree, path);
        }
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (node.path === path) { found = node; return; }
            (node.children || []).forEach(walk);
        }
        walk(state.tree);
        return found;
    }

    function visibleScript(script) {
        if (!script || script.type !== "script") return false;
        if (tools.state.favoritesOnly && !tools.isFavorite(script.path)) return false;
        if (!state.search) return true;
        return [script.name, script.label, script.description, script.path].join(" ").toLowerCase().indexOf(state.search.toLowerCase()) >= 0;
    }

    function toolButton(action, title, icon) {
        var button = el("button", "sirk-management-tool");
        button.type = "button";
        button.title = title;
        button.setAttribute("data-portal-management-tool", action);
        button.innerHTML = icon;
        return button;
    }

    function buildShell(host) {
        host.innerHTML = "";
        host.classList.add("mycompany-management-host", "sirk-native-management");
        var shell = el("div", "sirk-management-shell");
        var toolbar = el("div", "sirk-management-toolbar");
        toolbar.appendChild(toolButton("collapse", "Collapse", icons.collapse));
        toolbar.appendChild(toolButton("favorites", "Favorites", icons.star));
        toolbar.appendChild(toolButton("link", "Copy link", icons.link));
        toolbar.appendChild(toolButton("edit", "Edit", icons.edit));
        toolbar.appendChild(toolButton("refresh", "Refresh", icons.refresh));
        toolbar.appendChild(toolButton("search", "Search", icons.search));
        var search = el("input", "sirk-management-search");
        search.id = "myCompanyPortalManagementSearch";
        search.type = "search";
        search.placeholder = "Szukaj skryptów...";
        search.value = state.search;
        toolbar.appendChild(search);
        toolbar.appendChild(el("span", "sirk-management-toolbar-status"));

        var workspace = el("div", "sirk-management-workspace");
        var categories = el("aside", "sirk-management-column");
        categories.appendChild(el("div", "sirk-management-list"));
        var scripts = el("aside", "sirk-management-column");
        scripts.appendChild(el("div", "sirk-management-list"));
        var details = el("div", "sirk-management-column");
        details.appendChild(el("div", "sirk-management-content"));
        workspace.appendChild(categories);
        workspace.appendChild(scripts);
        workspace.appendChild(details);
        shell.appendChild(toolbar);
        shell.appendChild(workspace);
        host.appendChild(shell);

        state.host = host;
        bind(shell);
        renderAll();
    }

    function categoryButton(item, active) {
        var button = el("button", "sirk-management-item" + (active ? " is-active" : ""));
        button.type = "button";
        button.setAttribute("data-management-root", item.path || "");
        button.innerHTML = '<span class="sirk-management-item-icon">' + (item.icon || icons.folder) + '</span><span></span>';
        button.lastChild.textContent = item.name || item.label || item.path;
        return button;
    }

    function renderCategories() {
        var host = state.host.querySelector(".sirk-management-workspace > .sirk-management-column:nth-child(1) .sirk-management-list");
        host.innerHTML = "";
        var results = categoryButton({ path: "@results", name: "Results", icon: icons.result }, state.results);
        host.appendChild(results);
        roots().forEach(function (root) {
            host.appendChild(categoryButton(root, !state.results && state.root === root.path));
        });
        state.host.classList.toggle("is-management-collapsed", state.collapsed);
    }

    function actionButton(action, title, icon, disabled, active) {
        var button = el("button", "sirk-script-action" + (active ? " is-active" : ""));
        button.type = "button";
        button.title = title;
        button.setAttribute("data-script-action", action);
        button.innerHTML = icon;
        button.disabled = disabled === true;
        return button;
    }

    function scriptRow(script, depth) {
        var row = el("div", "sirk-script-row" + (state.script === script.path ? " is-active" : ""));
        row.style.setProperty("--sirk-depth", String(depth || 0));
        var open = el("button", "sirk-management-item sirk-script-open");
        open.type = "button";
        open.setAttribute("data-script-path", script.path);
        open.innerHTML = '<span class="sirk-management-item-icon">' + icons.script + '</span><span class="sirk-script-label"></span>';
        open.querySelector(".sirk-script-label").textContent = script.label || script.name || script.path;
        row.appendChild(open);
        if (state.editMode) {
            var actions = el("span", "sirk-script-actions");
            var hasSecrets = Array.isArray(script.secretVariables) && script.secretVariables.length > 0;
            var credentials = actionButton("credentials", "Credentials", icons.key, !hasSecrets, hasSecrets);
            var favorite = actionButton("favorite", "Favorite", icons.star, false, tools.isFavorite(script.path));
            var link = actionButton("copy", "Copy link", icons.link);
            var edit = actionButton("edit", "Edit", icons.edit, !isAdmin());
            [credentials, favorite, link, edit].forEach(function (button) {
                button.setAttribute("data-script-path", script.path);
                actions.appendChild(button);
            });
            row.appendChild(actions);
        }
        return row;
    }

    function appendNode(host, node, depth) {
        if (!node) return;
        if (node.type === "script") {
            if (visibleScript(node)) host.appendChild(scriptRow(node, depth));
            return;
        }
        var matching = [];
        (node.children || []).forEach(function (child) {
            if (child.type !== "script" || visibleScript(child)) matching.push(child);
        });
        if (node.path !== state.root) {
            var heading = el("div", "sirk-folder-heading");
            heading.style.setProperty("--sirk-depth", String(depth || 0));
            heading.innerHTML = '<span class="sirk-management-item-icon">' + icons.folder + '</span><span></span>';
            heading.lastChild.textContent = node.name || node.label || node.path;
            host.appendChild(heading);
        }
        matching.forEach(function (child) { appendNode(host, child, (depth || 0) + 1); });
    }

    function renderScripts() {
        var host = state.host.querySelector(".sirk-management-workspace > .sirk-management-column:nth-child(2) .sirk-management-list");
        host.innerHTML = "";
        if (state.results) {
            ["", "pending", "approved", "executing", "completed", "failed", "rejected"].forEach(function (status) {
                var button = el("button", "sirk-management-item" + (state.status === status ? " is-active" : ""), status || "All");
                button.type = "button";
                button.setAttribute("data-result-status", status);
                host.appendChild(button);
            });
            return;
        }
        var root = find(state.root) || roots()[0];
        if (!root) {
            host.appendChild(el("div", "sirk-empty", "Brak skryptów."));
            return;
        }
        appendNode(host, root, 0);
    }

    function detailsHost() {
        return state.host.querySelector(".sirk-management-content");
    }

    function shellAdapter() {
        return {
            state: { page: { details: detailsHost() }, bootstrap: bootstrap() },
            api: api,
            post: post,
            card: function (title, description) {
                var card = el("div", "sirk-card mc-shared-card");
                card.appendChild(el("h3", "", title));
                if (description) card.appendChild(el("p", "sirk-muted", description));
                return card;
            },
            element: el,
            error: function (host, error) {
                host.innerHTML = "";
                var card = el("div", "sirk-card mc-shared-error");
                card.textContent = error && error.message || String(error);
                host.appendChild(card);
            }
        };
    }

    function showMessage(title, message, error) {
        var host = detailsHost();
        host.innerHTML = "";
        var card = el("div", "sirk-card" + (error ? " mc-shared-error" : ""));
        card.appendChild(el("h2", "", title));
        card.appendChild(el("p", "sirk-muted", message));
        host.appendChild(card);
    }

    function variableForm(script) {
        var form = el("div", "sirk-script-variable-form");
        var controls = [];
        (script.variables || []).forEach(function (variable) {
            var row = el("label", "sirk-form-row");
            row.appendChild(el("span", "sirk-form-label", (variable.label || variable.name) + (variable.required ? " *" : "")));
            var control;
            if (variable.control === "select") {
                control = el("select", "sirk-input");
                (variable.options || []).forEach(function (choice) {
                    var option = el("option", "", choice.label || choice.value || choice);
                    option.value = String(choice.value == null ? choice : choice.value);
                    control.appendChild(option);
                });
            } else {
                control = el("input", "sirk-input");
                control.type = variable.control === "switch" ? "checkbox" : "text";
            }
            if (control.type === "checkbox") control.checked = /^(1|true|yes|tak)$/i.test(String(variable.defaultValue || ""));
            else control.value = String(variable.defaultValue == null ? "" : variable.defaultValue);
            row.appendChild(control);
            form.appendChild(row);
            controls.push({ variable: variable, control: control });
        });
        return {
            element: form,
            values: function () {
                var values = {};
                controls.forEach(function (item) {
                    values[item.variable.name] = item.control.type === "checkbox" ? item.control.checked : item.control.value;
                });
                return values;
            },
            validate: function () {
                controls.forEach(function (item) {
                    var value = item.control.type === "checkbox" ? item.control.checked : item.control.value;
                    if (item.variable.required && !String(value == null ? "" : value).trim()) throw new Error((item.variable.label || item.variable.name) + " is required.");
                });
            }
        };
    }

    function requestOutput(request) {
        var result = request && request.result || {};
        return result.output || result.rawOutput || result.message || (request && request.status === "pending" ? "Waiting for approval." : "No output.");
    }

    function renderRequest(script, request) {
        var host = detailsHost();
        host.innerHTML = "";
        if (window.SharedResultsView && typeof window.SharedResultsView.mountResult === "function") {
            window.SharedResultsView.mountResult(host, requestOutput(request), { title: script.label || script.name || "Result" });
        } else {
            var pre = el("pre", "sirk-output", requestOutput(request));
            host.appendChild(pre);
        }
    }

    function execute(script, values) {
        if (script.confirmExecution === true && !window.confirm('Run "' + (script.label || script.name || script.path) + '" now?')) return;
        showMessage(script.label || script.name, "Executing script...");
        post("request", {
            scriptPath: script.path,
            variableValues: values || {},
            confirmedExecution: script.confirmExecution === true,
            note: ""
        }).then(function (response) {
            state.output[script.path] = response.request || {};
            renderRequest(script, response.request || {});
        }).catch(function (error) {
            showMessage("Execution failed", error.message || String(error), true);
        });
    }

    function openScript(path, executeOnSelect) {
        state.script = path;
        renderScripts();
        api("script", { path: path }).then(function (response) {
            var script = response.script;
            var previous = state.output[path];
            if (previous && executeOnSelect !== true) {
                renderRequest(script, previous);
                return;
            }
            var hasVariables = Array.isArray(script.variables) && script.variables.length > 0;
            if (executeOnSelect && !hasVariables) {
                execute(script, {});
                return;
            }
            var host = detailsHost();
            host.innerHTML = "";
            var card = el("div", "sirk-card sirk-script-run-card");
            card.appendChild(el("h2", "", script.label || script.name));
            if (script.description) card.appendChild(el("p", "sirk-muted", script.description));
            var variables = variableForm(script);
            if (hasVariables) card.appendChild(variables.element);
            var run = el("button", "sirk-primary-button", script.requiresApproval ? "Request" : "Run");
            run.type = "button";
            run.onclick = function () {
                try { variables.validate(); execute(script, variables.values()); }
                catch (error) { showMessage("Validation", error.message || String(error), true); }
            };
            card.appendChild(run);
            host.appendChild(card);
        }).catch(function (error) { showMessage("Script error", error.message || String(error), true); });
    }

    function renderResults() {
        var host = detailsHost();
        host.innerHTML = "";
        api("results", { status: state.status, q: state.search, page: 1, perPage: 200 }).then(function (response) {
            if (window.SharedResultsView) {
                window.SharedResultsView.mountTable(host, {
                    title: "Script results",
                    kind: "scripts",
                    rows: response.rows || [],
                    emptyText: "No script results match the selected status."
                });
            }
        }).catch(function (error) { showMessage("Results error", error.message || String(error), true); });
    }

    function renderDetails() {
        if (state.results) { renderResults(); return; }
        if (state.script) { openScript(state.script, false); return; }
        showMessage("Zarządzanie", "Wybierz skrypt do uruchomienia.");
    }

    function renderAll() {
        if (!state.host) return;
        renderCategories();
        renderScripts();
        renderDetails();
        var favorite = state.host.querySelector('[data-portal-management-tool="favorites"]');
        if (favorite) favorite.classList.toggle("is-active", tools.state.favoritesOnly);
        var edit = state.host.querySelector('[data-portal-management-tool="edit"]');
        if (edit) edit.classList.toggle("is-active", state.editMode);
    }

    function copySelected() {
        if (!state.script) return showMessage("Copy link", "Najpierw wybierz skrypt.", true);
        tools.copyText((function () {
            var url = new URL(window.location.href);
            url.searchParams.set("myscript", state.script);
            return url.href;
        }())).then(function () { showMessage("Copy link", "Link skopiowany."); });
    }

    function editScript(path) {
        var script = find(path);
        if (!script) return;
        tools.openDefinitionEditor(shellAdapter(), script, function (result) {
            if (result && result.tree) state.tree = result.tree;
            renderAll();
        });
    }

    function credentials(path) {
        var script = find(path);
        if (!script) return;
        tools.openCredentialsEditor(shellAdapter(), script, function () { renderAll(); });
    }

    function bind(shell) {
        shell.addEventListener("click", function (event) {
            var tool = event.target.closest("[data-portal-management-tool]");
            if (tool) {
                var action = tool.getAttribute("data-portal-management-tool");
                if (action === "collapse") state.collapsed = !state.collapsed;
                if (action === "favorites") tools.state.favoritesOnly = !tools.state.favoritesOnly;
                if (action === "link") copySelected();
                if (action === "edit" && isAdmin()) state.editMode = !state.editMode;
                if (action === "refresh") {
                    post("refresh", {}).then(function (response) { state.tree = response.tree || state.tree; renderAll(); });
                }
                if (action === "search") {
                    var search = state.host.querySelector(".sirk-management-search");
                    search.classList.toggle("is-visible");
                    if (search.classList.contains("is-visible")) search.focus();
                }
                renderAll();
                return;
            }
            var root = event.target.closest("[data-management-root]");
            if (root) {
                var path = root.getAttribute("data-management-root");
                state.results = path === "@results";
                state.root = state.results ? "" : path;
                state.script = "";
                renderAll();
                return;
            }
            var status = event.target.closest("[data-result-status]");
            if (status) { state.status = status.getAttribute("data-result-status") || ""; renderAll(); return; }
            var open = event.target.closest("[data-script-path].sirk-script-open");
            if (open) { openScript(open.getAttribute("data-script-path"), true); return; }
            var actionButton = event.target.closest("[data-script-action]");
            if (actionButton) {
                var actionName = actionButton.getAttribute("data-script-action");
                var scriptPath = actionButton.getAttribute("data-script-path");
                if (actionName === "favorite") { tools.toggleFavorite(scriptPath); renderAll(); }
                if (actionName === "copy") { state.script = scriptPath; copySelected(); }
                if (actionName === "edit") editScript(scriptPath);
                if (actionName === "credentials" && !actionButton.disabled) credentials(scriptPath);
            }
        });
        shell.addEventListener("input", function (event) {
            if (!event.target.classList.contains("sirk-management-search")) return;
            state.search = event.target.value || "";
            renderScripts();
            if (state.results) renderResults();
        });
    }

    function mount(host) {
        state.host = host;
        return api("scripts").then(function (response) {
            state.tree = response.tree;
            var available = roots();
            if (!state.root && available.length) state.root = available[0].path;
            buildShell(host);
        }).catch(function (error) {
            host.innerHTML = "";
            host.appendChild(el("div", "sirk-card mc-shared-error", error.message || String(error)));
        });
    }

    window.MyCompanyPortalManagement = {
        mount: mount,
        refresh: function () {
            if (!state.host) return;
            post("refresh", {}).then(function (response) {
                state.tree = response.tree || state.tree;
                renderAll();
            });
        }
    };
}());
