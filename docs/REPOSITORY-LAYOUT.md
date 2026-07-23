# MyCompany repository layout

## Cel

Repozytorium rozdziela backend MeshCentral, nowy SirK Portal, adapter starego GUI MeshCentral, współdzielony frontend oraz panel administracyjny.

## Docelowa struktura

```text
MyCompany/
├── MyCompany.js                  # jedyny entrypoint pluginu wymagany przez MeshCentral
├── plugin-main.js                # cienki bootstrap pluginu
├── MyCompanyAdmin.js             # cienki router panelu administracyjnego i assetów
├── config.json
├── package.json
├── server/
│   ├── core/                     # wspólne serwisy backendowe
│   └── modules/
│       ├── approvalcenter/
│       ├── moverequests/
│       ├── mycommands/
│       ├── myscripts/
│       ├── myjira/
│       ├── defendertools/
│       └── portal/
├── public/
│   ├── portal/                   # wyłącznie samodzielny SirK Portal
│   ├── native/                   # wyłącznie adapter natywnego GUI MeshCentral
│   ├── shared/                   # frontend współdzielony przez portal i native
│   └── modules/                  # renderery frontendowe modułów
│       ├── approvalcenter/
│       ├── moverequests/
│       ├── mycommands/
│       ├── myscripts/
│       ├── myjira/
│       └── defendertools/
├── web/
│   └── admin/                    # panel administracyjny pluginu
├── tools/
│   ├── install/
│   ├── deployment/
│   ├── diagnostics/
│   └── maintenance/
├── scripts/                      # walidatory/build używane przez npm i CI
├── test/
├── docs/
├── views/
├── seed/
└── assets/
```

## Backend i frontend modułu

Jeden moduł biznesowy może mieć dwie warstwy, ale nie są to dwa niezależne moduły.

Przykład Approval Center:

```text
server/modules/approvalcenter/index.js
```

Backend Node/MeshCentral:

- API GET/POST;
- uprawnienia;
- settings;
- approval workflow;
- dostęp do wspólnych serwisów z `server/core`.

```text
public/modules/approvalcenter/index.js
```

Frontend przeglądarkowy:

- menu;
- toolbar;
- tabele i karty;
- wywołania API backendu;
- wspólny kontrakt UI.

Obie warstwy używają jednego klucza modułu: `approvalcenter`.

## Zasady katalogów

### Root

W root mogą pozostać wyłącznie entrypointy i pliki wymagane przez MeshCentral lub narzędzia pakietujące:

- `MyCompany.js`;
- `plugin-main.js`;
- `MyCompanyAdmin.js`;
- `config.json`;
- `package.json`;
- kompatybilne launchery instalatora.

Pełne skrypty PowerShell nie mogą być dodawane do root.

### `public/`

`public/` oznacza kod wysyłany do przeglądarki. Nie może zawierać backendowego `require()`, dostępu do filesystemu ani sekretów.

- `public/portal` — nowy Portal;
- `public/native` — stary/natywny interfejs;
- `public/shared` — biblioteki wspólne;
- `public/modules` — renderery modułów.

### `web/admin/`

Panel administracyjny nie jest Portalem i nie jest adapterem natywnego menu. Wszystkie jego assety mają znajdować się w `web/admin/`.

### `server/`

Cały backend aplikacyjny ma docelowo znajdować się w `server/`. Katalogi `core/` oraz `modules/` w root są przejściową warstwą zgodności podczas migracji.

## Strategia migracji

1. Dodać docelowe katalogi i test architektury.
2. Przenieść narzędzia do `tools/` z launcherami zgodności.
3. Przenieść backend modułów do `server/modules/`; stare ścieżki zostawić chwilowo jako shimy.
4. Przenieść wspólne serwisy do `server/core/`; zaktualizować importy.
5. Rozdzielić frontend na `public/portal`, `public/native`, `public/shared` i `public/modules`.
6. Przenieść `web/*.js|css` do `web/admin/`.
7. Usunąć shimy po przejściu pełnych testów i lokalnego deploymentu.

Nie wolno wykonywać kroków 3–7 jako mechanicznego przeniesienia bez aktualizacji loaderów, asset map, testów i dokumentacji.
