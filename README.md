# MyCompany 1.5.137

Jeden skonsolidowany plugin MeshCentral zawierający backend, moduły administracyjne, biblioteki skryptów i opcjonalny SirK Portal.

## Dokumentacja

- [Aktualny stan projektu](docs/PROJECT-STATE.md)
- [Integracja MyCompany + SirK Portal](docs/portal-integration.md)
- [AGENTS.md](AGENTS.md)
- [Reguły agenta dla MyCompany](docs/agent/11-Agent-MyCompany.md)
- [Prompt startowy nowej rozmowy](docs/agent/Prompt-Start-MyCompany-Conversation.md)

Repozytorium jest kompletnym źródłem instalacyjnym. Runtime nie ładuje kodu z dawnych repozytoriów ani sąsiednich pluginów.

## Moduły

```text
MyCompany
├── My Scripts / Zarządzanie
├── My Commands / Automatyzacja i Polecenia
├── Approval Center / Akceptacje
├── Move Requests
├── My Jira / Assets
├── Defender Tools / Security
├── wspólne integracje i encrypted secrets
└── SirK Portal (opcjonalny frontend)
```

`MyScripts`, `MyCommands`, `MyJira`, `DefenderTools`, `ApprovalCenter` i `MoveRequests` są modułami wewnętrznymi, a nie osobnymi pluginami.

## SirK Portal

SirK Portal jest niezależnym dokumentem frontendowym udostępnianym przez MyCompany. Nie modyfikuje core MeshCentral, nie podmienia natywnych plików i nie rejestruje globalnych `domain.customFiles`.

Nie uruchamiaj jednocześnie osobnej wtyczki `SirKPortal`.

Włączenie:

```text
MyCompany → Settings → SirK Portal → Enable SirK Portal
```

Główne widoki:

- Przegląd;
- Urządzenia;
- Akceptacje;
- Automatyzacja;
- Monitoring;
- Zasoby;
- Zarządzanie;
- Raporty;
- Bezpieczeństwo;
- Ustawienia;
- MeshCentral.

Każdy widok może zostać ukryty albo ograniczony do grup użytkowników MeshCentral. Backend ponownie sprawdza dostęp do endpointów i zasobów; ukrycie elementu UI nie jest jedyną kontrolą bezpieczeństwa.

## Jeden kontrakt UI

Wszystkie podobne moduły SirK Portal korzystają z jednego kontraktu:

```text
mc-portal-module-shell
├── mc-portal-module-toolbar
└── mc-portal-module-workspace
    └── mc-portal-module-layout
        ├── mc-portal-module-primary
        ├── mc-portal-module-secondary
        └── mc-portal-module-details
```

Wspólne komponenty:

```text
mc-portal-toolbar-button
mc-portal-nav-item
mc-portal-nav-icon
mc-portal-nav-label
mc-portal-card
mc-portal-button
mc-portal-filter
mc-portal-table-wrap
mc-portal-table
```

Kontrakt jest zdefiniowany w:

```text
public/vendor/sirk-portal/portal-ui-contract.css
public/vendor/sirk-portal/portal-ui-contract.js
```

Domyślna geometria:

```text
pierwsza kolumna:       184 px
druga kolumna:          236 px
droga kolumna w Edit:   440 px
pierwsza po zwinięciu:   56 px
wysokość toolbara:       48 px
wysokość pozycji menu:   42 px
```

Zasady:

- Polecenia, Zarządzanie, Akceptacje, Ustawienia i inne trzykolumnowe moduły mają ten sam shell, toolbar, nawigację, karty, formularze i tabele.
- Zwinięcie zawsze zmienia rzeczywisty track pierwszej kolumny.
- Edit Mode zawsze zwiększa drugi track do wspólnej szerokości.
- Ikony pierwszej kolumny nie mają kolorowego tła; mogą różnić się samym kolorem lub grafiką.
- Moduł może nadpisać zmienne `--portal-primary-width`, `--portal-secondary-width` lub akcent, ale nie może budować drugiego równoległego systemu layoutu.
- Stare klasy `mc-shared-*`, `sirk-management-*` i `mc-admin-*` mogą pozostać jako klasy funkcjonalne, lecz w Portalu otrzymują również odpowiadające im klasy `mc-portal-*`.
- CSS Portalu jest ograniczony do `#sirkPortalRoot` i nie może zmieniać oryginalnego interfejsu MeshCentral.
- Ustawienia są osadzone w same-origin iframe, ale otrzymują końcowy kontrakt CSS, motyw i zmienne Portalu. Style iframe nie mogą wpływać na pozostałe widoki.
- Wyjątkiem jest `Urządzenia`, które zachowuje własny układ sesji i zakładek, ale nie może przechowywać stylów Zarządzania ani innych modułów.

## Zakładki hostów i trwałe sesje

Widok Urządzenia posiada dwa poziomy nawigacji:

1. górne zakładki `Wszystkie / All + otwarte hosty`;
2. podzakładki aktywnego hosta:

```text
Ogólne | Pulpit | Terminal | Polecenia | Pliki | Rejestr | Oprogramowanie | Intel AMT
```

Każdy otwarty host ma osobny iframe umieszczony w stałej warstwie sesji. Przełączenie hosta, `All` albo innego widoku Portalu nie powinno usuwać, przenosić ani przeładowywać iframe.

Aktywny host i jego podzakładka są zapisywane. Po `F5` Portal ma wrócić bezpośrednio do właściwego hosta i podzakładki, bez pośredniego pokazania `Overview` lub `Ogólne`.

## PL/EN, motyw i branding

PL/EN oraz jasny/ciemny są wspólne dla głównego Portalu, otwartych workspace’ów hostów i osadzonych Ustawień. Zmiana nie powinna wymagać opuszczenia bieżącego widoku ani przeładowania aktywnej sesji.

`Settings → SirK Portal → Portal interface` zawiera między innymi:

- nazwę witryny;
- adres ikony witryny i favicon;
- widoczność przycisku resetu hasła;
- adres resetu hasła;
- widoczność, nazwy i akcenty pozycji menu;
- wymuszenie nowego ekranu logowania;
- wymuszenie nowego interfejsu;
- utrzymywanie sesji po restarcie MeshCentral.

## Zarządzanie i Polecenia

Zarządzanie i Polecenia korzystają z tego samego trzykolumnowego systemu, wspólnego toolbara, katalogu, Favorites, Edit Mode, Results i formularzy.

My Scripts obsługuje:

- PL/EN nazw, opisów, zmiennych i opcji;
- Favorites;
- Edit Mode;
- Credentials i Secrets;
- potwierdzenie wykonania;
- Approval Levels;
- Results i Debug.

My Commands obsługuje:

- wbudowane polecenia oraz skrypty PowerShell;
- osobne ikony kategorii i poleceń;
- PL/EN;
- Edit i Favorites;
- Multi dla wielu urządzeń;
- parametry i potwierdzenia;
- approval workflow.

Multi wysyła `commandId` dla wbudowanego polecenia i `scriptPath` dla skryptu.

## Approval Center i Results

Approval Center jest wspólnym workflow dla providerów MyCompany.

`core/approval-service.js` usuwa prywatne `payload` przed zwróceniem publicznego rekordu. Widoki klienckie nie mogą filtrować publicznych wyników przez `request.payload`.

Management → Results i Approval korzystają z tego samego źródła danych oraz centralnej kontroli widoczności.

## Uprawnienia

Reguły lewego menu Portalu oraz folderów My Scripts i My Commands stosują deny-by-default.

- `enabled: false` ukrywa i blokuje zasób;
- `allowAll: true` nadaje dostęp wszystkim użytkownikom posiadającym dostęp do modułu;
- `groupIds` ogranicza dostęp do wybranych grup MeshCentral;
- pusta lista grup bez `allowAll=true` nie nadaje dostępu;
- Site Admin omija ograniczenie grupowe dla włączonych elementów.

## Dane trwałe

```text
meshcentral-data/mycompany-data
├── settings.json
├── requests.json
├── secrets.json
├── .secret.key
├── defender/
└── scripts/
    ├── MyScripts/
    └── MyCommands/
```

Portal nie tworzy osobnego storage. Sekrety nie są wysyłane do przeglądarki. Panel administracyjny pokazuje wyłącznie stan `configured`.

## Instalacja z Git

Uruchom jako Administrator:

```powershell
.\Install-MyCompany-FromGit_RUN.ps1
```

Installer pobiera `main`, waliduje źródło, wykonuje atomową podmianę katalogu pluginu i uruchamia MeshCentral ponownie.

Nie nadpisuj `meshcentral-data/mycompany-data` podczas aktualizacji pluginu.

## Testy

```bash
npm test
```

Po zmianach Portalu obowiązkowa jest również ręczna kontrola:

1. `F5` na `All`;
2. `F5` na aktywnym hoście i aktywnej podzakładce;
3. `Devices → inny widok → Devices` bez utraty sesji;
4. Polecenia, Zarządzanie, Akceptacje i Ustawienia w trybie rozwiniętym oraz zwiniętym;
5. Edit Mode i szerokość drugiej kolumny;
6. PL/EN bez opuszczania bieżącego widoku;
7. jasny/ciemny bez opuszczania bieżącego widoku;
8. tabele, filtry, karty i przyciski w każdym module;
9. Desktop i Terminal wraz z menu Connect;
10. widoczność tylko dozwolonych pozycji menu.

Test `test/portal-ui-contract.test.js` blokuje powrót wielu niezależnych layoutów, stylów Zarządzania w arkuszu Devices oraz starego globalnego mutatora DOM.

## Praca agenta

Każdy nowy wątek dotyczący MyCompany zaczyna się od `AGENTS.md` oraz `docs/agent/11-Agent-MyCompany.md`.

Zmiana runtime wymaga testów, spójnej wersji, changelogu, historii wersji oraz kontrolowanego deploymentu.
