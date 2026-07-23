# SIRK Management Platform — struktura repozytorium

## Nazwy produktu

- repozytorium i techniczna nazwa pluginu: `SIRK-Portal`;
- nazwa wyświetlana: `SIRK Management Platform`;
- nazwa skrócona: `SIRK Platform`.

Repozytorium nie utrzymuje zgodności z testową strukturą `MyCompany`. Stare entrypointy, shimy, aliasy, migracje danych i niekanoniczne ścieżki są usunięte.

## Hierarchia indeksów

```text
AGENTS.md
  -> docs/INDEX.md
       -> server/INDEX.md
       -> public/INDEX.md
       -> web/INDEX.md
       -> scripts/INDEX.md
       -> test/INDEX.md
```

Odczyt repozytorium zaczyna się od indeksów. Po wybraniu warstwy należy czytać tylko wskazany entrypoint lub moduł oraz jego bezpośrednie zależności.

## Struktura

```text
SIRK-Portal/
├── AGENTS.md
├── SIRK-Portal.js
├── plugin-main.js
├── plugin-main-standalone.js
├── admin.js
├── config.json
├── package.json
├── server/
│   ├── INDEX.md
│   ├── core/
│   │   ├── runtime.js
│   │   ├── runtime-portal.js
│   │   ├── settings-store.js
│   │   ├── secret-store.js
│   │   ├── approval-service.js
│   │   ├── device-service.js
│   │   └── pozostałe usługi wspólne
│   └── modules/
│       ├── approval-center/
│       ├── automation/
│       ├── commands/
│       ├── jira/
│       ├── move-requests/
│       ├── portal/
│       └── security/
├── public/
│   ├── INDEX.md
│   ├── portal/
│   ├── native/
│   ├── shared/
│   └── modules/
├── web/
│   ├── INDEX.md
│   └── admin/
├── assets/icons/sirk-ui.svg
├── views/SIRK-Portal.handlebars
├── tools/install/
├── scripts/
│   └── INDEX.md
├── test/
│   └── INDEX.md
├── docs/
│   ├── INDEX.md
│   ├── PROJECT-STATE.md
│   ├── REPOSITORY-LAYOUT.md
│   ├── portal-integration.md
│   └── agent/
└── seed/
```

## Backend

Cały kod Node.js i integracje MeshCentral znajdują się w `server/`.

- `server/core/` zawiera runtime, storage, security, integracje i wspólne usługi;
- `server/modules/` zawiera moduły funkcjonalne;
- katalogi `core/` i `modules/` w root są zabronione;
- backend nie może znajdować się w `public/`.

Jedyny katalog danych:

```text
meshcentral-data/sirk-platform-data
```

Plugin nie odczytuje i nie migruje `mycompany-data`.

## Frontend

`public/` zawiera dokładnie cztery warstwy:

- `public/portal/` — samodzielny SIRK Portal;
- `public/native/` — integracja z natywnym GUI MeshCentral;
- `public/shared/` — wspólny runtime, komponenty i style;
- `public/modules/` — pojedyncze renderery modułów.

Pliki aplikacyjne nie mogą leżeć bezpośrednio w `public/`. `public/shared-ui/` jest zabroniony.

## Moduły

Backend i frontend jednego modułu są dwiema warstwami tego samego kontraktu:

```text
server/modules/approval-center/index.js
public/modules/approvals/index.js
```

Dla jednego modułu może istnieć tylko jeden renderer.

## Loadery

```text
SIRK-Portal.js
  -> plugin-main-standalone.js
    -> plugin-main.js
      -> server/core/runtime-portal.js
        -> server/core/runtime.js
          -> server/modules/*
```

- `admin.js` utrzymuje mapę assetów natywnego UI i panelu administracyjnego;
- `plugin-main-standalone.js` utrzymuje mapę assetów standalone Portalu;
- każda publiczna nazwa assetu wskazuje dokładnie jeden kanoniczny plik.

## Panel administracyjny

```text
admin.js
views/SIRK-Portal.handlebars
web/admin/
```

Nie istnieje alias danych `window.MyCompanyAdminData`. Kanoniczny obiekt to `window.SirkPlatformAdminData`.

## Instalacja i repozytorium

```text
https://github.com/Eris92/SIRK-Portal
Install-SIRK-Portal-FromGit.ps1
Install-SIRK-Portal-FromGit_RUN.ps1
tools/install/Install-SIRK-Portal-FromGit.ps1
tools/install/Install-SIRK-Portal-FromGit_RUN.ps1
```

## Walidacja

```bash
npm test
```

`scripts/validate-repository-layout.js` blokuje stare entrypointy i widoki `MyCompany`, root `core/` i `modules/`, płaskie assety aplikacyjne w `public/`, `public/shared-ui/`, stare instalatory, podwójne renderery i niekanoniczne ścieżki loaderów.
