/**
 * Guide content for the in-cabinet "Как это работает" sections.
 * Kept as data (not JSX) so it's easy to translate — the business guide carries
 * both ru and en; the creator guide is ru-only for now.
 *
 * `img` paths point at screenshots in /public/guide/<role>/; a step without an
 * img just renders as text, so the guide is useful even before shots are added.
 */

export const CREATOR_GUIDE = {
  intro:
    'CLICKI — платформа, где бренды платят за реальные органические просмотры. Ты снимаешь короткие видео по брифам брендов, публикуешь у себя и получаешь оплату за набранные просмотры. Вот весь путь по шагам.',
  steps: [
    {
      title: 'Пройди онбординг',
      body: 'После входа один раз пройди короткий тест — он открывает доступ к заказам и подтверждает, что ты знаешь правила (минимум просмотров, хронометраж, права на контент).',
      img: '/guide/creator/01-onboarding.png',
    },
    {
      title: 'Возьми заказ во вкладке «Заказы»',
      body: 'Открытые брифы видны всем креаторам. Открой бриф, прочитай требования и нажми «Взять заказ». Рядом показан ориентировочный заработок — на основе средних просмотров по этой платформе.',
      points: [
        'Смотри платформу (TikTok / Reels / Shorts), хронометраж и обязательный хэштег.',
        'Бери заказ, который реально снимешь в срок — так растёт твой Trust-score.',
      ],
      img: '/guide/creator/02-orders.png',
    },
    {
      title: 'Сними видео по брифу',
      body: [
        'Выполни всё, что указано в брифе: хэштег, упоминание бренда в первые секунды, CTA-ссылку, нужный хронометраж и стиль.',
        'Если не знаешь, что говорить — нажми «Сгенерировать сценарий»: AI соберёт готовый текст под телесуфлёр прямо из брифа.',
      ],
    },
    {
      title: 'Опубликуй у себя и сдай ссылку',
      body: 'Выложи видео в своём аккаунте, затем во вкладке «Видео» вставь ссылку на публикацию, выбери платформу и подтверди права на контент. AI мгновенно проверит соответствие брифу.',
      points: [
        'AI-проверка прошла → видео уходит менеджеру на финальную проверку.',
        'Пришло «на доработку» → почитай замечание, поправь и сдай снова.',
      ],
      img: '/guide/creator/03-submit.png',
    },
    {
      title: 'Каждый день присылай скриншот статистики',
      body: [
        'Подключил TikTok — по TikTok-видео слать ничего не нужно: просмотры мы забираем из самого TikTok. Под таким видео будет написано, что скриншот не требуется.',
        'Во всех остальных случаях (Instagram, а также TikTok без подключения) раз в сутки прикладывай свежий скриншот статистики видео — под каждым видео есть блок «Статистика по дням» с пошаговой инструкцией, как его снять.',
        'Между скринами одного видео — раз в сутки (минимум 24 часа), чтобы график роста был ровным. Скрины хранятся и подтверждают твои просмотры.',
      ],
      img: '/guide/creator/04-stats.png',
    },
    {
      title: 'Получай оплату',
      body: 'Когда бизнес принимает работу, тебе начисляется оплата за просмотры. Баланс виден во вкладке «Кошелёк»; при достижении порога оператор оформляет выплату на Kaspi.',
    },
    {
      title: 'Зарабатывай больше через рефералов',
      body: 'Во вкладке «Рефералы» есть две ссылки: для профиля (приводит клиентов-бренды, +XP за заявку) и «пригласи друга-креатора» (+500 XP, когда у друга засчитают первое видео).',
      img: '/guide/creator/05-referrals.png',
    },
  ],
  faqTitle: 'Частые вопросы',
  faq: [
    { q: 'Сколько просмотров нужно, чтобы видео засчиталось?', a: 'Минимальный порог показан в правилах онбординга и на платформе. Ниже порога видео не идёт в оплату.' },
    { q: 'Почему видео не приняли?', a: 'Причина всегда указана рядом со статусом — обычно это хронометраж, отсутствие хэштега/упоминания или качество. Поправь и сдай снова.' },
    { q: 'Когда придут деньги?', a: 'Как только баланс в «Кошельке» достигнет порога выплаты — оператор оформит перевод на Kaspi.' },
    { q: 'Обязательно ли слать скрин каждый день?', a: 'Если TikTok подключён — по TikTok-видео не нужно вообще, просмотры приходят напрямую из TikTok. В остальных случаях да: это подтверждает реальные органические просмотры и даёт бренду честную аналитику. Между скринами одного видео — раз в сутки (минимум 24 часа).' },
  ],
};

/**
 * Business guide — bilingual from the start ({ ru, en }) so the cabinet's
 * language switch (added with the business i18n) flips it without a rewrite.
 */
export const BUSINESS_GUIDE = {
  ru: {
    intro:
      'CLICKI приводит вам реальные органические просмотры через UGC-креаторов: вы описываете, что рекламируете, — креаторы снимают короткие видео и публикуют у себя, а вы платите за фактические просмотры. Вот как работать в кабинете.',
    steps: [
      {
        title: 'Создайте бриф',
        body: 'В разделе «Брифы» опишите задачу: платформа, ключевое сообщение, хронометраж, обязательный хэштег и CTA-ссылка, стиль. Чем конкретнее бриф — тем точнее видео и меньше правок.',
        points: [
          'Ключевое сообщение — одна мысль, которую должен запомнить зритель.',
          'Укажите хэштег и ссылку, если они обязательны.',
          'Выберите стиль (молодёжный / премиальный / корпоративный / развлекательный).',
        ],
        img: '/guide/business/01-brief.png',
      },
      {
        title: 'Соберите бриф с помощью AI',
        body: 'Не знаете, с чего начать? Вставьте ссылку на свой сайт/продукт или пару предложений — AI-конструктор соберёт 3 готовых варианта брифа (хук, дос/донтс, тон) и подскажет, что уточнить.',
        img: '/guide/business/02-ai.png',
      },
      {
        title: 'Дождитесь модерации',
        body: 'Оператор проверяет новый бриф (обычно в течение рабочего дня) и публикует его креаторам. Если бриф вернули на доработку — вы увидите замечание и сможете отредактировать бриф, он снова уйдёт на модерацию.',
      },
      {
        title: 'Примите готовые работы',
        body: 'Когда креатор сдал видео и оно прошло проверку, оно появляется в разделе «Приёмка». Откройте видео по ссылке, проверьте соответствие брифу и нажмите «Принять работу» — после этого креатору начисляется оплата.',
        img: '/guide/business/03-review.png',
      },
      {
        title: 'Следите за аналитикой',
        body: 'В разделе «Аналитика» виден рост просмотров по всей кампании по дням, разбивка по платформам и потраченный бюджет. Просмотры подтверждаются ежедневными скриншотами статистики от креаторов — без накруток.',
        img: '/guide/business/04-analytics.png',
      },
    ],
    faqTitle: 'Частые вопросы',
    faq: [
      { q: 'Как быстро проверят мой бриф?', a: 'Обычно в течение рабочего дня. Статус виден в разделе «Брифы».' },
      { q: 'За что именно я плачу?', a: 'За реальные органические просмотры по действующим тарифам — без предоплаты за показы, которых не было.' },
      { q: 'Можно исправить бриф после отправки?', a: 'Да, пока он не одобрен — отредактируйте его в разделе «Брифы», он снова уйдёт на модерацию.' },
      { q: 'Откуда берётся аналитика просмотров?', a: 'По TikTok — напрямую из TikTok: креатор подключает свой аккаунт, и просмотры приходят из первоисточника. По остальным площадкам креаторы каждый день присылают скриншот статистики своего видео. Из этого складывается честный график роста.' },
    ],
  },
  en: {
    intro:
      'CLICKI brings you real organic views through UGC creators: you describe what you’re promoting, creators film short videos and post them on their own accounts, and you pay for actual views. Here’s how the cabinet works.',
    steps: [
      {
        title: 'Create a brief',
        body: 'In “Briefs”, describe the task: platform, key message, duration, required hashtag and CTA link, style. The more specific the brief, the more on-point the videos — and the fewer revisions.',
        points: [
          'Key message — the one idea a viewer should remember.',
          'Add a hashtag and link if they’re required.',
          'Pick a style (youth / premium / corporate / entertainment).',
        ],
        img: '/guide/business/01-brief.png',
      },
      {
        title: 'Build a brief with AI',
        body: 'Not sure where to start? Paste your site/product link or a couple of sentences — the AI constructor returns 3 ready brief drafts (hook, dos/don’ts, tone) and tips on what to clarify.',
        img: '/guide/business/02-ai.png',
      },
      {
        title: 'Wait for moderation',
        body: 'An operator reviews the new brief (usually within a business day) and publishes it to creators. If it’s sent back, you’ll see the note and can edit the brief — it returns to moderation.',
      },
      {
        title: 'Accept finished work',
        body: 'Once a creator submits a video and it passes the check, it appears under “Review”. Open the video, verify it matches the brief and click “Accept” — the creator is then paid.',
        img: '/guide/business/03-review.png',
      },
      {
        title: 'Track the analytics',
        body: 'The “Analytics” section shows cumulative campaign views by day, a per-platform breakdown and spend to date. Views are backed by creators’ daily stats screenshots — no fake traffic.',
        img: '/guide/business/04-analytics.png',
      },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: 'How fast is my brief reviewed?', a: 'Usually within a business day. The status is shown under “Briefs”.' },
      { q: 'What exactly am I paying for?', a: 'Real organic views at the current rates — no prepaying for impressions that never happened.' },
      { q: 'Can I edit a brief after submitting?', a: 'Yes, until it’s approved — edit it under “Briefs” and it returns to moderation.' },
      { q: 'Where does the view analytics come from?', a: 'For TikTok, straight from TikTok: the creator connects their account and the views arrive from the source. Elsewhere, creators send a daily stats screenshot of their video. Together they build the honest growth chart.' },
    ],
  },
};

/**
 * Coach-mark tour for the creator cabinet — the walkable twin of CREATOR_GUIDE
 * above, rendered by components/Tour.jsx.
 *
 * `target` is a CSS selector resolved at runtime. The nav buttons carry
 * data-tour="nav-<tab>" and exist twice over (desktop sidebar + mobile bottom
 * bar); the tour spotlights whichever one is on screen.
 *
 * `view` is the tab to open before the step, so the section being explained is
 * actually behind the spotlight rather than described in the abstract. The
 * portal turns it into the step's onEnter — keeping this file plain data, the
 * way the guides above stayed translatable.
 *
 * It ends on the guide tab on purpose: that is where the "Смотреть тур" button
 * lives, so the last step leaves you looking at how to replay it — and it is
 * also where a creator who just finished onboarding already lands.
 */
export const CREATOR_TOUR = [
  {
    title: 'Привет! Это твой кабинет',
    body: [
      'Покажу за минуту, где что лежит.',
      'Можно пропустить в любой момент и вернуться к туру из «Профиль → Гайд».',
    ],
  },
  {
    view: 'overview',
    target: '[data-tour="nav-overview"]',
    title: 'Обзор',
    body: 'Главный экран: баланс, уровень, стрик и XP. Здесь сразу видно, что ждёт действия — например, какие видео просят скриншот статистики.',
  },
  {
    view: 'briefs',
    target: '[data-tour="nav-briefs"]',
    title: 'Заказы',
    body: [
      'Открытые брифы брендов — они доступны всем креаторам.',
      'Открой бриф, прочитай требования и нажми «Взять заказ».',
    ],
  },
  {
    view: 'videos',
    target: '[data-tour="nav-videos"]',
    title: 'Мои видео',
    body: [
      'Здесь сдаёшь готовое видео по заказу и следишь за его статусом.',
      'Подключишь TikTok — просмотры по TikTok-видео подтянутся сами. Для остальных видео раз в сутки загружай скриншот статистики: это главная ежедневная задача, и по ней считается выплата.',
    ],
  },
  {
    view: 'account',
    target: '[data-tour="nav-account"]',
    title: 'Профиль',
    body: 'Твой аккаунт и подключение TikTok / Instagram. А ещё внутри — рефералы, рейтинг и раздел «Как это работает»: переключай вкладки вверху.',
  },
  {
    view: 'referrals',
    target: '[data-tour="sub-referrals"]',
    title: 'Рефералы',
    body: 'Вкладка внутри «Профиля»: твоя личная ссылка. Приводишь бизнес — получаешь XP и бонус, когда он становится клиентом.',
  },
  {
    view: 'guide',
    target: '[data-tour="sub-guide"]',
    title: 'Как это работает',
    body: [
      'Тоже внутри «Профиля»: подробный разбор каждого шага со скриншотами и ответами на частые вопросы.',
      'Отсюда же можно запустить этот тур заново — кнопка «Смотреть тур».',
    ],
  },
];
