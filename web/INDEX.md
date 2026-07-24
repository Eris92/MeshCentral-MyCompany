# Admin panel index

Panel administracyjny jest odrębną warstwą od standalone Portalu i native UI.

## Entry pointy

```text
admin.js
views/SIRK-Portal.handlebars
web/admin/admin.js
web/admin/admin.css
web/admin/admin-layout.js
```

## Funkcje panelu

| Obszar | Plik |
|---|---|
| layout i nawigacja | `admin-layout.js` |
| approval policy | `admin-approval-policy.js` |
| marketplace | `admin-marketplace.js` |
| przenoszenie urządzeń | `admin-move-mesh-levels.js` |
| aktualizacje pluginów | `admin-plugin-updates.js` |
| ustawienia Portalu | `admin-portal.js` |
| usprawnienia UI | `admin-ui-enhancements.js`, `admin-ui-enhancements.css` |

Przed zmianą assetu potwierdź jego mapowanie w root `admin.js`. Nie przenoś kodu panelu do `public/`.
