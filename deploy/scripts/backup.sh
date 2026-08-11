#!/bin/sh
# CLICKI — ежедневный дамп Postgres.
#
# ГЛАВНОЕ РЕШЕНИЕ ЭТОГО СКРИПТА: таблица `media` (BYTEA) — единственное место в
# схеме, где лежат байты файлов, и именно там живут загруженные видео (до 150 МБ
# каждое). Класть их в ежедневный дамп бессмысленно: бэкап распухает до гигабайт,
# делается минутами и забивает диск дроплета. Поэтому:
#
#   • основной дамп идёт с --exclude-table-data=media  → схема таблицы есть,
#     строк нет. Все остальные 23 таблицы (креаторы, брифы, сабмишены, лиды,
#     выплаты, настройки…) выгружаются полностью;
#   • маленькие файлы из media (аватары, логотипы, скриншоты статистики —
#     до BACKUP_MEDIA_MAX_MB) выгружаются отдельным CSV.gz через base64.
#     Видео туда не попадает по размеру. BACKUP_MEDIA_MAX_MB=0 отключает совсем.
#
# Итог: ежедневный бэкап — единицы мегабайт, восстанавливается за секунды, а
# видео (которое всё равно должно жить в DigitalOcean Spaces, см. storage.js)
# сознательно не резервируется.
#
# Запускается из контейнера `backup` по крону (см. entrypoint-backup.sh),
# либо руками:  docker compose run --rm backup /scripts/backup.sh

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MONTHLY_RETENTION_DAYS="${MONTHLY_RETENTION_DAYS:-365}"
BACKUP_MEDIA_MAX_MB="${BACKUP_MEDIA_MAX_MB:-5}"
NOTIFY_ON_SUCCESS="${NOTIFY_ON_SUCCESS:-0}"

TS="$(date +%Y%m%d-%H%M)"
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
WORK="$(mktemp -d)"
DUMP="$WORK/clicki-$TS.dump"
MEDIA="$WORK/clicki-$TS.media-small.csv.gz"

log() { echo "[backup $(date '+%H:%M:%S')] $*"; }

# Телеграм-алерты используют тот же бот, что и ops-уведомления приложения
# (server/src/notify.js) — отдельный канал заводить не нужно.
notify() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  curl -s -m 15 -o /dev/null \
    --data-urlencode "text=$1" \
    --data "chat_id=${TELEGRAM_CHAT_ID}" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" || true
}

fail() {
  log "ОШИБКА: $1"
  notify "🔴 CLICKI backup ($STAMP) упал: $1"
  rm -rf "$WORK"
  exit 1
}

command -v pg_dump >/dev/null || fail "pg_dump не найден в образе"
mkdir -p "$BACKUP_DIR" || fail "нет доступа к $BACKUP_DIR"

# Ждём БД: контейнер бэкапа может стартовать раньше, чем Postgres примет соединения.
i=0
until pg_isready -q 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -gt 30 ] && fail "БД не отвечает (pg_isready, 60 с)"
  sleep 2
done

# ---- 1. Основной дамп: всё, кроме содержимого media ----
log "дамп схемы + данных (без media)…"
pg_dump --format=custom --compress=9 --no-owner --no-acl \
        --exclude-table-data=media \
        --file="$DUMP" || fail "pg_dump вернул ошибку"

# Проверяем, что файл читается: битый дамп, о котором узнаёшь в день аварии, —
# это отсутствие бэкапа, а не бэкап.
pg_restore --list "$DUMP" >/dev/null 2>&1 || fail "дамп не читается (pg_restore --list)"

# ---- 2. Мелкие файлы из media (без видео) ----
if [ "$BACKUP_MEDIA_MAX_MB" -gt 0 ] 2>/dev/null; then
  MAX_BYTES=$((BACKUP_MEDIA_MAX_MB * 1024 * 1024))
  log "выгрузка media размером до ${BACKUP_MEDIA_MAX_MB} МБ (видео пропускается)…"
  psql -v ON_ERROR_STOP=1 -q -c "\
\copy (SELECT id, mime, created_at, replace(encode(data,'base64'), E'\n', '') AS data_b64 \
       FROM media WHERE octet_length(data) <= $MAX_BYTES ORDER BY id) \
TO STDOUT WITH (FORMAT csv, HEADER)" 2>/dev/null | gzip -9 > "$MEDIA" \
    || { log "предупреждение: не удалось выгрузить media (таблицы ещё нет?) — пропускаю"; rm -f "$MEDIA"; }
fi

# ---- 3. Переносим в постоянный каталог ----
mv "$DUMP" "$BACKUP_DIR/" || fail "не удалось перенести дамп в $BACKUP_DIR"
[ -f "$MEDIA" ] && mv "$MEDIA" "$BACKUP_DIR/"
( cd "$BACKUP_DIR" && sha256sum "clicki-$TS.dump" > "clicki-$TS.dump.sha256" )
ln -sf "clicki-$TS.dump" "$BACKUP_DIR/latest.dump"
[ -f "$BACKUP_DIR/clicki-$TS.media-small.csv.gz" ] \
  && ln -sf "clicki-$TS.media-small.csv.gz" "$BACKUP_DIR/latest.media-small.csv.gz"

SIZE="$(du -h "$BACKUP_DIR/clicki-$TS.dump" | cut -f1)"
log "готово: clicki-$TS.dump ($SIZE)"

# ---- 4. Ротация ----
# Дневные — RETENTION_DAYS. Дампы, снятые 1-го числа (clicki-??????01-*),
# считаются «месячными» и живут дольше: годовая история за копейки места.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'clicki-*' ! -name 'clicki-??????01-*' \
     -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'clicki-??????01-*' \
     -mtime "+$MONTHLY_RETENTION_DAYS" -delete 2>/dev/null || true

# ---- 5. Копия вне дроплета (необязательно) ----
# Бэкап, лежащий на том же диске, что и БД, не спасает от гибели дроплета.
# Если заданы SPACES_*, отправляем туда же, где живёт медиа.
if [ -n "${SPACES_BUCKET:-}" ] && [ -n "${SPACES_KEY:-}" ] && command -v aws >/dev/null 2>&1; then
  log "выгрузка копии в Spaces…"
  AWS_ACCESS_KEY_ID="$SPACES_KEY" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET" \
  aws s3 cp "$BACKUP_DIR/clicki-$TS.dump" \
      "s3://$SPACES_BUCKET/${SPACES_BACKUP_PREFIX:-db-backups}/clicki-$TS.dump" \
      --endpoint-url "${SPACES_ENDPOINT:-https://${SPACES_REGION:-fra1}.digitaloceanspaces.com}" \
      >/dev/null 2>&1 || log "предупреждение: выгрузка в Spaces не удалась (локальная копия на месте)"
fi

COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name 'clicki-*.dump' | wc -l | tr -d ' ')"
[ "$NOTIFY_ON_SUCCESS" = "1" ] && notify "✅ CLICKI backup ($STAMP): $SIZE, всего копий: $COUNT"

rm -rf "$WORK"
exit 0
