// Единая точка сборки конфига подключения к Postgres.
//
// Зачем этот файл появился: раньше `ssl: { rejectUnauthorized: false }` был
// зашит в трёх местах (db.js, seed-demo.js, clean-briefs.js). Это правильно для
// DigitalOcean Managed Postgres (App Platform), но делает НЕВОЗМОЖНЫМ запуск
// рядом с локальным Postgres в Docker: локальный сервер поднимается без TLS и
// на попытку TLS-хендшейка отвечает «The server does not support SSL
// connections». Теперь режим задаётся переменной окружения.
//
// ОБРАТНАЯ СОВМЕСТИМОСТЬ: если DB_SSL не задан, поведение ровно то же, что и
// раньше — TLS с самоподписанным CA. App Platform продолжает работать без
// единого изменения переменных окружения.
//
//   DB_SSL не задан | require | on | true  → TLS, self-signed CA принимается
//   DB_SSL=disable | off | false | 0       → без TLS (локальный Postgres в Docker)
//   DB_CA_CERT=<PEM>                       → TLS с настоящей проверкой цепочки

/**
 * Выбор источника параметров подключения.
 *
 * ПРИОРИТЕТ ЗДЕСЬ — ВОПРОС БЕЗОПАСНОСТИ, А НЕ ВКУСА.
 *
 * Дискретные DB_* всегда выигрывают у DATABASE_URL. Причина конкретная: в
 * server/.env лежит DATABASE_URL от БОЕВОЙ managed-базы (кодом он исторически
 * не использовался, поэтому там и остался). Файл подхватывается через
 * `import 'dotenv/config'` в index.js. Если бы DATABASE_URL имел приоритет, то
 * запуск копии на дроплете со случайно попавшим туда .env молча подключил бы
 * копию к боевой базе — при явно переданном DB_HOST=db. Проверено на практике:
 * именно так и произошло при первом прогоне.
 *
 * Поэтому: DATABASE_URL используется ТОЛЬКО когда DB_HOST пуст. Если заданы оба
 * — пишем предупреждение в лог и берём DB_HOST.
 */
export function buildPoolConfig(extra = {}) {
  const {
    DATABASE_URL,
    DB_SSL,
    DB_CA_CERT,
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_PORT,
    DB_DATABASE,
  } = process.env;

  const mode = String(DB_SSL || '').trim().toLowerCase();
  const sslOff = mode === 'disable' || mode === 'off' || mode === 'false' || mode === '0';

  let ssl;
  if (sslOff) {
    ssl = false;
  } else if (DB_CA_CERT) {
    ssl = { ca: DB_CA_CERT, rejectUnauthorized: true };
  } else {
    // Историческое поведение: шифруем, но не проверяем цепочку — у managed DO
    // сертификат подписан их собственным CA.
    ssl = { rejectUnauthorized: false };
  }

  const hasHost = Boolean(String(DB_HOST || '').trim());
  const hasUrl = Boolean(String(DATABASE_URL || '').trim());

  if (hasHost && hasUrl) {
    console.warn(
      `[db] заданы и DB_HOST, и DATABASE_URL. Использую DB_HOST=${DB_HOST}, ` +
        'DATABASE_URL игнорируется. Уберите лишнее, чтобы не гадать, куда ' +
        'именно подключается приложение.'
    );
  }

  const base = hasHost
    ? {
        user: DB_USER,
        password: DB_PASSWORD,
        host: DB_HOST,
        port: DB_PORT,
        database: DB_DATABASE,
      }
    : { connectionString: DATABASE_URL };

  return { ...base, ssl, ...extra };
}

/**
 * Куда именно мы подключаемся — печатается в лог на старте. Ровно эта строка
 * позволяет за секунду отличить «копия работает со своей базой» от «копия
 * пишет в прод», не разбирая переменные окружения по одной.
 */
export function describeDbTarget() {
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_DATABASE, DB_SSL } = process.env;
  const where = String(DB_HOST || '').trim()
    ? `${DB_HOST}:${DB_PORT || '?'}/${DB_DATABASE || '?'}`
    : String(DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@') || 'НЕ НАСТРОЕНО';
  const tls = String(DB_SSL || '').toLowerCase().match(/^(disable|off|false|0)$/) ? 'no-tls' : 'tls';
  return `${where} (${tls})`;
}
