# Prompt startowy nowej rozmowy — SIRK-Portal

## Prompt do wklejenia

```text
Pracujemy wyłącznie nad pluginem MeshCentral SIRK-Portal.

Repozytorium źródłowe:
C:\Users\Kris\Documents\SIRK-Portal

Repozytorium GitHub:
https://github.com/Eris92/SIRK-Portal

Lokalna instalacja testowa:
C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\SIRK-Portal

Dane runtime:
C:\Program Files\Open Source\MeshCentral\meshcentral-data\sirk-platform-data

Zanim zaczniesz:
1. Potwierdź root, aktywny branch i git status.
2. Przeczytaj AGENTS.md.
3. Przeczytaj docs/INDEX.md.
4. Otwórz tylko indeks warstwy związanej z zadaniem: server/INDEX.md, public/INDEX.md, web/INDEX.md, scripts/INDEX.md albo test/INDEX.md.
5. Z indeksu wybierz entrypoint, loader, moduł lub test. Czytaj tylko wskazane pliki i ich bezpośrednie zależności.
6. Nie skanuj całego repozytorium ani historii Git, jeżeli indeks wystarcza.
7. Dla operacji deterministycznych sprawdź .agents/skills.
8. Nie wykonuj pull, merge, rebase, commit, push, release, deployment ani restartu bez zakresu wynikającego z mojego polecenia.

Stałe zasady:
- Kanoniczna nazwa pluginu i repozytorium to SIRK-Portal.
- Nie utrzymuj kompatybilności, aliasów, shimów ani migracji MyCompany.
- Nie czytaj ani nie migruj mycompany-data.
- Backend znajduje się wyłącznie w server/.
- Frontend znajduje się w public/portal, public/native, public/shared i public/modules.
- Panel administracyjny znajduje się w web/admin i views/SIRK-Portal.handlebars.
- Przed zmianą UI potwierdź loader w admin.js albo plugin-main-standalone.js.
- Iframe aktywnej sesji hosta pozostaje stale podłączony do DOM.
- PL/EN i motyw nie mogą przeładowywać child workspace.
- Po zmianie runtime uruchom test celowany i npm test.
- Przed commit/push sprawdź spójność package.json, config.json, README.md, changelog.md i version-history.json.

Na początku odpowiedz:
- jaki root i branch potwierdziłeś;
- które indeksy przeczytałeś;
- jaki jest stan Git i wersja;
- jaki minimalny zakres przyjmujesz.

Moje pierwsze zadanie:
[TU WPISZ ZADANIE]
```

Prompt nie daje automatycznej zgody na operacje destrukcyjne ani produkcyjne.
