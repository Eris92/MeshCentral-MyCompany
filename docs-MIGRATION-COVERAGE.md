# Migration coverage — MyCompany 1.2.2

## UI standard

`MyScripts` is the authoritative UI implementation. All migrated modules use
`public/module-shell.js` and the classes from `public/myscripts.css`.

Shared elements:

- top tabs;
- icon toolbar;
- collapsible left navigation;
- middle list/tree;
- right details/output pane;
- search and favorites;
- Results and Settings pages;
- common tables, fields, dialogs and dark/light theme behavior.

## My Commands

Migrated from the former My Commands/CommandTabs implementation:

- 25 built-in command presets;
- CMD and PowerShell;
- variables, required variables and selects;
- nested `.ps1`, `.cmd` and `.bat` script tree;
- `runAsUser` contexts;
- direct execution and Approval Center workflow;
- multi-host execution with configurable limit and concurrency;
- progress marker `__COMMANDTABS_PROGRESS__`;
- structured result marker `__MYCOMMANDS_TABLE_B64__`;
- result history, search and paging;
- script metadata editor and definition hash validation;
- main menu and device button settings.

## Approval Center

- Overview and dynamic provider tabs;
- Move Requests, Commands and Scripts providers;
- approval levels 1–3;
- requester self-approval protection;
- atomically claimed execution;
- request search, status filters and paging;
- provider tab/overview visibility settings;
- provider-specific approver groups;
- hashed API tokens with scopes/provider restrictions;
- idempotency keys for external submissions;
- retention cleanup.

## Move Requests

- device-page Move Request button;
- source and target group validation;
- approval workflow;
- request history and details;
- optional main menu page;
- host-button and menu settings;
- rights revalidation before execution;
- MeshCentral node move event dispatch.

## My Jira

- New/My/All tickets;
- My/All tasks;
- issue details;
- comments, transitions and assignment;
- Jira Assets AQL search;
- Assets-to-Mesh hostname mapping;
- open-device and My Commands actions;
- centralized Jira credentials and settings.

## Defender XDR

- separated Incidents, Email Explorer, Tenant Allow/Block and Advanced Hunting access;
- group-based tab permissions;
- service-side incidents report execution;
- active/all incident modes and time filters;
- alerts, evidence and user correlation through the migrated PowerShell report;
- run status, debug log and embedded HTML report;
- centralized Graph credentials and configuration.

## Legacy import

First startup can import/copy data from disabled old plugin directories for:

- My Scripts;
- My Commands / CommandTabs;
- Approval Center;
- Move Requests;
- My Jira;
- DefenderTools.

The old plugins are never loaded or registered by MyCompany.
