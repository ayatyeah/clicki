#!/usr/bin/env bash
# CLICKI — подготовка чистого дроплета Ubuntu 22.04/24.04 к запуску.
#
# Запускать от root на СВЕЖЕМ дроплете, один раз:
#   ssh root@<IP>
#   bash bootstrap-droplet.sh
#
# Скрипт идемпотентен: повторный запуск ничего не сломает.

set -euo pipefail

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Запускайте от root"; exit 1; }

say "Обновление пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

say "Базовые утилиты"
apt-get install -y -qq ca-certificates curl gnupg git ufw fail2ban unattended-upgrades

# ---- Swap ----
# Сборка фронтенда (vite + tailwind) на 1–2 ГБ дроплета уходит в OOM без swap.
# Симптом без свопа: `docker compose build` падает с «Killed» без объяснений.
say "Swap-файл"
if swapon --show | grep -q '/swapfile'; then
  echo "  уже есть, пропускаю"
else
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Для сервера с БД агрессивный своп вреден: пусть используется только под нагрузкой.
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "  создан 2 ГБ"
fi

# ---- Docker ----
say "Docker Engine + Compose"
if command -v docker >/dev/null 2>&1; then
  echo "  уже установлен: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "  установлен: $(docker --version)"
fi

# Лимит на логи контейнеров глобально — иначе json-логи со временем съедают диск.
say "Ограничение размера docker-логов"
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
  echo "  настроено"
else
  warn "/etc/docker/daemon.json уже существует — не трогаю, проверьте log-opts вручную"
fi

# ---- Firewall ----
say "Firewall (ufw)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status numbered | sed 's/^/  /'
warn "Docker публикует порты в обход ufw (известная особенность). Порт Postgres"
warn "в docker-compose.yml намеренно НЕ публикуется — не открывайте его."

# ---- Автообновления безопасности ----
say "Автоматические security-обновления"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
echo "  включены"

# ---- Каталог проекта ----
say "Каталог проекта"
mkdir -p /opt/clicki
if [ -d /opt/clicki/.git ]; then
  echo "  /opt/clicki уже содержит репозиторий"
else
  echo "  создан /opt/clicki — склонируйте туда репозиторий:"
  echo "    git clone https://github.com/ayatyeah/clicki.git /opt/clicki"
fi

say "Готово"
cat <<'NEXT'
Дальше:
  1. git clone https://github.com/ayatyeah/clicki.git /opt/clicki
  2. cd /opt/clicki/deploy && cp .env.example .env && nano .env
     (обязательно: POSTGRES_PASSWORD, ADMIN_PASS, ADMIN_TOKEN, CORS_ORIGINS)
  3. docker compose up -d --build
  4. curl -f http://localhost/api/health
  5. Перенос боевых данных — см. deploy/README.md, раздел «Копия базы».
NEXT
