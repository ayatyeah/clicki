/**
 * English strings for the creator cabinet, keyed by the Russian source text.
 * `ct(lang, ru)` returns the English when lang==='en' and a translation exists,
 * otherwise the Russian original — so an unmapped string simply stays Russian
 * and nothing ever breaks. The language comes from the global useLang() switch.
 */
const EN = {
  // Shell / auth
  'кабинет креатора': 'creator cabinet',
  'Кабинет креатора': 'Creator cabinet',
  'Войди в аккаунт, который выдал оператор CLICKI.': 'Sign in to the account the CLICKI operator gave you.',
  'Оставь заявку — оператор свяжется и выдаст доступ в кабинет.':
    'Leave a request — an operator will get in touch and grant cabinet access.',
  Вход: 'Sign in',
  'Подать заявку': 'Apply',

  // Forgot password
  'Укажи логин и Telegram для связи': 'Enter your login and a Telegram to reach you',
  Ошибка: 'Error',
  'Мы свяжемся с вами скоро': 'We’ll be in touch soon',
  'Оператор восстановит доступ и напишет в Telegram, который ты указал.':
    'An operator will restore access and message the Telegram you provided.',
  'Вернуться ко входу': 'Back to sign in',
  'Укажи свой логин и Telegram — оператор восстановит доступ и свяжется с тобой.':
    'Enter your login and Telegram — an operator will restore access and contact you.',
  'Твой логин': 'Your login',
  'Telegram для связи (@ник или телефон)': 'Telegram to reach you (@username or phone)',
  'Отправляю…': 'Sending…',
  Отправить: 'Send',
  '← Назад ко входу': '← Back to sign in',

  // Login
  'Ошибка входа': 'Sign-in error',
  Логин: 'Login',
  Пароль: 'Password',
  'Вхожу…': 'Signing in…',
  Войти: 'Sign in',
  'Забыли пароль?': 'Forgot password?',
  'Нет аккаунта?': 'No account?',

  // Apply
  Имя: 'Name',
  'Телефон / Telegram': 'Phone / Telegram',
  'Отправить заявку': 'Submit request',
  'Доступ выдаёт оператор после проверки заявки.': 'Access is granted by an operator after reviewing your request.',

  // Apply done
  'Заявка отправлена': 'Request sent',
  'Оператор CLICKI свяжется с тобой и выдаст логин и пароль для входа в кабинет.':
    'A CLICKI operator will contact you and issue a login and password for the cabinet.',
  'Перейти ко входу': 'Go to sign in',

  // Onboarding
  Правильных: 'Correct:',
  из: 'of',
  'Ответь верно на все — перечитай и попробуй снова.': 'Answer all correctly — reread and try again.',
  'Не удалось сохранить — попробуйте ещё раз': 'Couldn’t save — please try again',
  'Добро пожаловать в CLICKI! 🎉': 'Welcome to CLICKI! 🎉',
  'Отличный результат — ты прошёл тест и разобрался в правилах. Теперь можно брать заказы и зарабатывать на коротких видео.':
    'Great job — you passed the test and know the rules. Now you can take orders and earn from short videos.',
  'Войти в кабинет →': 'Enter the cabinet →',
  'Короткий тест': 'Quick test',
  'Несколько вопросов о правилах — чтобы видео не отклонялись потом.':
    'A few questions about the rules — so your videos aren’t rejected later.',
  'Сохраняю…': 'Saving…',
  'Пройти тест': 'Take the test',

  // Quiz questions / options
  'Минимум просмотров, чтобы видео засчиталось?': 'Minimum views for a video to count?',
  'Можно загрузить чужое видео?': 'Can you upload someone else’s video?',
  Да: 'Yes',
  'Нет, только своё по брифу': 'No, only your own per the brief',
  'Когда проверяется, удалено ли видео?': 'When is a video checked for deletion?',
  'Каждый день': 'Every day',
  'На 30-й день после публикации': 'On the 30th day after publishing',

  // Notifications
  Уведомления: 'Notifications',
  'Пока нет уведомлений': 'No notifications yet',
  'только что': 'just now',
  'мин назад': 'min ago',
  'ч назад': 'h ago',
  'дн назад': 'd ago',

  // Portal-level toasts
  'TikTok подключён': 'TikTok connected',
  'Не удалось подключить TikTok': 'Couldn’t connect TikTok',
  'Instagram подключён': 'Instagram connected',
  'Не удалось подключить Instagram': 'Couldn’t connect Instagram',
  'Загрузка…': 'Loading…',

  // Dashboard shell / nav
  'Разделы кабинета': 'Cabinet sections',
  Обзор: 'Overview',
  Заказы: 'Orders',
  Видео: 'Videos',
  Профиль: 'Profile',
  'Мой аккаунт': 'My account',
  Привет: 'Hi',
  Стрик: 'Streak',
  дн: 'd',
  Выйти: 'Sign out',
  '1 видео ждёт скриншот статистики за сегодня': '1 video is waiting for today’s stats screenshot',
  'видео ждут скриншот статистики за сегодня': 'videos are waiting for today’s stats screenshot',
  'Загрузить →': 'Upload →',
  'Мои видео': 'My videos',
  'Пока ничего не сдано': 'Nothing submitted yet',
  'Возьми открытый заказ во вкладке «Заказы», сними видео по брифу и загрузи ссылку здесь.':
    'Take an open order in the «Orders» tab, film a video per the brief and upload the link here.',
  'Не удалось взять заказ': 'Couldn’t take the order',
  'Ошибка сети — попробуйте ещё раз': 'Network error — please try again',

  // Profile sub-tabs
  Аккаунт: 'Account',
  Рефералы: 'Referrals',
  Рейтинг: 'Rating',
  Гайд: 'Guide',
  'Приглашай друзей-креаторов и приводи бренды по своим ссылкам — за каждого начисляем XP.':
    'Invite fellow creators and bring in brands with your links — we award XP for each.',
  'Ссылки появятся, когда выдадут логин': 'Links appear once you’re issued a login',
  'Оператор создаёт тебе логин после подтверждения заявки — тогда здесь появятся твоя реф-ссылка и ссылка для профиля.':
    'An operator creates your login after approving your request — then your referral and profile links will appear here.',
  'Чем больше XP, тем выше ты в топе. Снимай видео и держи ежедневный стрик — так рейтинг растёт быстрее.':
    'The more XP, the higher you rank. Film videos and keep a daily streak to climb faster.',
  'Как это работает': 'How it works',
  'Смотреть тур': 'Watch the tour',
  'Тур проведёт по кабинету и покажет, где что находится. Ниже — тот же путь текстом и скриншотами.':
    'The tour walks you through the cabinet and shows where everything is. Below is the same path in text and screenshots.',

  // Account view
  'Нужно изображение (JPG или PNG).': 'An image is required (JPG or PNG).',
  'Слишком большой файл — до 20 МБ.': 'File too large — up to 20 MB.',
  'Не удалось загрузить': 'Upload failed',
  'Фото обновлено': 'Photo updated',
  Сохранено: 'Saved',
  'Аватар и профиль видят бренды и другие креаторы.': 'Your avatar and profile are visible to brands and other creators.',
  'Твой UGC-код креатора CLICKI': 'Your CLICKI creator UGC code',
  'UGC-код': 'UGC code',
  'Сменить фото': 'Change photo',
  'Загрузить фото': 'Upload photo',
  Город: 'City',
  'Например: Алматы': 'e.g. Almaty',
  Почта: 'Email',
  Соцсети: 'Socials',
  '@ник в TikTok / Instagram': '@handle on TikTok / Instagram',
  'О себе': 'About you',
  'Пара слов о тебе и твоём контенте': 'A few words about you and your content',
  Сохранить: 'Save',
  'Подключение соцсетей': 'Connect socials',
  'Подключи аккаунт — просмотры видео будут подтягиваться сами, без скриншотов.':
    'Connect an account — video views will sync automatically, no screenshots.',

  // Overview home
  текущий: 'current',
  до: 'up to',
  осталось: 'left',
  Баланс: 'Balance',
  Вывести: 'Withdraw',
  'Выплата на Kaspi оформляется оператором — обычно в течение дня.':
    'Kaspi payouts are processed by an operator — usually within a day.',
  'Вывод откроется при балансе': 'Withdrawal opens at a balance of',
  сейчас: 'now',
  'До выплаты': 'To payout',
  'Всего просмотров': 'Total views',
  'В проверке': 'In review',
  'видео на модерации': 'videos in moderation',
  'видео ждут статистику': 'videos need stats',
  Загрузить: 'Upload',
  'Требуют внимания': 'Needs attention',
  'Активные заказы': 'Active orders',
  'назначен вам': 'assigned to you',
  'Пока нет активных заказов': 'No active orders yet',
  'Возьми заказ во вкладке «Заказы» и сними видео по брифу.':
    'Take an order in the «Orders» tab and film a video per the brief.',

  // Order status labels
  'в работе': 'in progress',
  'на модерации': 'in moderation',
  'на доработке': 'needs fixes',
  'AI-проверка': 'AI check',
  'на проверке': 'in review',
  'на доработку': 'needs fixes',
  'у бизнеса': 'with the business',
  принято: 'accepted',
  отклонено: 'rejected',
  оплачено: 'paid',
  ожидает: 'pending',

  // Earnings forecast
  'Прогноз заработка': 'Earnings forecast',
  'Прогноз появится после первого принятого видео за последние 30 дней.':
    'The forecast appears after your first accepted video in the last 30 days.',
  '₸/мес': '₸/mo',
  'В том же темпе (за 30 дней —': 'At the same pace (30 days —',
  'видео).': 'videos).',
  'Возьми ещё 2 брифа — примерно': 'Take 2 more briefs — about',

  // Referrals
  'Открыли ссылку': 'Opened the link',
  'Заявок от бизнеса': 'Business leads',
  Конверсия: 'Conversion',
  'Ссылка для профиля': 'Profile link',
  'приводит клиентов из твоих соцсетей': 'brings clients from your socials',
  'Помести её в шапку профиля в соцсетях. По ней открывается твоя страница на CLICKI с брендами, с которыми ты работал.':
    'Put it in your social profile bio. It opens your CLICKI page with the brands you’ve worked with.',
  'за каждую заявку бизнеса по этой ссылке.': 'for every business lead through this link.',
  'Скрыть заявки': 'Hide leads',
  'Показать заявки': 'Show leads',
  Заявка: 'Lead',
  'Пригласить друга-креатора': 'Invite a fellow creator',
  '+500 XP за каждого': '+500 XP each',
  'Отправь эту ссылку другу.': 'Send this link to a friend.',
  ', когда у него засчитают первое видео.': ' once their first video counts.',
  Приглашено: 'Invited',
  'Сняли первое видео': 'Filmed first video',
  'XP заработано': 'XP earned',
  'приглашённых ещё не сняли первое видео — XP начислится, когда снимут.':
    'invited haven’t filmed their first video yet — XP is credited once they do.',

  // Orders view
  'Сортировка заказов': 'Sort orders',
  'Сначала новые': 'Newest first',
  'Сначала выгодные': 'Highest paying first',
  'доступны всем': 'open to all',
  'Открытых заказов пока нет — менеджер скоро опубликует.': 'No open orders yet — a manager will publish some soon.',
  'Назначенные тебе': 'Assigned to you',
  'Как получать больше заказов?': 'How to get more orders?',
  'Заполни профиль, загружай качественные видео и повышай уровень — так бренды будут чаще обращаться к тебе.':
    'Fill out your profile, upload quality videos and level up — brands will reach out more often.',
  'Перейти в профиль': 'Go to profile',

  // Brief card
  Цель: 'Goal',
  Аудитория: 'Audience',
  Ориентация: 'Orientation',
  Горизонтальное: 'Horizontal',
  Вертикальное: 'Vertical',
  Хронометраж: 'Duration',
  'Произвольный — без жёстких таймингов': 'Flexible — no strict timing',
  сек: 'sec',
  Обязательно: 'Required',
  Логотип: 'Logo',
  'В первые 5 секунд': 'In the first 5 seconds',
  'Название бренда': 'Brand name',
  'Обязательно произнести': 'Must be said aloud',
  'Продукт в кадре': 'Product in frame',
  Стиль: 'Style',
  Молодёжный: 'Youthful',
  Премиальный: 'Premium',
  Корпоративный: 'Corporate',
  Развлекательный: 'Entertaining',
  'Стиль / тон': 'Style / tone',
  Хэштег: 'Hashtag',
  'Упоминание бренда': 'Brand mention',
  'В первые 3 сек': 'In the first 3 sec',
  'CTA-ссылка': 'CTA link',
  Делать: 'Do',
  'Не делать': 'Don’t',
  Референсы: 'References',
  Референс: 'Reference',
  'Логотип бренда': 'Brand logo',
  Формат: 'Format',
  '1 видео': '1 video',
  Дедлайн: 'Deadline',
  Проверка: 'Review',
  'до 48 ч': 'up to 48 h',
  Оплата: 'Payment',
  'за результат': 'for results',
  'Любая площадка': 'Any platform',
  'Топ по выгоде': 'Top value',
  'Осталось мест': 'Slots left',
  'Мест нет': 'No slots',
  'Закрыт — цель набрана': 'Closed — goal reached',
  '📱 Снимай на любой площадке — TikTok, Reels, Shorts. Платформу выберешь, когда будешь сдавать видео.':
    '📱 Film on any platform — TikTok, Reels, Shorts. You’ll pick the platform when submitting the video.',
  'Свернуть ↑': 'Collapse ↑',
  'Читать весь бриф →': 'Read full brief →',
  '✓ Бриф закрыт — набрано нужное количество просмотров': '✓ Brief closed — the required views were reached',
  'Сдать видео →': 'Submit video →',
  'Беру…': 'Taking…',
  'Взять в работу': 'Take on',

  // Leaderboard
  'Рейтинг пока пуст.': 'The rating is empty for now.',
  ты: 'you',

  // Video row
  'просм.': 'views',
  'На доработку': 'Needs fixes',
  'AI-коуч': 'AI coach',
  'Комментарий модератора': 'Moderator comment',
  '✓ Просмотры тянутся из TikTok автоматически — скриншот не нужен.':
    '✓ Views sync from TikTok automatically — no screenshot needed.',

  // Submit form
  'Нужен скриншот-изображение (JPG или PNG).': 'A screenshot image is required (JPG or PNG).',
  'Слишком большой файл — сделай обычный скриншот (до 4 МБ).': 'File too large — take a normal screenshot (up to 4 MB).',
  'Выбери заказ — без брифа сдать видео нельзя': 'Pick an order — you can’t submit a video without a brief',
  'Укажи ссылку на видео и подтверди права': 'Enter the video link and confirm rights',
  'Сдать видео': 'Submit video',
  'Заказ (бриф)': 'Order (brief)',
  'Выбери заказ': 'Pick an order',
  'Нет доступных заказов — возьми заказ во вкладке «Заказы», чтобы сдать по нему видео.':
    'No available orders — take an order in the «Orders» tab to submit a video for it.',
  '📱 Этот заказ — под любую площадку. Выбери ту, где ты опубликовал видео.':
    '📱 This order is for any platform. Pick the one where you published the video.',
  Платформа: 'Platform',
  'Ссылка на опубликованное видео': 'Link to the published video',
  '✓ Скриншот статистики загружен': '✓ Stats screenshot uploaded',
  '📷 Загрузить скриншот статистики': '📷 Upload stats screenshot',
  Скрыть: 'Hide',
  'Как снять скриншот?': 'How to take a screenshot?',
  'Скриншот статистики': 'Stats screenshot',
  'Подтверждаю права на это видео': 'I confirm the rights to this video',
};

export function ct(lang, ru) {
  if (lang !== 'en') return ru;
  return EN[ru] ?? ru;
}
