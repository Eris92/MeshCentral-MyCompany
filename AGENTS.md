# AGENTS.md — router instrukcji SIRK-Portal

## Język

- Komunikuj się z użytkownikiem po polsku.
- Kod i standardową nomenklaturę techniczną zapisuj zgodnie z konwencją projektu.

## Obowiązkowy start: index-first

Każde zadanie rozpoczynaj od ograniczenia zakresu, a nie od skanowania repozytorium.

1. Potwierdź root repozytorium, aktywny branch i bieżący status Git.
2. Przeczytaj ten plik.
3. Przeczytaj `docs/INDEX.md`.
4. Otwórz tylko indeks warstwy związanej z zadaniem:
   - backend: `server/INDEX.md`;
   - Portal, native UI, shared UI lub renderery: `public/INDEX.md`;
   - panel administracyjny: `web/INDEX.md`;
   - build i walidatory: `scripts/INDEX.md`;
   - testy: `test/INDEX.md`.
5. Z indeksu wybierz entrypoint, loader, moduł, test lub dokument i czytaj tylko ten plik oraz jego bezpośrednie zależności.
6. Rozszerz wyszukiwanie wyłącznie wtedy, gdy indeks nie zawiera potrzebnego mapowania, wynik jest niejednoznaczny albo bezpośrednia weryfikacja nie powiodła się.
7. Nie pobieraj całego drzewa, pełnej historii Git ani wszystkich dokumentów „na zapas”.

Przy szerszym odczycie krótko odnotuj, czego zabrakło w indeksie, aby indeks mógł zostać uzupełniony.

## Moduły instrukcji

Wszystkie ścieżki są względne wobec root repozytorium. Zawsze stosuj:

- `docs/agent/00-Agent-Core.md`
- `docs/agent/01-Agent-Tryby.md`
- `docs/agent/03-Agent-Jakosc-Bezpieczenstwo.md`

Dobieraj tylko moduły potrzebne dla bieżącego zadania:

| Zakres | Moduł |
|---|---|
| automatyzacja, wersjonowanie, skrypty | `docs/agent/02-Agent-Automation.md` |
| testy i weryfikacja | `docs/agent/04-Agent-Testy-Weryfikacja.md` |
| Git, commit, push, release | `docs/agent/05-Agent-Git-Release.md` |
| dokumentacja i stan | `docs/agent/06-Agent-Dokumentacja-Stanu.md` |
| konfiguracja i sekrety | `docs/agent/07-Agent-Konfiguracja-Sekrety.md` |
| zależności | `docs/agent/08-Agent-Zaleznosci-Aktualizacje.md` |
| logi i diagnostyka | `docs/agent/09-Agent-Logi-Diagnostyka.md` |
| plugin MeshCentral | `docs/agent/10-Agent-MeshCentral-Plugin.md` |
| każda zmiana SIRK-Portal | `docs/agent/11-Agent-SIRK-Portal.md` |
| PowerShell | `docs/agent/20-Agent-PowerShell.md` |
| JavaScript | `docs/agent/21-Agent-JavaScript.md` |
| Python | `docs/agent/22-Agent-Python.md` |
| Windows | `docs/agent/30-Agent-Windows.md` |
| Linux | `docs/agent/31-Agent-Linux.md` |
| Infrastructure/CI/CD | `docs/agent/40-Agent-Infrastructure.md` |
| Security | `docs/agent/41-Agent-Security.md` |

## Kanoniczne nazwy i granice

- repozytorium i techniczna nazwa pluginu: `SIRK-Portal`;
- nazwa produktu: `SIRK Management Platform`;
- nazwa skrócona: `SIRK Platform`;
- entrypoint: `SIRK-Portal.js`;
- dane runtime: `meshcentral-data/sirk-platform-data`.

Nie utrzymuj aliasów, shimów, migracji ani fallbacków `MyCompany`. Nie czytaj starego repozytorium ani `mycompany-data`, chyba że użytkownik jawnie zleci niezależny audyt historyczny.

## Obowiązkowa kontrola zmian

Przed zmianą runtime ustal rzeczywisty łańcuch ładowania:

1. znajdź entrypoint lub loader wskazany przez właściwy `INDEX.md`;
2. potwierdź mapę assetu, route albo `require()`;
3. odczytaj bieżący plik implementacji;
4. odczytaj tylko bezpośrednie zależności potrzebne do zmiany;
5. po zmianie sprawdź diff, test celowany i źródła wersji.

Nie zakładaj, że plik o podobnej nazwie jest używany przez runtime.

## Kontrakty SIRK Portal

- nie ukrywaj całego `#sirkStandaloneRoot` ani dokumentu podczas `F5`;
- nie używaj długich timeoutów jako podstawowego mechanizmu gotowości;
- wyłączone elementy menu nie mogą być widoczne przed zastosowaniem uprawnień;
- właściwy widok ma być pokazany jednokrotnie;
- iframe aktywnej sesji hosta pozostaje stale podłączony do DOM;
- przełączanie widoków zmienia widoczność, klasy, `pointer-events` i położenie warstwy, ale nie przenosi iframe i nie zmienia jego `src`;
- aktywny host i podzakładka są zapisywane osobno;
- PL/EN i jasny/ciemny synchronizują się bez przeładowania workspace.

## Weryfikacja

Po zmianie kodu:

- uruchom test celowany;
- uruchom `npm test`, gdy zmiana dotyczy runtime, loadera, struktury lub wspólnego kontraktu;
- sprawdź wersję w `package.json`, `config.json`, `README.md`, `changelog.md` i `version-history.json`;
- sprawdź diff i zakres zmienionych plików.

Zmiana wyłącznie dokumentacji zwykle nie wymaga podnoszenia wersji, chyba że użytkownik jawnie zleci bump.

## Prompty jednorazowe

- `docs/agent/Prompt-Bootstrap-Automation.md`
- `docs/agent/Prompt-Bootstrap-MeshCentral-Architecture.md`

Nie stosuj ich automatycznie przy każdym zadaniu.
