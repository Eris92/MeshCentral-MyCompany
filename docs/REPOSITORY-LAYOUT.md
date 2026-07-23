# SIRK Management Platform — struktura repozytorium

## Nazwy produktu

- nazwa techniczna pluginu: `SIRK-Portal`;
- nazwa wyświetlana: `SIRK Management Platform`;
- nazwa skrócona w interfejsie: `SIRK Platform`.

Repozytorium nie utrzymuje zgodności ze strukturą testową `MyCompany`. Stare entrypointy, shimy, aliasy, katalogi danych i ścieżki assetów są usunięte.

## Struktura

```text
SIRK-Portal/
├── SIRK-Portal.js
├── plugin-main.js
├── plugin-main-standalone.js
├── admin.js
├── config.json
├── package.json
├── server/
│   ├── core/
│   │   ├── runtime.js
│   │   ├── runtime-portal.js
│   │   ├── settings-store.js
│   │   ├── secret-store.js
│   │   ├── approval-service.js
│   │   ├── device-service.js
│   │   ├── integration-service.js
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
│   ├── portal/
│   │   ├── standalone/
│   │   │   ├── index.html
│   │   │   ├── login.html
│   │   │   ├── scripts/
│   │   │   └── styles/
│   │   ├── vendor/
│   │   ├── index.js
│   │   └── portal.css
│   ├── native/
│   │   ├── mesh-plugin-core.js
│   │   ├── portal-launcher.js
│   │   ├── device-tabs.js
│   │   ├── device-tabs.css
│   │   └── approval.css
│   ├── shared/
│   │   ├── core.js
│   │   ├── runtime.js
│   │   ├── module-shell.js
│   │   ├── icon-registry.js
│   │   ├── styles/
│   │   └── ui/
│   └── modules/
│       ├── approvals/
│       ├── automation/
│       ├── commands/
│       ├── jira/
│       ├── move-requests/
│       └── security/
├── web/
│   └── admin/
├── assets/
│   └── icons/
│       └── sirk-ui.svg
├── views/
│   └── SIRK-Portal.handlebars
├── tools/
│   └── install/
├── scripts/
├── test/
├── docs/
└── seed/
```

## Zasady backendu

Cały kod Node.js i integracje z MeshCentral znajdują się w `server/`.

- `server/core/` zawiera runtime, storage, security, integracje i wspólne usługi;
- `server/modules/` zawiera moduły funkcjonalne;
- każdy moduł używa katalogu `kebab-case` i posiada `index.js`;
- katalogi `core/` oraz `modules/` w root są zabronione;
- backend nie może być umieszczany w `public/`.

Kanoniczny katalog danych runtime:

```text
meshcentral-data/sirk-platform-data
```

Wtyczka testowa nie migruje i nie zachowuje danych z `mycompany-data`.

## Zasady frontendu

`public/` zawiera wyłącznie cztery warstwy aplikacyjne:

- `public/portal/` — samodzielny SIRK Portal;
- `public/native/` — integracja z natywnym GUI MeshCentral;
- `public/shared/` — wspólny runtime, komponenty i style;
- `public/modules/` — pojedyncze renderery modułów.

Pliki aplikacyjne nie mogą leżeć bezpośrednio w `public/`. Katalog `public/shared-ui/` jest usunięty; jego zawartość znajduje się w `public/shared/ui/`.

## Moduły

Backend i frontend jednego modułu są oddzielnymi warstwami tego samego modułu:

```text
server/modules/approval-center/index.js
public/modules/approvals/index.js
```

Dla jednego modułu może istnieć tylko jeden renderer. Zabronione jest utrzymywanie drugiego pliku w płaskim `public/`.

## Loadery

Przepływ ładowania:

```text
SIRK-Portal.js
  → plugin-main-standalone.js
    → plugin-main.js
      → server/core/runtime-portal.js
        → server/core/runtime.js
          → server/modules/*
```

Frontend natywny jest ładowany przez jedną mapę assetów w `admin.js`. Publiczne nazwy endpointów mogą pozostać stabilne, ale każda nazwa wskazuje na dokładnie jeden plik w strukturze kanonicznej.

Standalone Portal używa jednej mapy assetów w `plugin-main-standalone.js` i jednego endpointu API:

```text
/sirk/api/v1/approvals
```

## Panel administracyjny

Wszystkie assety panelu administracyjnego znajdują się w:

```text
web/admin/
```

Jedyny widok panelu:

```text
views/SIRK-Portal.handlebars
```

## Ikony

Kanoniczny sprite:

```text
assets/icons/sirk-ui.svg
```

Rejestr przeglądarkowy:

```text
public/shared/icon-registry.js
```

Standardowe ikony nie powinny być kopiowane jako powtarzające się inline SVG w wielu modułach.

## Instalacja

Kanoniczne instalatory:

```text
Install-SIRK-Portal-FromGit.ps1
Install-SIRK-Portal-FromGit_RUN.ps1
tools/install/Install-SIRK-Portal-FromGit.ps1
tools/install/Install-SIRK-Portal-FromGit_RUN.ps1
```

Instalator używa `SIRK-Portal.js`, katalogu pluginu `SIRK-Portal` oraz danych `sirk-platform-data`.

## Walidacja

```bash
npm test
```

`scripts/validate-repository-layout.js` blokuje:

- stare entrypointy i widoki `MyCompany`;
- katalogi `core/` i `modules/` w root;
- płaskie pliki aplikacyjne w `public/`;
- katalog `public/shared-ui/`;
- stare instalatory;
- podwójne renderery;
- niekanoniczne ścieżki loaderów.
