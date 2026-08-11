#!/bin/sh
# Точка входа контейнера бэкапов: ставит расписание в crond и остаётся жить.
#
# Почему crond, а не `while sleep 86400`: цикл со sleep уезжает по времени после
# каждого рестарта контейнера и не понимает «в 03:30 по Астане». crond из busybox
# уже есть в alpine-образе Postgres и делает ровно то, что нужно.
#
# Расписание задаётся BACKUP_CRON (формат обычного crontab), по умолчанию
# ежедневно в 03:30 — ночь по местному времени, минимум трафика на сайте.

set -eu

BACKUP_CRON="${BACKUP_CRON:-30 3 * * *}"

# Если контейнеру передали команду (docker compose run --rm backup /scripts/…),
# выполняем её вместо крона — так удобно гонять бэкап/восстановление руками.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "[backup] расписание: $BACKUP_CRON (TZ=${TZ:-UTC})"
echo "[backup] каталог:    ${BACKUP_DIR:-/backups}"
echo "[backup] хранение:   ${RETENTION_DAYS:-14} дн. (дампы от 1-го числа — ${MONTHLY_RETENTION_DAYS:-365} дн.)"
echo "[backup] медиа:      файлы до ${BACKUP_MEDIA_MAX_MB:-5} МБ (видео в бэкап не входит)"

mkdir -p "${BACKUP_DIR:-/backups}" /etc/crontabs

# crond запускается с пустым окружением, поэтому переменные подключения к БД
# нужно сохранить в файл и подгружать в самой crontab-строке.
env | grep -E '^(PG|BACKUP_|RETENTION|MONTHLY_|TELEGRAM_|SPACES_|NOTIFY_|TZ)' \
    | sed 's/^/export /; s/=/="/; s/$/"/' > /etc/backup.env
chmod 600 /etc/backup.env

printf '%s . /etc/backup.env; /scripts/backup.sh >> /backups/backup.log 2>&1\n' "$BACKUP_CRON" \
  > /etc/crontabs/root

# Первый бэкап — сразу на старте, чтобы копия существовала уже сейчас, а не
# «завтра ночью». BACKUP_ON_START=0 отключает это поведение.
if [ "${BACKUP_ON_START:-1}" = "1" ]; then
  echo "[backup] стартовый прогон…"
  /scripts/backup.sh || echo "[backup] стартовый прогон не удался — крон всё равно запускается"
fi

# -f — не уходить в фон (иначе контейнер сразу завершится), -l 8 — писать в stdout,
# чтобы `docker compose logs backup` показывал работу крона.
exec crond -f -l 8
