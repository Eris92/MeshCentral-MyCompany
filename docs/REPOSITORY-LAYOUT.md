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
│   │   └── icon-registry.js      # jedyny helper ikon przeglądarkowych
│   └── modules/                  # dokładnie jeden renderer na moduł
│       ├── approvalcenter/
│       ├── moverequests/
│       ├── mycommands/
│       ├── myscripts/
│       ├── myjira/
│       └── defendertools/
├── web/
│   └── admin/                    # panel administracyjny pluginu
├── assets/
│   └── icons/
│       └── sirk-ui.svg           # kanoniczny sprite SVG
├── tools/
│   ├── install/
│   ├── deployment/
│   ├── diagnostics/
│   └── maintenance/
├── scripts/                      # walidatory/build używane przez npm i CI
├── test/
├── docs/
├── views/
└── seed/
```

## Backend i frontend modułu

Jeden moduł biznesowy może mieć dwie warstwy, ale nie są to dwa niezależne moduły.

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

## Jedna implementacja renderera

Dla jednego klucza modułu może istnieć dokładnie jeden plik rejestrujący:

```js
window.MyCompanyModules.<key> = module;
```

Nie wolno utrzymywać równolegle plików takich jak:

```text
public/approvalcenter.js
public/modules/approvalcenter.js
```

Kanoniczna lokalizacja renderera to `public/modules/<key>/index.js`. Podczas migracji dopuszczalny jest chwilowo plik `public/modules/<key>.js`, ale nie może istnieć drugi renderer tego samego klucza.

## Ikony

Wszystkie standardowe ikony Portalu, native UI i modułów pochodzą z:

```text
assets/icons/sirk-ui.svg
```

Kod przeglądarkowy korzysta z:

```text
public/shared/icon-registry.js
```

Przykład:

```js
window.SirkIcons.svg("settings", "mc-portal-nav-svg")
```

Nie wolno kopiować tych samych definicji `<path>` do wielu plików JavaScript albo HTML. Osobne pliki SVG są dozwolone tylko dla grafik produktowych, logotypów, ikon użytkownika i ikon folderów dostarczanych przez administratora.

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
- `public/modules` — pojedyncze renderery modułów.

### `web/admin/`

Panel administracyjny nie jest Portalem i nie jest adapterem natywnego menu. Wszystkie jego assety mają znajdować się w `web/admin/`.

### `server/`

Cały backend aplikacyjny ma docelowo znajdować się w `server/`. Katalogi `core/` oraz `modules/` w root są przejściową warstwą zgodności podczas migracji.

## Strategia migracji

1. Dodać docelowe katalogi i test architektury.
2. Przenieść narzędzia do `tools/` z launcherami zgodności.
3. Usunąć podwójne renderery frontendowe i podłączyć centralny rejestr ikon.
4. Przenieść backend modułów do `server/modules/`; stare ścieżki zostawić chwilowo jako shimy.
5. Przenieść wspólne serwisy do `server/core/`; zaktualizować importy.
6. Rozdzielić frontend na `public/portal`, `public/native`, `public/shared` i `public/modules`.
7. Przenieść `web/*.js|css` do `web/admin/`.
8. Usunąć shimy po przejściu pełnych testów i lokalnego deploymentu.

Nie wolno wykonywać kroków 4–8 jako mechanicznego przeniesienia bez aktualizacji loaderów, asset map, testów i dokumentacji.