# CLICKI — образ приложения (монолит: клиент собирается внутрь, сервер его отдаёт).
#
# ═══════════════════════════════════════════════════════════════════════════
#  ПОЧЕМУ ЭТОТ ФАЙЛ ЛЕЖИТ В deploy/, А НЕ В КОРНЕ РЕПОЗИТОРИЯ
#  DigitalOcean App Platform при деплое сканирует корень репозитория. Если он
#  находит там `Dockerfile`, то ПЕРЕСТАЁТ использовать buildpack и переключается
#  на сборку через Docker — то есть текущий боевой сайт молча сменил бы способ
#  сборки на первом же push в main. Пока App Platform должен продолжать работать
#  как работает, Dockerfile обязан оставаться вне корня. Не переносите его.
# ═══════════════════════════════════════════════════════════════════════════
#
# Сборка (контекст — корень репозитория):
#   docker build -f deploy/Dockerfile -t clicki:latest .
# Обычно вызывается через deploy/docker-compose.yml, где контекст уже настроен.

# ---------- 1. Сборка React-клиента ----------
FROM node:22-alpine AS client-build
WORKDIR /app/client

# Слой зависимостей отдельно от исходников: правка компонента не тянет за собой
# переустановку 300 пакетов.
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY client/ ./

# VITE_* попадают в бандл на этапе СБОРКИ (scope: BUILD_TIME в app.yaml), поэтому
# это build-args, а не runtime-переменные. Значения по умолчанию совпадают с
# боевыми из .do/app.yaml — сайт на дроплете выглядит так же, как на App Platform.
ARG VITE_API_BASE=""
ARG VITE_PHONE="+7 700 000 00 00"
ARG VITE_TELEGRAM="CLICKI_App"
ARG VITE_EMAIL="info@clicki-platform.com"
ARG VITE_WHATSAPP=""
ARG VITE_RECAPTCHA_SITE_KEY=""
ARG VITE_GA4_ID=""
ARG VITE_META_PIXEL_ID=""
ARG VITE_YANDEX_METRIKA_ID=""
# Хеш коммита для admin-плашки «какая сборка сейчас живёт». В образе нет .git
# (см. .dockerignore), поэтому vite.config.js читает его из GIT_COMMIT.
ARG GIT_COMMIT=""

ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_PHONE=$VITE_PHONE \
    VITE_TELEGRAM=$VITE_TELEGRAM \
    VITE_EMAIL=$VITE_EMAIL \
    VITE_WHATSAPP=$VITE_WHATSAPP \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_GA4_ID=$VITE_GA4_ID \
    VITE_META_PIXEL_ID=$VITE_META_PIXEL_ID \
    VITE_YANDEX_METRIKA_ID=$VITE_YANDEX_METRIKA_ID \
    GIT_COMMIT=$GIT_COMMIT \
    NODE_OPTIONS=--max-old-space-size=1024

RUN npm run build && test -f dist/index.html

# ---------- 2. Продакшн-зависимости сервера ----------
FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 3. Рантайм ----------
FROM node:22-alpine AS runtime

# tini — корректная обработка SIGTERM (иначе node становится PID 1 и docker stop
# ждёт 10 секунд таймаута на каждом рестарте). tzdata — чтобы TZ реально работал
# в логах и в кроне бэкапов.
RUN apk add --no-cache tini tzdata

ENV NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Almaty

WORKDIR /app

# Структура каталогов ВАЖНА: server/src/index.js вычисляет путь к статике как
# __dirname/../../client/dist. Значит нужно ровно /app/server/src и /app/client/dist.
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY --from=client-build /app/client/dist ./client/dist

# Приложение никуда не пишет, кроме os.tmpdir() (кэш медиа) — рут не нужен.
USER node

EXPOSE 8080

# Форма без JSON-массива, чтобы $PORT подставился шеллом.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/src/index.js"]
