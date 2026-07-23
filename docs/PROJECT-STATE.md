# MyCompany — aktualny stan projektu

Stan dokumentacji: 2026-07-23  
Bieżąca wersja runtime: `1.5.134`

## Status

MyCompany jest pojedynczym pluginem MeshCentral zawierającym backend, moduły i opcjonalny SirK Portal. Repozytorium `Eris92/MeshCentral-MyCompany` jest źródłem instalacyjnym.

Wersja `1.5.134` przywraca bazową logikę startu Portalu z `1.5.131` i zastępuje globalne obserwowanie DOM kontrolowanym sprawdzaniem gotowości. Zmiana wymaga końcowej weryfikacji UI w środowisku testowym przez `F5` na aktywnym hoście.

## Moduły

- My Scripts / Zarządzanie;
- My Commands / Automatyzacja;
- Approval Center / Akceptacje;
- Move Requests;
- My Jira / Assets;
- Defender Tools / Security;
- wspólne integracje AD, Entra, Jira, Defender i Zabbix;
- opcjonalny SirK Portal.

## Najważniejsze pliki runtime Portalu

| Plik | Odpowiedzialność |
|---|---|
| `public/portal-standalone.html` | początkowy dokument i kolejność assetów |
| `public/standalone-core.js` | przygotowanie pierwszego widoku i obsługa startu |
| `public/portal-standalone.js` | bootstrap, permissions, menu i renderowanie widoków |
| `public/portal-device-tabs.js` | zakładki `All + hosty`, trwałe iframe i warstwa sesji |
| `public/portal-device-workspace.js` | podzakładki i połączenia aktywnego hosta |
| `public/portal-branding.js` | branding, favicon, reset hasła, PL/EN i motyw child workspace |
| `public/portal-device-tabs.css` | pasek zakładek hostów i stała warstwa sesji |
| `public/portal-device-workspace.css` | nagłówek hosta, podzakładki i obszar połączenia |
| `public/portal-management.js` | portalowy widok Zarządzania |
| `public/mycommands.js` | Commands, Edit, Multi, Favorites i PL/EN |

## Trwałe sesje hostów

Zakładki hostów używają niezależnych iframe. Iframe ma pozostać stale podłączony do DOM od utworzenia zakładki do jej jawnego zamknięcia.

Dozwolone podczas przełączania:

- zmiana klas `is-active`;
- zmiana `aria-hidden`;
- zmiana `visibility`, `opacity` i `pointer-events` na stałej warstwie;
- aktualizacja położenia i rozmiaru warstwy sesji.

Niedozwolone:

- `appendChild` przenoszący iframe do innego rodzica;
- `innerHTML = ...` na rodzicu iframe;
- usuwanie iframe przy wejściu do `All` albo innego widoku;
- zmiana `src` poza jawnym zamknięciem zakładki;
- odtwarzanie sesji przez ponowne utworzenie iframe.

## Odtwarzany stan

Portal przechowuje:

- aktywny widok główny;
- listę otwartych hostów;
- aktywnego hosta;
- aktywną podzakładkę osobno dla każdego hosta;
- stan zwinięcia menu;
- PL/EN;
- jasny/ciemny;
- branding Portalu.

Podzakładki hosta:

```text
general | desktop | terminal | commands | files | registry | software | amt
```

## Kontrakt F5

Po odświeżeniu:

1. bootstrap pobiera konfigurację i access state;
2. wyłączone pozycje menu są filtrowane przed pierwszą widoczną klatką;
3. odtwarzany jest zapisany widok;
4. dla Devices tworzona lub aktywowana jest właściwa warstwa hosta;
5. child workspace odtwarza ostatnią podzakładkę;
6. gotowy stan jest pokazywany jednokrotnie.

Nie powinny występować:

- chwilowe `Overview` lub `Ogólne` przed właściwym widokiem;
- biały ekran;
- zniknięcie całego Portalu po rozpoczęciu renderowania;
- pojawienie się wyłączonych pozycji menu;
- oczekiwanie wynikające wyłącznie z długiego timeoutu.

## Portal interface

Ustawienia Portalu obejmują:

- włączenie Portalu;
- wymuszony ekran logowania;
- wymuszony nowy interfejs;
- widoczność pozycji menu;
- nazwy i kolory akcentu widoków;
- nazwę witryny;
- ikonę witryny i favicon;
- widoczność przycisku resetu hasła;
- adres resetu hasła;
- utrzymywanie sesji po restarcie MeshCentral.

## Desktop i Terminal

Desktop i Terminal używają natywnej logiki MeshCentral przez plugin-local bridge.

Menu strzałki przy `Połącz / Connect` jest renderowane poza przycinanym toolbarem i musi pozostać nad iframe. Zdarzenie otwierające menu nie może jednocześnie uruchamiać globalnego zamknięcia.

## Tryby widoku

Lewy klik przycisku widoku przełącza standardowy widok szeroki. Prawy klik otwiera menu:

- Widok szeroki;
- Widok szeroki + tryb pełnoekranowy;
- Pełny ekran połączenia;
- Pełny ekran połączenia + tryb pełnoekranowy.

Żaden z trybów nie może przeładować aktywnego iframe.

## Zarządzanie

- trzy kolumny;
- pierwsza kolumna ma kolorowe ikony;
- zwinięcie zmienia rzeczywistą szerokość kolumny;
- druga kolumna używa ikon folderów i skryptów;
- Result pobiera rekordy z Approval Service;
- publiczne rekordy wyników nie zawierają `payload`.

## Commands

- różne ikony dla poleceń i kategorii;
- PL/EN bez ponownego wejścia do widoku;
- Edit i Favorites dla poleceń;
- Multi dla wbudowanych Commands i skryptów;
- `commandId` dla polecenia, `scriptPath` dla skryptu.

## Approval i Results

`core/approval-service.js` usuwa prywatny `payload` w `publicRequest()`. Widoki klienckie nie mogą filtrować publicznych rekordów po `request.payload`.

Widoczność rekordów jest kontrolowana centralnie:

- Site Admin widzi rekordy zgodnie z providerem;
- requester widzi własne wnioski;
- approver widzi wnioski, które może obsłużyć.

## Obowiązkowa walidacja po zmianie runtime

```text
npm test
```

Dodatkowo ręcznie:

1. `F5` na `All`;
2. `F5` na aktywnym hoście i podzakładce Desktop lub Terminal;
3. `Devices → Zarządzanie → Devices` bez utraty sesji;
4. przełączenie pomiędzy dwoma hostami;
5. PL/EN bez wyjścia z hosta;
6. jasny/ciemny bez wyjścia z hosta;
7. menu Connect w Desktop i Terminal;
8. wszystkie cztery tryby widoku;
9. widoczność tylko dozwolonych pozycji menu;
10. Management → Results z danymi widocznymi również w Approval.

## Zasady wydania

Zmiana runtime wymaga:

- testu celowanego;
- pełnego `npm test`;
- spójnej wersji w `config.json`, `package.json` i pozostałych źródłach wersji;
- changelogu i historii wersji;
- kontrolowanego deploymentu z backupem.

Zmiana wyłącznie dokumentacji nie wymaga podnoszenia wersji pluginu ani deploymentu do katalogu instalacyjnego.
