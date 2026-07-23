# SIRK-Portal project rules

## Źródła prawdy

Kanoniczne repozytorium:

```text
C:\Users\Kris\Documents\SIRK-Portal
https://github.com/Eris92/SIRK-Portal
```

Lokalny artefakt wdrożeniowy:

```text
C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\SIRK-Portal
```

Dane runtime:

```text
C:\Program Files\Open Source\MeshCentral\meshcentral-data\sirk-platform-data
```

Repozytorium jest katalogiem roboczym. Katalog pluginu w instalacji MeshCentral jest artefaktem deploymentu.

## Start zadania

1. potwierdź root, branch i `git status`;
2. przeczytaj `AGENTS.md`;
3. przeczytaj `docs/INDEX.md`;
4. wybierz dokładnie jeden indeks warstwy;
5. odczytaj tylko wskazany entrypoint lub moduł i bezpośrednie zależności;
6. sprawdź `.agents/skills` dla operacji deterministycznej;
7. nie skanuj całego repozytorium ani historii Git bez konkretnej przyczyny.

## Nazwy

- plugin/repo: `SIRK-Portal`;
- produkt: `SIRK Management Platform`;
- UI: `SIRK Platform`;
- entrypoint: `SIRK-Portal.js`.

Nie dodawaj aliasów, shimów, fallbacków, widoków ani zmiennych globalnych `MyCompany`.

## Zakres domyślny

Bez jawnego polecenia pracuj tylko w:

```text
C:\Users\Kris\Documents\SIRK-Portal
C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\SIRK-Portal
C:\Program Files\Open Source\MeshCentral\meshcentral-data\sirk-platform-data
```

Nie otwieraj dawnych repozytoriów, starych pluginów ani `mycompany-data`.

## Struktura

- backend: `server/core/`, `server/modules/`;
- standalone Portal: `public/portal/`;
- native adapter: `public/native/`;
- shared frontend: `public/shared/`;
- renderery: `public/modules/`;
- panel admina: `web/admin/`;
- widok admina: `views/SIRK-Portal.handlebars`;
- ikony: `assets/icons/sirk-ui.svg`.

Katalogi `core/`, `modules/` w root, `public/shared-ui/` i płaskie pliki aplikacyjne w `public/` są zabronione.

## Wspólne elementy backendu

- ustawienia: `server/core/settings-store.js`;
- sekrety: `server/core/secret-store.js`;
- integracje: `server/core/integration-service.js`;
- HTTP client: `server/core/http-client.js`;
- approval workflow: `server/core/approval-service.js`;
- urządzenia: `server/core/device-service.js`;
- wykonanie skryptów: `server/core/server-script-executor.js`;
- runtime: `server/core/runtime.js`, `server/core/runtime-portal.js`.

## Kontrakt Portalu

- pierwszy widoczny stan uwzględnia permissions i zapisany widok;
- brak sekwencji `Overview -> host`;
- brak długiego timeoutu jako normalnej gotowości;
- iframe sesji hosta jest trwały;
- nie przenoś iframe, nie czyść jego rodzica i nie zmieniaj `src`;
- powrót do Devices nie zrywa Desktop, Terminal ani Files;
- język i motyw synchronizują się bez przeładowania workspace.

## Procedura zmiany UI

1. użyj `public/INDEX.md`;
2. znajdź faktyczny loader w `admin.js` albo `plugin-main-standalone.js`;
3. potwierdź renderer i CSS;
4. zmień najmniejszy zakres;
5. dodaj lub zaktualizuj test aktualnego kontraktu;
6. uruchom test celowany i `npm test`;
7. sprawdź diff i wersję.

## Wersjonowanie

Źródła wersji:

```text
package.json
config.json
README.md
changelog.md
version-history.json
```

`plugin-main.js` pobiera wersję z `config.json`. Wszystkie źródła muszą być spójne przed commit, push i release.

## Deployment

Deployment nie może zmieniać `sirk-platform-data`. Przed podmianą pluginu przygotuj backup. Restart usługi wymaga jawnego polecenia.

Zmiana samych instrukcji lub dokumentacji zwykle nie wymaga deploymentu, ale jawne polecenie podniesienia wersji ma pierwszeństwo.
