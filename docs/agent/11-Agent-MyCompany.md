# MyCompany project rules

## Start nowego wątku

Źródłem kodu i instrukcji dla bieżącego pluginu jest wyłącznie:

```text
C:\Users\Kris\Documents\MeshCentral-MyCompany
```

Nowy wątek rozpoczynający pracę nad MyCompany ma:

1. pracować w tym repozytorium, a nie w katalogu instalacyjnym;
2. odczytać root `AGENTS.md` i moduły dobrane przez jego router;
3. dla operacji powtarzalnej najpierw sprawdzić `.agents/skills`;
4. traktować `C:\Users\Kris\Documents\MeshCentral 2` jako repozytorium dokumentacji architektury i stanu, a nie źródło pluginu;
5. traktować `C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\MyCompany` jako lokalny artefakt wdrożeniowy, a nie katalog roboczy.

Aktualne Skills Automation-first:

| Skill | Zastosowanie |
|---|---|
| `test-mycompany` | uruchomienie pełnego `npm test` po zmianach |
| `check-mycompany-version` | kontrola spójności wersji przed deploymentem, commit, push lub release |
| `deploy-mycompany-local` | backup i lokalne wdrożenie bez restartu i bez zmiany `mycompany-data` |
| `read-meshcentral-log` | ograniczony odczyt lokalnych logów i diagnostyka |
| `restart-meshcentral-service` | restart tylko po jawnym poleceniu użytkownika |

Każdy Skill ma własny kontrakt i polecenie w `.agents/skills/<nazwa>/SKILL.md`. Nie odtwarzaj ręcznie procedury, którą realizuje istniejący Skill.

## Zasada nadrzędna

`MyCompany` jest jedynym instalowanym pluginem. `MyScripts`, `MyCommands`, `MyJira`, `DefenderTools`, `ApprovalCenter` i `MoveRequests` są modułami wewnętrznymi.

## Domyślny zakres kontekstu

Jeżeli użytkownik zadaje pytanie albo zleca zmianę bez jawnego wskazania starych lub innych wtyczek, ogranicz cały odczyt, wyszukiwanie, diagnostykę, porównania i zmiany do:

```text
C:\Users\Kris\Documents\MeshCentral-MyCompany
C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\MyCompany
C:\Program Files\Open Source\MeshCentral\meshcentral-data\mycompany-data
```

Nie przeszukuj repozytoriów legacy, katalogów innych pluginów ani ich historii Git. Nie sprawdzaj ich kodu, wersji, konfiguracji, logów ani statusu. Samo użycie nazwy modułu, takiej jak MyScripts, MyCommands, MyJira, Approval Center, Move Request lub Defender XDR, oznacza moduł wewnętrzny MyCompany, a nie zgodę na otwarcie dawnego repozytorium.

Rozszerz zakres na stare lub inne wtyczki wyłącznie wtedy, gdy użytkownik jednoznacznie poleci ich sprawdzenie, porównanie, migrację albo audyt. Po zakończeniu takiego podzadania wróć do domyślnego zakresu MyCompany.

Nie pobieraj ani nie ładuj kodu innych pluginów, nie rejestruj modułów jako osobnych pluginów i nie duplikuj wspólnych procedur.

Migracja legacy jest operacją jawną i administracyjną. Runtime nie może przeszukiwać starych katalogów ani wykonywać lub `require()` ich kodu.

Jeżeli procedura występuje w co najmniej dwóch modułach albo może być sparametryzowana, przenieś ją do `core/` albo `public/core.js`.

## Wspólne elementy

- ustawienia: `core/settings-store.js`;
- sekrety: `core/secret-store.js`;
- integracje i maskowanie credentials: `core/integration-service.js`;
- HTTP/HTTPS API client: `core/http-client.js`;
- approval workflow: `core/approval-service.js`;
- urządzenia: `core/device-service.js`;
- parser skryptów: `core/script-library.js`;
- browser runtime: `public/core.js`, `public/runtime.js`;
- główny shell Portalu: `public/portal-standalone.js`;
- przygotowanie startu Portalu: `public/standalone-core.js`;
- trwałe zakładki i sesje hostów: `public/portal-device-tabs.js`;
- workspace urządzenia: `public/portal-device-workspace.js`;
- synchronizacja brandingu, języka i motywu: `public/portal-branding.js`;
- główny CSS: `public/main.css`;
- CSS Portalu i urządzeń: `public/portal-standalone.css`, `public/portal-device-tabs.css`, `public/portal-device-workspace.css`.

Nie twórz osobnych klientów Jira, Graph ani Zabbix, jeżeli funkcjonalność może użyć wspólnego `core/http-client.js` i `core/integration-service.js`.

Ciężkie operacje muszą być lazy-loaded. Nie uruchamiaj raportu Defender, AQL ani pobierania Jira podczas startu MeshCentral.

## Kontrakt SirK Portal

SirK Portal jest niezależnym dokumentem frontendowym dostarczanym przez MyCompany. Nie modyfikuje core MeshCentral i nie może wpływać na natywny interfejs poza jawnie włączonym launcherem albo przekierowaniem.

### Start i odświeżanie

- Po `F5` użytkownik nie może zobaczyć chwilowo wyłączonych pozycji menu.
- Nie wolno renderować statycznego `Overview`, jeżeli zapisany stan wskazuje aktywnego hosta i jego podzakładkę.
- Nie ukrywaj całego dokumentu ani `#sirkStandaloneRoot` przez długi timeout.
- Gotowość ustalaj przez konkretne warunki runtime: bootstrap, zastosowane permissions, właściwy aktywny widok, gotowa warstwa sesji i gotowy child workspace.
- Awaryjny timeout może jedynie przerwać stan oczekiwania; nie może być normalną ścieżką startu.
- Nie używaj `MutationObserver` na całym `documentElement`, jeżeli obserwowane zmiany są generowane przez samą procedurę synchronizacji.

### Zakładki hostów i sesje

- Każdy host ma własny iframe tworzony najwyżej raz na otwartą zakładkę.
- Iframe pozostaje podłączony do stałej warstwy sesji. Nie przenoś go między kontenerami przez `appendChild`.
- Przełączanie hostów, `All` i innych sekcji zmienia wyłącznie klasy widoczności, `aria-hidden`, `pointer-events` i bounds warstwy.
- Nie czyść `innerHTML` kontenera zawierającego aktywny iframe.
- Nie ustawiaj `src = about:blank` poza jawnym zamknięciem zakładki hosta.
- Aktywny host oraz aktywna podzakładka (`general`, `desktop`, `terminal`, `commands`, `files`, `registry`, `software`, `amt`) są zapisywane per host.
- Powrót `Devices → inny widok → Devices` nie może zrywać Desktop, Terminal ani Files.

### Język, motyw i branding

- PL/EN i jasny/ciemny są wspólnym stanem Portalu i wszystkich otwartych child workspace’ów.
- Zmiana języka lub motywu nie może wymagać wyjścia z hosta ani przeładowania iframe.
- Nazwa witryny, favicon i logo są pobierane z konfiguracji Portalu.
- Przycisk resetu hasła ma osobny przełącznik widoczności i konfigurowalny adres.

### Widoki połączeń

- Desktop i Terminal używają natywnej logiki MeshCentral osadzonej w plugin-local bridge.
- Menu strzałki obok `Połącz / Connect` musi być renderowane nad iframe, bez przycinania przez toolbar.
- Przycisk trybu widoku ma lewym kliknięciem przełączać widok szeroki, a prawym kliknięciem otwierać menu dodatkowych trybów.
- Tryby szerokie i pełnoekranowe nie mogą przeładowywać sesji.

## Kontrakt Zarządzania, Commands i Approval

- Pierwsza kolumna Zarządzania ma rzeczywiście zmieniać szerokość po zwinięciu, nie tylko ukrywać etykiety.
- Ikony pierwszej kolumny są kolorowe; druga kolumna i statusy mają odrębny system ikon.
- My Commands używa własnych ikon pozycji, obsługuje PL/EN, Edit, Favorites i Multi.
- Multi wysyła `commandId` dla wbudowanego polecenia i `scriptPath` dla skryptu.
- Management → Results korzysta z danych Approval Service po centralnej kontroli widoczności. Nie filtruj publicznych rekordów przez `request.payload`, ponieważ `publicRequest()` usuwa `payload` przed zwróceniem danych.

## Procedura bezpiecznej zmiany UI

1. Zidentyfikuj element na podstawie DOM lub zrzutu.
2. Znajdź faktyczny renderer i asset ładowany przez stronę.
3. Odczytaj bieżący plik przed zmianą.
4. Sprawdź selektory CSS o większej specyficzności i inline style.
5. Zmień najmniejszy możliwy zakres bez dokładania kolejnego globalnego obserwatora lub timera.
6. Dodaj test sprawdzający faktyczny aktualny kontrakt.
7. Uruchom test celowany i pełne `npm test`.
8. Sprawdź diff oraz wszystkie źródła wersji.
9. Dla runtime zaktualizuj changelog, historię wersji i dokumentację stanu.
10. Nie oznaczaj zmiany jako zakończonej bez wyniku testów lub jawnej informacji, że test środowiskowy pozostaje po stronie użytkownika.

## Walidacja i lokalne wdrożenie

Po każdej zmianie kodu lub konfiguracji użyj Skill `test-mycompany`. Przed deploymentem, commit, push lub release dodatkowo użyj `check-mycompany-version`.

Po pomyślnych testach zmian runtime użyj `deploy-mycompany-local`, aby zsynchronizować bieżące lokalne źródło do:

```text
C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\MyCompany
```

Przed podmianą wykonaj kopię poprzedniego katalogu w `meshcentral-data\plugin-backups`. Nie nadpisuj `meshcentral-data\mycompany-data` i nie restartuj usługi MeshCentral automatycznie, chyba że użytkownik jawnie o to poprosi. Wdrożenie ma pozostawić plugin gotowy do ręcznego reloadu i testu UI.

Zmiana wyłącznie instrukcji agenta lub dokumentacji repozytorium nie wymaga wdrożenia do katalogu instalacyjnego ani podnoszenia wersji pluginu, ponieważ nowe wątki czytają źródłowy `AGENTS.md`, `docs/agent` i `.agents/skills`.
