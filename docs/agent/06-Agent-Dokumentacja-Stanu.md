# Documentation and state records

## Cel

Dokumentacja opisuje potwierdzony stan, sposób użycia i istotne decyzje. Nie zastępuje weryfikacji.

## Indeksy

Każda nowa dokumentacja musi być osiągalna z `docs/INDEX.md` albo z lokalnego `INDEX.md` właściwej warstwy.

Aktualizując strukturę, entrypoint, loader lub odpowiedzialność pliku:

1. zaktualizuj właściwy indeks warstwy;
2. zaktualizuj `docs/REPOSITORY-LAYOUT.md`, jeżeli zmieniła się architektura;
3. zaktualizuj `docs/PROJECT-STATE.md`, jeżeli zmienił się stan projektu;
4. nie duplikuj pełnej treści między indeksami.

Indeks ma kierować do najmniejszego potrzebnego zakresu, a nie zawierać kopię całego repozytorium.

## Kiedy aktualizować

Aktualizuj dokumentację po zmianie zachowania, konfiguracji, build/test/release, architektury, kompatybilności albo ograniczeń.

## Potwierdzony stan

Dla informacji zależnych od środowiska zapisuj źródło, wersję, datę i status `verified`, `unverified`, `obsolete` albo `unknown`, gdy ma to znaczenie.

Nie przedstawiaj przypuszczeń jako faktów.

## Sekrety

Nie zapisuj haseł, tokenów, kluczy, cookies, danych sesji ani pełnych connection strings. Przykłady używają placeholderów.

## Kontrola jakości

Po zmianie sprawdź:

- linki i nazwy plików;
- ścieżki i komendy;
- wersje;
- zgodność indeksów z aktualnym layoutem;
- brak odwołań do usuniętych nazw i migracji;
- brak duplikowania dużych fragmentów kodu.
