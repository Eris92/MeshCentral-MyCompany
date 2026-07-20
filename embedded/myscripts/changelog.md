# Changelog

## 2.0.21 — 2026-07-20

- Ustabilizowano kolejność paska: zwijanie, ulubione, link, ustawienia, wyszukiwanie i pole Search.
- Katalogi i wszystkie podkatalogi mają identyczną szerokość; wcięcie podkatalogu nie zwęża już niebieskich przycisków.
- Przywrócono stałe odstępy między kolejnymi skryptami.
- Deep link `?viewmode=101&script=...` automatycznie otwiera ten sam formularz lub uruchamia tę samą akcję co ręczne kliknięcie skryptu.
- Ostatnio wybrany skrypt i jego wynik są zapamiętywane oddzielnie dla każdego katalogu głównego, więc wynik Defender nie przechodzi do Jira ani innych sekcji.
- Interfejs My Jira został osadzony w katalogu `Jira` w My Scripts; zachowano Support, CMDB i akcje na hostach.
- Samodzielne pozycje menu My Jira są ukrywane po poprawnym osadzeniu, ale backend My Jira pozostaje wykorzystywany.
- Zachowano istniejące funkcje: raporty, Results/View, Defender, Automation, Monitoring, ulubione, linki, edycję i uprawnienia folderów.

## 2.0.20 — 2026-07-20

- Przebudowano widok Scripts zgodnie z czystym układem trzech kolumn: stała szerokość niebieskich przycisków, a dodatkowe akcje przesuwają wyłącznie prawy separator.
- Widok `Favorites` jest zapamiętywany w `localStorage` razem ze stanem zwinięcia lewego menu, widocznością wyszukiwarki i ostatnio wybranym katalogiem.
- Zachowano wszystkie istniejące przyciski i funkcje, w tym Link, Settings/Edit, raporty, Results/View, Defender, Automation i Monitoring.
- `Script folder permissions` pobiera i scala grupy użytkowników bezpośrednio z dostępnych kolekcji MeshCentral, deduplikuje je po ID i pozwala przypisać wiele grup do każdego katalogu.
- Poprawiono układ listy grup w Settings i dodano czytelny komunikat, gdy MeshCentral nie zwróci żadnych grup.

## 2.0.19 — 2026-07-20

- Przywrócono z przesłanej wersji folder `Raporty` oraz raporty Active Directory.
- Zakładka `Results` ponownie ma niebieski przycisk `View` do podglądu pełnego wyniku raportu.
- Podgląd obsługuje wyniki tabelaryczne JSON (`meshTable`), zwykły tekst oraz rozwijany surowy output.
- Zachowano postęp akceptacji, filtrowanie, paginację i skracanie długiego wyniku w tabeli.
- Moduł raportów jest ładowany po pozostałych rozszerzeniach, aby późniejsze poprawki UI nie usuwały przycisku `View`.

## 2.0.18 — 2026-07-20

- Dodano folder Defender z raportami Incidents, Advanced Hunting, Email Explorer i Tenant Allow/Block List.
- Sekcja Entra credentials jest prezentowana jako `Microsoft Defender / Graph`.

## 2.0.5 — 2026-07-19

- Pole wyszukiwania pojawia się bezpośrednio po ostatnim przycisku paska i nie przesuwa zawartości w dół.
- Wszystkie przyciski paska, w tym ustawienia/edycja, mają identyczny rozmiar, obramowanie i odstępy.
- Link `?viewmode=101&script=...` otwiera właściwy katalog, zaznacza wskazany skrypt i rozwija jego katalogi bez uruchamiania skryptu.
- Przyciski edycji i linku są dodawane na końcu wiersza bez zmiany szerokości niebieskiego przycisku skryptu.
- Ustawiono identyczny odstęp 12 px po obu stronach pionowych separatorów.
- Przycisk `View` w Results ponownie używa koloru niebieskiego.
- Gwiazdka ulubionych ma stały rozmiar i kształt; aktywny stan jest oznaczony kolorem złotym.

## 2.0.4 — 2026-07-19

- Wyszukiwarka otwiera się jako pole pływające i nie przesuwa menu ani listy skryptów w dół.
- Ujednolicono rozmiar i wygląd zakładek `Scripts`, `Results` oraz `Settings`.
- Tryb edycji i tryb linków poszerzają kolumnę skryptów, zamiast zawijać nazwy.
- Wyrównano odstępy po obu stronach pionowych separatorów między menu, listą skryptów i wynikiem.
- Przycisk linków działa analogicznie do edycji: pokazuje osobny przycisk linku przy każdym skrypcie.
- Przywrócono kolory statusów i oznaczenia wierszy w zakładce Results.
- Folder `Automation` pokazuje tabelę lokalnych zadań z dodawaniem, edycją, usuwaniem oraz włączaniem i wyłączaniem zadań Windows Task Scheduler.
- Folder `Monitoring` pokazuje listę Zabbix Maintenance; konfigurację Zabbix API przeniesiono do zakładki Settings.

## 2.0.0 — 2026-07-19

- Dodano ulubione skrypty, deep linki i linki z wartościami zmiennych możliwe do zapisania jako zakładka przeglądarki.
- Dodano panel `Manage` dla Site Admin z edycją dyrektyw skryptu, poświadczeń, automatyzacji i monitoringu.
- Dodano edycję poziomów akceptacji oraz wszystkich wspieranych typów zmiennych i `SaveSecret` bez ręcznego otwierania pliku.
- Zakładka Results pokazuje postęp akceptacji, np. `0/3`, renderuje JSON/CSV jako tabelę i zachowuje rozwijany Debug z surowym wynikiem.
- Dodano automatyzacje oparte na Windows Task Scheduler z bezpiecznym runnerem, logami i walidacją ścieżek.
- Dodano konfigurację Zabbix i obsługę Maintenance: lista, tworzenie i usuwanie.
- Ujednolicono wygląd menu i przypisywania uprawnień, dodano tooltipy oraz ukrywanie pustych katalogów podczas filtrowania.
- Przycisk edycji poświadczeń jest widoczny wyłącznie dla Site Admin; kontrola jest wykonywana również w backendzie.
- Usunięto z repozytorium pliki runtime zawierające poświadczenia, sekrety skryptów i przypisania katalogów.
- Dodano testy statyczne, kontrolę spójności wersji i workflow GitHub Actions.

## 1.9.0 — 2026-07-18

- Dostęp do pluginu wynika wyłącznie z uprawnień do katalogów skryptów; osobna sekcja `Plugin permissions` została usunięta.
- Do każdego katalogu można przypisać wiele grup użytkowników. Użytkownik należący do dowolnej przypisanej grupy otrzymuje dostęp.

## 1.8.3 — 2026-07-18

- Skrócono placeholder wyszukiwarki do `Search`, aby mieścił się w menu w trybie Classic i Modern.

## 1.8.2 — 2026-07-17

- Dodano dyrektywy `# Approval_1: true`, `# Approval_2: true` i `# Approval_3: true`.
- Skrypt przekazuje do Approval Center dokładną listę wymaganych poziomów; `# Approval: true` pozostaje aliasem poziomu 1.

## 1.7.6 — 2026-07-17

- Dodano globalne wyszukiwanie skryptów po nazwie pliku, nazwie wyświetlanej z komentarza i opisie.
- Pasujące zagnieżdżone katalogi są automatycznie rozwijane, a wyszukiwanie ignoruje wielkość liter i polskie znaki.

## 1.7.5 — 2026-07-17

- Pole `Tylko aktywni użytkownicy` przeniesiono do pierwszego kroku kreatora `Protokół`.
- Wartość wybrana w pierwszym kroku jest zachowywana i przekazywana do skryptu.
- Błąd pobierania użytkowników MeshCentral nie jest już wyświetlany jako wartość pola `Osoba z IT`.

## 1.7.4 — 2026-07-17

- Pole `Osoba z IT` pobiera użytkowników bezpośrednio z MeshCentral.
- Aktualnie zalogowany użytkownik jest wybierany domyślnie, ale można wskazać inną osobę z listy.
- Lista użytkowników MeshCentral jest oddzielona od listy użytkowników Jira.

## 1.7.3 — 2026-07-17

- Zmniejszono nagłówek pola wyboru sprzętu do rozmiaru zwykłej etykiety formularza.

## 1.7.2 — 2026-07-17

- Przeniesiono przycisk `Back` do natywnej stopki kreatora i ustawiono kolejność Anuluj, Back, Generate report.

## 1.7.1 — 2026-07-17

- Jira Assets automatycznie obsługuje zarówno zwykłe API tokens, jak i API tokens with scopes.
- Po odpowiedzi 401 z adresu witryny plugin ponawia pobieranie workspace przez `api.atlassian.com/ex/jira/{cloudId}`.
- Komunikat błędu rozróżnia problem tokena, scopes i uprawnień Jira Assets.

## 1.7.0 — 2026-07-17

- Przywrócono dwuetapowy kreator skryptów z `VariableUser` i `VariableAsset`.
- Pierwszy krok pozwala wyszukać użytkownika w `settings/users_list.json`; drugi pobiera z Jira przypisane urządzenia i pozwala wybrać jedno lub więcej.
- Pobieranie urządzeń korzysta z poświadczeń Jira chronionych przez DPAPI w My Scripts i nie wymaga starych plików XML DirectoryTools.
- Dodano osobne, autoryzowane endpointy `user-choices` i `jira-assets` oraz czytelne stany ładowania i błędów.

## 1.6.3 — 2026-07-17

- W sekcji `AD credentials` dodano osobne pole `AD domain`.
- Domena jest przekazywana skryptom jako `MYSCRIPTS_AD_DOMAIN`.
- Raport użytkowników AD przekazuje zapisane `AD domain`, login i hasło do `Get-ADUser`; fallback LDAP również łączy się z jawnie wskazaną domeną.

## 1.6.2 — 2026-07-17

- Zapytanie o incydenty Microsoft Graph używa literalnych parametrów OData `$expand` i `$top`, zgodnie z działającą implementacją Defender.
- Po odpowiedzi HTTP 400 skrypt automatycznie ponawia pobieranie bez `$expand`, a następnie bez parametrów zapytania.

## 1.6.1 — 2026-07-17
