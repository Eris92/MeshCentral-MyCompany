# MyCompany + SirK Portal

## Kierunek integracji

MyCompany jest właścicielem backendu, modułów, storage, permissions i konfiguracji.
SirK Portal jest opcjonalnym, całkowicie niezależnym dokumentem frontendowym udostępnianym przez MyCompany pod `/sirkportal/`.

Portal nie podmienia natywnych plików MeshCentral, nie wstrzykuje layoutu ani CSS do stron Classic/Modern i nie dodaje globalnych `domain.customFiles`. Jedynymi opcjonalnymi elementami integracji są launcher, przekierowanie interfejsu oraz wymuszony ekran logowania, wszystkie kontrolowane ustawieniami MyCompany.

Nie należy uruchamiać równolegle osobnej wtyczki `SirKPortal`, ponieważ rejestruje ona własny globalny shell oraz `domain.customFiles`.

## Moduły

```text
MyCompany
├── Approval Center
├── Move Requests
├── My Commands
├── My Scripts
├── My Jira
├── Defender Tools
├── integrations / encrypted secrets
└── Portal (optional frontend)
```

Portal nie posiada osobnego storage ani kopii logiki modułów.

## Nawigacja Portalu

| Portal | Źródło |
|---|---|
| Przegląd | Portal shell + dane widoczne w aktywnej sesji MeshCentral |
| Urządzenia | widoczne urządzenia i grupy MeshCentral |
| Zarządzanie | montowany moduł MyScripts |
| Akceptacje | montowany Approval Center |
| Automatyzacja | montowany My Commands |
| Zasoby | montowany My Jira / Assets |
| Bezpieczeństwo | montowany Defender Tools |
| Ustawienia | panel administracyjny MyCompany, tylko Site Admin |
| MeshCentral | natywny interfejs MeshCentral |

W szczegółach urządzenia zakładka `Polecenia / Commands` znajduje się pomiędzy `Terminal` i `Pliki / Files`. Montuje moduł My Commands ze wskazanym `nodeId`.

Podczas aktywnego połączenia z pulpitem przy prawej krawędzi może pojawić się uchwyt szybkich poleceń. Otwiera skondensowany katalog poleceń i skryptów, który pozwala je uruchamiać z parametrami, potwierdzeniem i approval workflow, ale nie pobiera ani nie pokazuje widoków Results oraz Output.

## Zakładki hostów i trwałe sesje

Górny pasek `Wszystkie / All + hosty` jest niezależny od podzakładek hosta.

Każdy otwarty host ma osobny iframe umieszczony w stałej warstwie sesji. Iframe:

- jest tworzony najwyżej raz na otwartą zakładkę hosta;
- pozostaje podłączony do DOM podczas przełączania widoków;
- nie jest przenoszony pomiędzy kontenerami;
- nie jest usuwany podczas przejścia do `All` ani innej sekcji Portalu;
- nie zmienia `src`, dopóki użytkownik jawnie nie zamknie zakładki hosta.

Przełączenie `Devices → inny widok → Devices` ma jedynie zmienić widoczność trwałej warstwy sesji. Nie może zrywać Desktop, Terminal ani Files.

Dla każdego hosta zapisywana jest ostatnia podzakładka:

```text
general | desktop | terminal | commands | files | registry | software | amt
```

Po `F5` Portal ma odtworzyć aktywnego hosta i jego podzakładkę bez pośredniego pokazania `Overview` lub `Ogólne`.

## Kontrakt startu po F5

Start Portalu jest dwuetapowy:

1. pobranie bootstrapu, zastosowanie uprawnień i konfiguracji widoków;
2. odtworzenie zapisanego widoku i ewentualnej warstwy sesji hosta.

Od pierwszej widocznej klatki obowiązuje:

- wyłączone pozycje menu nie są widoczne;
- nie pojawia się chwilowo inny widok;
- nie znika cały Portal po rozpoczęciu renderowania;
- nie jest używany długi timeout jako podstawowa ścieżka gotowości;
- awaryjny timeout tylko kończy oczekiwanie, gdy warunek runtime nie został spełniony.

Nie należy obserwować całego `documentElement` przez `MutationObserver`, jeżeli procedura synchronizacji sama generuje obserwowane zmiany. Powoduje to pętle renderowania i biały ekran.

## PL/EN, motyw i branding

Język oraz motyw są wspólne dla głównego dokumentu Portalu i wszystkich otwartych workspace’ów hostów.

Zmiana `PL | EN` albo jasny/ciemny:

- działa natychmiast;
- nie wymaga wyjścia z hosta;
- nie przeładowuje iframe;
- aktualizuje Commands, opisy urządzenia i podzakładki hosta.

W `Settings → SirK Portal → Portal interface` dostępne są:

- nazwa witryny;
- adres ikony witryny używanej w Portalu i jako favicon;
- przełącznik przycisku resetu hasła;
- adres docelowy resetu hasła;
- widoczność i nazwy pozycji menu;
- wymuszanie nowego logowania i nowego interfejsu.

## Widoki szerokie i pełnoekranowe

Przycisk widoku przy obszarze hosta ma dwa sposoby obsługi:

- lewy klik przełącza standardowy widok szeroki;
- prawy klik otwiera menu trybów.

Menu udostępnia:

1. `Widok szeroki`;
2. `Widok szeroki + tryb pełnoekranowy`;
3. `Pełny ekran połączenia`;
4. `Pełny ekran połączenia + tryb pełnoekranowy`.

Tryby nie mogą usuwać ani przeładowywać aktywnego iframe.

## Desktop i Terminal

Desktop i Terminal korzystają z natywnej logiki MeshCentral osadzonej w plugin-local bridge.

Menu strzałki obok `Połącz / Connect`:

- jest przenoszone do `body` odpowiedniego child workspace;
- używa `position: fixed` i wysokiego `z-index`;
- nie może być przycinane przez toolbar;
- nie może zamykać się od zdarzenia, które je otworzyło.

## Zarządzanie, Commands i Approval

- Zarządzanie używa trzykolumnowego układu.
- Zwinięcie pierwszej kolumny musi rzeczywiście zmieniać jej szerokość.
- Ikony pierwszej kolumny są kolorowe, aby nie zlewały się z drugą kolumną.
- My Commands obsługuje PL/EN, Edit, Favorites i Multi.
- Multi przekazuje `commandId` dla wbudowanych poleceń oraz `scriptPath` dla skryptów.
- Management → Results korzysta z publicznych rekordów Approval Service. Publiczny rekord nie zawiera `payload`, dlatego nie wolno filtrować go przez `request.payload.scriptPath`.

## Uprawnienia folderów

`Settings → Uprawnienia folderów` konfiguruje foldery główne My Scripts oraz kategorie My Commands. Reguła folderu zawiera `enabled`, `allowAll` i listę `groupIds` wskazującą grupy użytkowników MeshCentral.

Pusta lista grup bez `allowAll=true` nie nadaje dostępu. Site Admin omija ograniczenie grup, ale folder z `enabled: false` pozostaje ukryty także dla Site Admina. Backend ponownie sprawdza regułę przy bezpośrednim odczycie, edycji, uruchomieniu, wyświetlaniu wyników oraz wykonaniu po approval workflow.

### Język menu Zarządzania

- język jest wspólny z przełącznikiem PL/EN SirK Portal;
- skrypty używają nagłówków `#PL Nazwa | opis` i `#EN Name | description`;
- zmienne i sekrety używają par dyrektyw zakończonych `PL` i `EN`;
- foldery używają opcjonalnego pliku `<NazwaFolderu>.menu` o tym samym formacie;
- opis skryptu lub folderu jest dostępny jako podpowiedź po najechaniu;
- brak tłumaczenia korzysta z metadanych drugiego języka albo starszego nagłówka.

## Lifecycle

- `modules.portal.enabled = false` jest ustawieniem domyślnym.
- Wyłączony Portal nie udostępnia niezależnego interfejsu użytkownikom.
- Włączenie lub wyłączenie wymaga przeładowania głównej karty MeshCentral.
- Zmiana nie usuwa danych ani konfiguracji MyCompany.
- Portal jest ładowany po modułach potrzebnych do montowania widoków.

## Permissions

Portal nie tworzy nowego modelu uprawnień. Każdy widok korzysta z access state odpowiedniego modułu MyCompany. Ustawienia są dostępne tylko dla Site Admin.

## Migracja ze standalone SirKPortal

1. Wyłącz lub odinstaluj standalone `SirKPortal`.
2. Zrestartuj MeshCentral i sprawdź, czy nie są już ładowane jego globalne assets/customFiles.
3. Zaktualizuj MyCompany do bieżącej wersji.
4. Otwórz `MyCompany → Settings → SirK Portal`.
5. Zaznacz `Enable SirK Portal` i zapisz.
6. Po przeładowaniu sprawdź Zarządzanie, Akceptacje, Ustawienia, Urządzenia i powrót do MeshCentral.

Backendowe dane MyScripts, Approval Center, provider settings i integracje pozostają w MyCompany i nie wymagają migracji.

## Wymuszanie interfejsu

- `Wymuszaj nowy ekran logowania` przekierowuje wejście na ekran logowania do `/sirkportal/login`. Strona osadza natywny formularz MeshCentral i nakłada wygląd SirK Portal bez przechwytywania credentials.
- `Wymuszaj nowy interfejs` przekierowuje wejścia do natywnego interfejsu na `/sirkportal/`.
- Oba ustawienia są domyślnie wyłączone. Ich włączenie automatycznie włącza moduł Portalu.
- Techniczny parametr `sirkAuth=1` służy wyłącznie do osadzenia natywnego uwierzytelniania i zapobiega pętli przekierowań.

## Minimalna walidacja po zmianie

1. `F5` na `All`.
2. `F5` na aktywnym hoście i aktywnej podzakładce.
3. `Devices → inny widok → Devices` bez utraty sesji.
4. PL/EN bez opuszczania bieżącego widoku.
5. Jasny/ciemny bez opuszczania bieżącego widoku.
6. Widoczność tylko dozwolonych pozycji menu od pierwszej widocznej klatki.
7. Desktop i Terminal: menu strzałki oraz połączenie.
8. Tryby szerokie i pełnoekranowe bez przeładowania sesji.
