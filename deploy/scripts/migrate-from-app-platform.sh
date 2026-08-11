#!/bin/sh
# CLICKI — перенос боевой БД (DigitalOcean Managed Postgres, которую использует
# App Platform) в локальный Postgres на дроплете.
#
#   docker compose run --rm \
#     -e SRC_DB_HOST=... -e SRC_DB_PASSWORD=... \
#     backup /scripts/migrate-from-app-platform.sh
#
# Скрипт ТОЛЬКО ЧИТАЕТ боевую базу (pg_dump). Ни одной записывающей команды к
# источнику здесь нет — App Platform продолжает работать как ни в чём не бывало.
#
# Что именно переносится:
#   • полностью — все таблицы схемы (креаторы, брифы, сабмишены, лиды, выплаты,
#     настройки, тарифы, сессии админа, аналитика посещений …);
#   • из media — только файлы до SRC_MEDIA_MAX_MB (по умолчанию 5 МБ): аватары,
#     логотипы, скриншоты статистики. Видео (до 150 МБ на файл) сознательно НЕ
#     переносится: гонять десятки гигабайт ради копии сайта незачем, а на
#     проде оно и так должно жить в Spaces (server/src/storage.js).
#     Нужна полная копия вместе с видео — запустите с --with-media.

set -eu

WITH_MEDIA=0
[ "${1:-}" = "--with-media" ] && WITH_MEDIA=1

SRC_DB_HOST="${SRC_DB_HOST:?укажите SRC_DB_HOST — хост managed Postgres из панели DO}"
SRC_DB_PORT="${SRC_DB_PORT:-25060}"
SRC_DB_USER="${SRC_DB_USER:-doadmin}"
SRC_DB_PASSWORD="${SRC_DB_PASSWORD:?укажите SRC_DB_PASSWORD}"
SRC_DB_DATABASE="${SRC_DB_DATABASE:-defaultdb}"
SRC_MEDIA_MAX_MB="${SRC_MEDIA_MAX_MB:-5}"

WORK="$(mktemp -d)"
DUMP="$WORK/source.dump"
MEDIA_CSV="$WORK/source-media.csv"

# Managed Postgres в DO принимает только TLS-соединения.
SRC="postgresql://${SRC_DB_USER}:${SRC_DB_PASSWORD}@${SRC_DB_HOST}:${SRC_DB_PORT}/${SRC_DB_DATABASE}?sslmode=require"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "════════════════════════════════════════════════════════"
echo " Источник:  ${SRC_DB_HOST}:${SRC_DB_PORT}/${SRC_DB_DATABASE}  (только чтение)"
echo " Приёмник:  ${PGHOST:-db}:${PGPORT:-5432}/${PGDATABASE:-clicki}"
echo " Видео:     $([ "$WITH_MEDIA" = 1 ] && echo 'переносится (--with-media)' || echo "не переносится, только файлы до ${SRC_MEDIA_MAX_MB} МБ")"
echo "════════════════════════════════════════════════════════"
echo

# ---- 0. Проверка версий ----
# pg_dump отказывается работать с сервером НОВЕЕ себя. Ошибка выглядит невнятно,
# поэтому ловим её заранее и говорим, что конкретно поменять.
SRV="$(psql "$SRC" -tAc 'SHOW server_version;' 2>/dev/null | cut -d. -f1)" \
  || { echo "Не удалось подключиться к боевой БД. Проверьте SRC_DB_* и Trusted Sources в панели DO (IP дроплета должен быть разрешён)."; exit 1; }
CLI="$(pg_dump --version | sed 's/[^0-9]*\([0-9]*\).*/\1/')"
echo "Postgres источника: $SRV, локальные утилиты: $CLI"
if [ "$SRV" -gt "$CLI" ] 2>/dev/null; then
  echo
  echo "ОШИБКА: боевая база новее локальных утилит."
  echo "Поправьте в deploy/.env:  POSTGRES_IMAGE=postgres:${SRV}-alpine"
  echo "затем: docker compose build backup db && docker compose up -d"
  exit 1
fi

# ---- 1. Дамп таблиц ----
echo "→ читаю боевую базу (media без данных)…"
pg_dump "$SRC" --format=custom --compress=9 --no-owner --no-acl \
        --exclude-table-data=media --file="$DUMP"
pg_restore --list "$DUMP" >/dev/null || { echo "Дамп повреждён"; exit 1; }
echo "  дамп: $(du -h "$DUMP" | cut -f1)"

# ---- 2. Мелкое медиа ----
if [ "$WITH_MEDIA" = 1 ]; then
  echo "→ читаю ВСЮ таблицу media, включая видео (это надолго)…"
  FILTER="TRUE"
else
  echo "→ читаю media без видео (файлы до ${SRC_MEDIA_MAX_MB} МБ)…"
  FILTER="octet_length(data) <= $((SRC_MEDIA_MAX_MB * 1024 * 1024))"
fi
psql "$SRC" -v ON_ERROR_STOP=1 -q -c "\
\copy (SELECT id, mime, created_at, replace(encode(data,'base64'), E'\n', '') AS data_b64 \
       FROM media WHERE $FILTER ORDER BY id) TO '$MEDIA_CSV' WITH (FORMAT csv, HEADER)"
echo "  медиа: $(du -h "$MEDIA_CSV" | cut -f1)"

# ---- 3. Заливка в локальную базу ----
i=0
until pg_isready -q 2>/dev/null; do
  i=$((i + 1)); [ "$i" -gt 30 ] && { echo "Локальная БД не отвечает"; exit 1; }; sleep 2
done

echo "→ заливаю в локальную базу (существующее содержимое будет заменено)…"
if [ "${FORCE:-0}" != "1" ]; then
  printf '  Продолжить? Введите "yes": '
  read -r A; [ "$A" = "yes" ] || { echo "Отменено."; exit 1; }
fi

pg_restore --dbname="${PGDATABASE:-clicki}" --clean --if-exists --no-owner --no-acl \
           --single-transaction "$DUMP"

echo "→ возвращаю медиа…"
psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE TEMP TABLE media_in (id INT, mime VARCHAR(120), created_at TIMESTAMP, data_b64 TEXT);
\copy media_in FROM '$MEDIA_CSV' WITH (FORMAT csv, HEADER)
INSERT INTO media (id, mime, data, created_at)
SELECT id, mime, decode(data_b64,'base64'), created_at FROM media_in
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('media','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM media), 1));
SQL

# ---- 4. Сверка ----
echo
echo "→ сверка строк (источник → копия):"
for T in creators briefs submissions assignments leads payouts media visits; do
  A="$(psql "$SRC" -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo '—')"
  B="$(psql -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo '—')"
  MARK=$([ "$A" = "$B" ] && echo '✓' || echo '≠')
  printf '   %-14s %8s → %-8s %s\n' "$T" "$A" "$B" "$MARK"
done
echo
echo "Расхождение по media — это норма: видео намеренно не переносилось."
echo "Остальные таблицы должны совпадать до строки."
echo
echo "Дальше: docker compose restart app && docker compose logs -f app"
