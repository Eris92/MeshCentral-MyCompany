# SIRK Management Platform i SIRK Portal

## Architektura

`SIRK-Portal` jest jednym pluginem MeshCentral. Dostarcza:

- backend i storage SIRK Platform;
- panel administracyjny;
- samodzielny SIRK Portal;
- adapter do natywnego GUI MeshCentral;
- wspólne moduły Automation, Commands, Approvals, Jira, Device Transfers i Security.

Portal nie podmienia plików core MeshCentral, nie wstrzykuje globalnych `domain.customFiles` i nie posiada osobnego storage.

## Warstwy

```text
server/         backend i API
public/portal/  standalone Portal
public/native/  adapter natywnego GUI
public/shared/  współdzielony runtime i UI
public/modules/ renderery modułów
web/admin/      panel administracyjny
```

## Nawigacja

| Widok | Źródło |
|---|---|
| Przegląd | shell Portalu i bezpieczne dane bieżącej sesji |
| Urządzenia | urządzenia i grupy dostępne użytkownikowi |
| Zarządzanie | Automation |
| Akceptacje | Approvals |
| Automatyzacja | Commands i skrypty |
| Zasoby | Jira Integration |
| Bezpieczeństwo | Security |
| Ustawienia | panel `web/admin/`, tylko Site Admin |
| MeshCentral | natywny interfejs MeshCentral |

## Loadery

Backend:

```text
SIRK-Portal.js
  -> plugin-main-standalone.js
    -> plugin-main.js
      -> server/core/runtime-portal.js
        -> server/core/runtime.js
```

Frontend standalone jest mapowany w `plugin-main-standalone.js`.  
Assety natywnego UI i panelu administracyjnego są mapowane w `admin.js`.

## Storage

Jedyny katalog danych:

```text
meshcentral-data/sirk-platform-data
```

Plugin nie odczytuje ani nie migruje `mycompany-data`.

## Zakładki hostów i trwałe sesje

Górny pasek `Wszystkie / All + hosty` jest niezależny od podzakładek hosta.

Każdy host ma osobny iframe, który:

- jest tworzony najwyżej raz na otwartą zakładkę;
- pozostaje podłączony do DOM;
- nie jest przenoszony między kontenerami;
- nie jest usuwany przy wejściu do `All` ani innej sekcji;
- nie zmienia `src` do czasu jawnego zamknięcia zakładki.

Przełączenie `Devices -> inny widok -> Devices` zmienia wyłącznie widoczność stałej warstwy sesji.

Zapisywane podzakładki:

```text
general | desktop | terminal | commands | files | registry | software | amt
```

## Start po F5

1. bootstrap pobiera konfigurację i access state;
2. permissions są stosowane przed pierwszą widoczną klatką;
3. odtwarzany jest zapisany widok;
4. dla Devices aktywowana jest właściwa warstwa hosta;
5. child workspace odtwarza ostatnią podzakładkę;
6. gotowy stan jest pokazywany jednokrotnie.

Nie należy używać długiego timeoutu jako normalnej ścieżki gotowości ani obserwować całego `documentElement`, gdy synchronizacja sama generuje obserwowane mutacje.

## Język, motyw i branding

PL/EN oraz jasny/ciemny są wspólnym stanem Portalu i wszystkich otwartych workspace’ów. Zmiana nie może przeładowywać iframe.

Konfiguracja Portalu obejmuje nazwę witryny, favicon/logo, reset hasła, widoczność pozycji menu oraz opcjonalne wymuszanie ekranu logowania i interfejsu.

## Desktop i Terminal

Desktop i Terminal używają natywnej logiki MeshCentral osadzonej w plugin-local bridge.

Menu obok `Połącz / Connect` musi być renderowane nad iframe i nie może być przycinane przez toolbar. Tryby szerokie i pełnoekranowe nie mogą usuwać ani przeładowywać sesji.

## Permissions

Ukrycie elementu UI nie zastępuje kontroli backendowej. Każdy endpoint i zasób ponownie sprawdza access state, folder permissions i rolę użytkownika.

Pusta lista grup bez `allowAll=true` nie nadaje dostępu. Site Admin omija ograniczenie grupowe tylko dla włączonego zasobu.

## Lifecycle

- Portal może być wyłączony w konfiguracji;
- zmiana ustawień UI wymaga reloadu karty, jeżeli loader nie obsługuje hot reload;
- dane w `sirk-platform-data` nie są usuwane podczas aktualizacji pluginu;
- nie istnieje etap migracji z `MyCompany`.

## Minimalna walidacja

1. `F5` na `All`.
2. `F5` na aktywnym hoście i podzakładce.
3. `Devices -> inny widok -> Devices` bez utraty sesji.
4. PL/EN bez opuszczania widoku.
5. Jasny/ciemny bez opuszczania widoku.
6. Widoczność wyłącznie dozwolonych pozycji menu od pierwszej klatki.
7. Desktop i Terminal: połączenie oraz menu.
8. Tryby szerokie i pełnoekranowe bez przeładowania sesji.
