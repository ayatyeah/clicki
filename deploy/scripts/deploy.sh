#!/usr/bin/env bash
# CLICKI — обновление копии на дроплете до свежего кода.
#
#   cd /opt/clicki/deploy && ./scripts/deploy.sh
#
# Что делает: тянет git, передаёт хеш коммита в сборку (чтобы плашка версии в
# админке показывала реальный коммит), пересобирает образ, перезапускает и
# ждёт, пока healthcheck станет healthy. Если приложение не поднялось —
# показывает логи и выходит с ошибкой, а не молча оставляет лежащий сайт.
#
# На боевой App Platform это никак не влияет: там свой деплой по push в main.

set -euo pipefail

cd "$(dirname "$0")/.."          # → deploy/
REPO="$(cd .. && pwd)"

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

[ -f .env ] || { echo "Нет deploy/.env — скопируйте из .env.example"; exit 1; }

if [ "${SKIP_PULL:-0}" != "1" ]; then
  say "git pull"
  git -C "$REPO" pull --ff-only
fi

# Хеш уходит build-аргументом: .git в контекст сборки не попадает (.dockerignore),
# поэтому иначе версия в админке была бы пустой.
GIT_COMMIT="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo '')"
export GIT_COMMIT
say "Сборка (коммит: ${GIT_COMMIT:-неизвестен})"
docker compose build --pull app

say "Перезапуск"
docker compose up -d

say "Ожидание готовности"
for i in $(seq 1 60); do
  STATE="$(docker compose ps --format json app 2>/dev/null | grep -o '"Health":"[a-z]*"' | head -1 | cut -d'"' -f4 || true)"
  if [ "$STATE" = "healthy" ]; then
    echo "  приложение healthy за ${i}0 секунд"
    docker compose ps
    say "Проверка ответа"
    curl -fsS http://127.0.0.1:"${HEALTH_PORT:-80}"/api/health && echo
    exit 0
  fi
  [ "$STATE" = "unhealthy" ] && break
  sleep 10
done

echo
echo "Приложение не стало healthy. Последние логи:"
docker compose logs --tail=60 app
exit 1
