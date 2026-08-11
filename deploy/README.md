# CLICKI на дроплете DigitalOcean

Копия сайта и базы, работающая в Docker на обычном дроплете, **параллельно** с боевым сайтом на App Platform. Ничего из этого каталога на прод не влияет.

```
Интернет ──┬── clicki-platform.com ──→ App Platform ──→ Managed Postgres   (прод, как был)
           │
           └── IP дроплета / поддомен ─→ Docker на дроплете
                                          ├── app     (Node: API + собранный React)
                                          ├── db      (Postgres рядом, наружу закрыт)
                                          └── backup  (крон, дамп каждую ночь)
```

---

## Быстрый старт

На чистом дроплете Ubuntu 22.04/24.04 (**минимум 2 ГБ RAM**, ниже — про сборку):

```bash
ssh root@<IP>
git clone https://github.com/ayatyeah/clicki.git /opt/clicki
cd /opt/clicki/deploy
bash scripts/bootstrap-droplet.sh          # docker, swap, ufw, автообновления

cp .env.example .env && nano .env          # заполнить обязательные поля
docker compose up -d --build               # первая сборка: 3–6 минут

curl -f http://localhost/api/health         # → {"ok":true}
```

Обязательные поля в `.env`: `POSTGRES_PASSWORD`, `ADMIN_PASS`, `ADMIN_TOKEN`, `CORS_ORIGINS`.
Пароли генерируйте так: `openssl rand -base64 32`.

---

## Копия боевой базы

Скрипт **только читает** managed-базу — на App Platform это не влияет никак.

Перед запуском в панели DigitalOcean: **Databases → ваш кластер → Settings → Trusted Sources** — добавить IP дроплета, иначе соединение не установится.

```bash
cd /opt/clicki/deploy
docker compose run --rm \
  -e SRC_DB_HOST=clicki-do-user-xxxx.b.db.ondigitalocean.com \
  -e SRC_DB_USER=doadmin \
  -e SRC_DB_PASSWORD='<пароль из панели DO>' \
  -e SRC_DB_DATABASE=defaultdb \
  backup /scripts/migrate-from-app-platform.sh

docker compose restart app
```

В конце скрипт печатает сверку строк по таблицам «источник → копия». Все, кроме `media`, должны совпасть до строки. Расхождение по `media` — ожидаемое: видео не переносится (см. ниже). Нужна полная копия вместе с видео — добавьте `--with-media` в конец команды и запаситесь временем и местом на диске.

---

## Бэкапы

Контейнер `backup` держит crond и раз в сутки (по умолчанию **03:30 по Астане**) кладёт дамп в `deploy/backups/`.

**Видео в бэкап не попадает — это осознанное решение.** Единственное место в схеме, где лежат байты файлов, — таблица `media` (`BYTEA`), и туда же пишутся ролики размером до 150 МБ. Включать их в ежедневный дамп бессмысленно: копия распухает до гигабайтов, делается минутами и забивает диск дроплета. Поэтому:

| Что | Как бэкапится |
|---|---|
| 23 таблицы (креаторы, брифы, сабмишены, лиды, выплаты, настройки, аналитика) | полностью |
| `media`, файлы ≤ `BACKUP_MEDIA_MAX_MB` (аватары, логотипы, скриншоты статистики) | отдельным `*.media-small.csv.gz` |
| `media`, видео | **не бэкапится никогда** |

На реальном срезе данных разница такая: полный дамп — **39 МБ**, дамп без видео — **16 КБ** плюс 1.7 МБ медиа-файла.

Источник истины для видео — DigitalOcean Spaces (`server/src/storage.js`). Если `SPACES_*` не заполнены, видео уходит в Postgres и **нигде не резервируется**. Заполните их, если ролики на копии важны.

```bash
# посмотреть, что накопилось
ls -lh backups/

# внеплановый бэкап прямо сейчас
docker compose run --rm backup /scripts/backup.sh

# восстановиться из последнего
docker compose run --rm backup /scripts/restore.sh /backups/latest.dump

# из конкретного
docker compose run --rm backup /scripts/restore.sh /backups/clicki-20260810-0330.dump

# лог крона
docker compose exec backup tail -50 /backups/backup.log
```

Хранение: `RETENTION_DAYS` (14) для ежедневных. Дампы, снятые 1-го числа, живут `MONTHLY_RETENTION_DAYS` (365) — годовая история почти бесплатно по месту.

**Бэкап на том же диске, что и база, не спасает от гибели дроплета.** Заполните `SPACES_*` в `.env`, и копия дампа будет уезжать в бакет. Либо забирайте к себе: `scp root@<IP>:/opt/clicki/deploy/backups/latest.dump .`

Проверьте восстановление хотя бы раз, пока это учения, а не авария.

---

## Обновление кода

```bash
cd /opt/clicki/deploy && ./scripts/deploy.sh
```

Тянет git, пересобирает образ, перезапускает и ждёт `healthy`. Если приложение не поднялось — показывает логи и выходит с ошибкой.

Изменили любую `VITE_*`? Нужна **пересборка**, а не перезапуск: эти значения вшиваются в бандл на этапе сборки.

---

## Что на копии работать не будет

**Вход через TikTok, Instagram и Google.** Redirect URI у всех трёх провайдеров жёстко зарегистрированы на `https://clicki-platform.com`. Открытая по IP копия получит `redirect_uri_mismatch`. Это не поломка переноса — так устроен OAuth.

Варианты:

1. **Оставить выключенными** (по умолчанию). Пустые `TIKTOK_CLIENT_KEY` / `IG_APP_ID` / `GOOGLE_CLIENT_ID` в `.env` — сервер сам скрывает эти кнопки, остальной сайт работает целиком.
2. **Поднять поддомен.** Направить A-записью `staging.clicki-platform.com` на IP дроплета, включить HTTPS (ниже), затем добавить `https://staging.clicki-platform.com/api/auth/...` в список разрешённых redirect URI в кабинетах Meta, TikTok и Google Cloud Console. OAuth почти всегда требует именно HTTPS — по голому IP это не заработает в любом случае.

Отдельно: **вебхуки Meta** (`metaCompliance.js`) приходят на боевой домен и на копию не попадут.

---

## HTTPS (нужен для варианта 2 выше)

```bash
cp Caddyfile.example Caddyfile
nano .env          # DOMAIN=staging.clicki-platform.com   и   APP_BIND=127.0.0.1:8080
docker compose --profile tls up -d
```

Caddy сам получит сертификат Let's Encrypt. Условия: A-запись уже указывает на дроплет, порты 80/443 открыты, `APP_BIND` переставлен на `127.0.0.1` — иначе приложение займёт 80-й порт и Caddy не стартует.

В `Caddyfile.example` стоит `X-Robots-Tag: noindex` — копия не должна попасть в выдачу и тянуть трафик с боевого домена.

---

## Повседневные команды

```bash
docker compose ps                      # статус и healthcheck
docker compose logs -f app             # логи приложения
docker compose logs -f db
docker compose restart app
docker compose down                    # остановить (данные БД остаются в volume)
docker compose down -v                 # ⚠️ УДАЛИТЬ БАЗУ вместе с volume

# psql к локальной базе
docker compose exec db psql -U clicki clicki

# размер базы и таблиц
docker compose exec db psql -U clicki clicki -c "\dt+"

# место на диске
df -h /; docker system df
```

---

## Если что-то не работает

| Симптом | Причина и что делать |
|---|---|
| `docker compose build` падает с `Killed` | OOM при сборке фронтенда. `bootstrap-droplet.sh` создаёт 2 ГБ swap — проверьте `swapon --show`. На дроплете 1 ГБ соберите образ локально и загрузите через `docker save`/`docker load`. |
| app в статусе `unhealthy`, в логах `does not support SSL` | Потерялся `DB_SSL: disable`. Он задан в `docker-compose.yml` в блоке `environment` — там же и проверяйте. |
| app перезапускается, `Failed to initialize database` | БД ещё не готова либо неверный `POSTGRES_PASSWORD`. `docker compose logs db`. |
| Сайт открывается, но пустая страница | Клиент не собрался. Ищите `client/dist not found` в логах app — образ собран без стадии `client-build`. |
| Скрипт миграции: «боевая база новее локальных утилит» | Поставьте в `.env` версию, которую он назвал: `POSTGRES_IMAGE=postgres:NN-alpine`, затем `docker compose build backup db && docker compose up -d`. |
| Миграция не подключается к managed-базе | IP дроплета не добавлен в Trusted Sources кластера в панели DO. |
| Порт 80 занят | Уже запущен Caddy или другой процесс. `ss -tlnp \| grep :80`. |
| В админке пустой хеш сборки | Собирали не через `scripts/deploy.sh` — он передаёт `GIT_COMMIT`, потому что `.git` в образ не попадает. |

---

## Устройство и принятые решения

**Почему `Dockerfile` лежит в `deploy/`, а не в корне.** App Platform сканирует корень репозитория при каждом деплое. Найдя там `Dockerfile`, он перестаёт использовать buildpack и переключается на Docker-сборку — то есть боевой сайт сменил бы способ сборки на первом же push в main. Не переносите файл в корень.

**Почему параметры БД продублированы в `docker-compose.yml`.** В `.env` почти наверняка окажутся скопированные из App Platform `DB_HOST`/`DB_PASSWORD` от managed-базы. Блок `environment` в compose имеет приоритет над `env_file` и жёстко прибивает `db:5432` — что бы ни лежало в `.env`, копия физически не сможет писать в боевую базу.

**Почему SSL стал переключаемым.** Раньше `ssl: { rejectUnauthorized: false }` был зашит в трёх местах. Managed Postgres требует TLS, локальный в контейнере его не поддерживает и отвечает ошибкой на хендшейке. Теперь режим в `DB_SSL`; когда переменная не задана — поведение ровно прежнее, поэтому на App Platform менять нечего.

**Почему `DB_HOST` важнее `DATABASE_URL`.** Это выяснилось на живом прогоне, а не в теории. В `server/.env` лежит `DATABASE_URL` от боевой managed-базы — кодом он никогда не использовался, поэтому там и остался незамеченным. Файл подхватывается через `import 'dotenv/config'`. В первой версии `dbConfig.js` `DATABASE_URL` имел приоритет, и сервер, запущенный с явным `DB_HOST=127.0.0.1`, **пошёл в боевую базу**. Теперь `DATABASE_URL` используется только когда `DB_HOST` пуст, а если заданы оба — в лог падает предупреждение. Строка `[db] target: …` в начале лога всегда показывает фактический адрес: одного взгляда хватает, чтобы отличить копию от прода.

Отдельно проверьте, что `server/.env` не уехал на дроплет — в образ он не попадает (`.dockerignore`), но `git clone` его и не принесёт, так как файл в `.gitignore`.

**Почему порт Postgres не опубликован.** Опубликованный контейнерный порт обходит `ufw` — открытый наружу 5432 нашли бы сканеры за часы. Доступ к базе только через `docker compose exec` или SSH-туннель.

**Состояние.** Приложение stateless: всё в Postgres, на диск пишется только `os.tmpdir()` (кэш медиа). Поэтому монолит в одном контейнере, без volume'ов, перезапускается без последствий.

**Что переживает пересоздание контейнеров:** данные БД (volume `pgdata`), бэкапы (`deploy/backups/`), сертификаты Caddy (volume `caddy_data`).
