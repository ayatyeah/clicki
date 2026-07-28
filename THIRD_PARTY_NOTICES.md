# Third-party notices

Материалы третьих лиц, входящие в состав CLICKI или загружаемые продуктом во
время работы. Файл поддерживается вручную — при добавлении любого шрифта,
шрифтоподобного набора глифов, иконочного набора или графики его нужно дополнить.

Файл не покрывает npm-зависимости: их лицензии живут в `node_modules/*/LICENSE`
и разворачиваются командой `npx license-checker --summary`.

---

## Шрифты

### Roboto (встроен в продукт)

- **Где:** `client/src/lib/fonts/robotoFont.js` — сабсет Regular + Bold в base64.
- **Версия:** 3.015
- **Правообладатель:** Copyright 2011 The Roboto Project Authors
  (https://github.com/googlefonts/roboto-classic)
- **Лицензия:** SIL Open Font License 1.1 — полный текст в
  `client/src/lib/fonts/OFL.txt`, также https://openfontlicense.org
- **Зачем:** встроенные шрифты jsPDF покрывают только Latin/WinAnsi, кириллица в
  выгружаемых PDF рассыпается. `client/src/lib/exportPdf.js` регистрирует Roboto
  в каждом документе.
- **Условия соблюдены:**
  - Коммерческое использование — разрешено.
  - Сабсеттинг и модификация — разрешены; Reserved Font Name у Roboto не
    объявлено, переименование сабсета не требуется.
  - Встраивание в генерируемые PDF — разрешено прямо (OFL 1.1 §5); сам PDF под
    OFL не попадает.
  - Уведомление о копирайте и лицензия сопровождают каждую копию (OFL 1.1 §2) —
    через human-readable заголовок в `robotoFont.js` и stand-alone `OFL.txt`.
  - Шрифт не продаётся отдельно (OFL 1.1 §1).

### Geist, Inter, JetBrains Mono, Oswald, Unbounded, Poppins (загружаются с CDN)

- **Где:** `client/index.html`, тег `<link>` на `fonts.googleapis.com/css2`;
  используются через CSS-переменные `--font`, `--font-display`, `--font-mono`
  в `client/src/styles/index.css`.
- **Лицензия:** все шесть — SIL Open Font License 1.1.
- **Статус:** файлы шрифтов отдаются серверами Google, в состав продукта не
  входят и нами не распространяются, поэтому требование OFL §2 о приложении
  уведомления к копии здесь не возникает.
- **Персональные данные:** загрузка страницы передаёт IP-адрес посетителя и
  стандартные заголовки браузера в Google. Это раскрыто в политике
  конфиденциальности (`client/src/pages/Privacy.jsx`, раздел «Передача третьим
  лицам»). При переходе на self-hosting (`@fontsource/*`) поток исчезает, но
  появляется обязанность приложить OFL к каждому из шести шрифтов — см.
  «Открытые вопросы» ниже.

### Системные шрифты в CSS-стеках

`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `SFMono-Regular`,
`Menlo`, `ui-sans-serif`, `ui-monospace` — указаны как fallback в
`client/src/styles/index.css` и `app-light.css`. Это обращение к копии,
установленной на устройстве пользователя; распространения нет, лицензионных
обязательств не возникает.

### Стандартные шрифты PDF в jsPDF

Helvetica / Times / Courier — в PDF записываются только имена шрифтов из
стандартной четырнадцатки, глифы подставляет просмотрщик. Таблицы метрик,
входящие в jsPDF, распространяются под лицензией самого jsPDF (MIT).

---

## Графика

### Twemoji (загружается с CDN)

- **Где:** `client/src/lib/emoji.js` — спрайты из пакета
  `emoji-datasource-twitter@15.1.2`, отдаются через jsDelivr; домен разрешён в
  `imgSrc` CSP (`server/src/security.js`).
- **Правообладатель:** Copyright Twitter, Inc. и участники проекта.
- **Лицензия графики:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Код пакета — MIT.
- **Атрибуция:** выводится в футере сайта (`client/src/components/Footer.jsx`,
  `.site-footer__attrib`). CC BY 4.0 требует видимого указания авторства —
  скрывать этот блок нельзя.
- **Апстрим:** https://github.com/jdecked/twemoji

---

## Изъято из продукта

### Apple Color Emoji / `emoji-datasource-apple`

Использовалось в `client/src/lib/appleEmoji.js` до этой правки. PNG в этом пакете
— глифы, извлечённые из шрифта Apple Color Emoji: авторские права принадлежат
Apple, лицензия macOS/iOS разрешает использование только на оборудовании Apple,
права на распространение третьим лицам не предоставляются. MIT-лицензия
npm-пакета покрывает его код и метаданные, но не изображения Apple.

Заменено на Twemoji. Возвращать `emoji-datasource-apple` нельзя.
`emoji-datasource-facebook` (графика Meta) — тоже проприетарный, не подходит.
Свободные наборы с идентичной структурой путей: `-twitter` (CC BY 4.0, выбран),
`-google` (Noto Color Emoji, OFL 1.1).

---

## Открытые вопросы

1. **Self-hosting Google Fonts.** Убирает передачу IP посетителей в Google и два
   домена из CSP, ускоряет первую отрисовку. Взамен: шрифты начинают
   распространяться в составе продукта, и к каждому из шести нужно приложить
   OFL, дополнив этот файл. Решение продуктовое, не техническое.
2. **Изображения Unsplash** (`images.unsplash.com` в `imgSrc` CSP) — в этом
   аудите не разбирались. Unsplash License разрешает коммерческое использование,
   но hotlink чужого CDN на проде стоит проверить отдельно.
