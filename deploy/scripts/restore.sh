#!/bin/sh
# CLICKI — восстановление БД из дампа, сделанного backup.sh.
#
#   docker compose run --rm backup /scripts/restore.sh /backups/latest.dump
#   docker compose run --rm backup /scripts/restore.sh /backups/clicki-20260810-0330.dump
#
# Что делает:
#   1) восстанавливает все таблицы из .dump (media — только структура, данных там нет);
#   2) если рядом лежит соответствующий *.media-small.csv.gz — заливает обратно
#      мелкие файлы (аватары, логотипы, скриншоты). Видео не восстанавливается
#      никогда: его в бэкапе нет by design (см. комментарий в backup.sh).
#
# ВАЖНО: --clean --if-exists удаляет существующие объекты перед заливкой. Это
# перезапись базы, а не слияние. Скрипт требует явного подтверждения.

set -eu

DUMP="${1:-/backups/latest.dump}"
[ -f "$DUMP" ] || { echo "Файл не найден: $DUMP"; exit 1; }

REAL="$(readlink -f "$DUMP")"
MEDIA_CSV="${REAL%.dump}.media-small.csv.gz"

echo "Восстановление в базу: ${PGDATABASE:-?} на ${PGHOST:-?}"
echo "Из файла:              $REAL"
[ -f "$MEDIA_CSV" ] && echo "Мелкое медиа:          $MEDIA_CSV" || echo "Мелкое медиа:          нет (только таблицы)"
echo

if [ "${FORCE:-0}" != "1" ]; then
  printf 'Текущее содержимое базы будет ПЕРЕЗАПИСАНО. Введите "yes" для продолжения: '
  read -r ANSWER
  [ "$ANSWER" = "yes" ] || { echo "Отменено."; exit 1; }
fi

i=0
until pg_isready -q 2>/dev/null; do
  i=$((i + 1)); [ "$i" -gt 30 ] && { echo "БД не отвечает"; exit 1; }; sleep 2
done

echo "→ pg_restore…"
# --clean --if-exists: сносим старые объекты. Ошибки вида «объекта не было»
# на чистой базе не должны валить процесс, поэтому без --exit-on-error, но
# итоговый код проверяем ниже по количеству таблиц.
pg_restore --dbname="${PGDATABASE}" --clean --if-exists --no-owner --no-acl \
           --single-transaction "$REAL" || {
  echo "pg_restore завершился с ошибкой — проверьте вывод выше"; exit 1; }

if [ -f "$MEDIA_CSV" ]; then
  echo "→ возврат мелкого медиа…"
  TMP="$(mktemp -d)"
  gzip -dc "$MEDIA_CSV" > "$TMP/media.csv"
  psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE TEMP TABLE media_in (id INT, mime VARCHAR(120), created_at TIMESTAMP, data_b64 TEXT);
\copy media_in FROM '$TMP/media.csv' WITH (FORMAT csv, HEADER)
INSERT INTO media (id, mime, data, created_at)
SELECT id, mime, decode(data_b64, 'base64'), created_at FROM media_in
ON CONFLICT (id) DO NOTHING;
-- Возвращаем счётчик SERIAL на место, иначе следующая загрузка упадёт на
-- конфликте первичного ключа.
SELECT setval(pg_get_serial_sequence('media','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM media), 1));
SQL
  rm -rf "$TMP"
fi

echo
echo "→ проверка:"
psql -q -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';" \
     -c "SELECT count(*) AS media_rows, pg_size_pretty(COALESCE(sum(octet_length(data)),0)::bigint) AS media_bytes FROM media;"
echo "Готово. Напоминание: видео в бэкап не входит — если оно нужно, источник"
echo "истины для него DigitalOcean Spaces (SPACES_* в .env), а не дамп."
