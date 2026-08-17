import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import ClickiPhoneHero from '../components/ClickiPhoneHero.jsx';
import { useLang } from '../i18n.jsx';
import { useContent } from '../content.jsx';

// Social marks drifting across the hero background.
const FLY_LOGOS = ['threads', 'instagram', 'tiktok', 'x', 'youtube', 'instagram', 'youtube', 'tiktok', 'threads', 'x'];

const COPY = {
  ru: {
    seoTitle: 'CLICKI - performance-платформа органических просмотров',
    seoDesc: 'Реклама с оплатой за результат. Выберите свой путь: бизнес или креатор.',
    title1: 'Контент, который',
    title2: 'реально',
    accent: 'залетает',
    subtitle: 'Живая органика без накруток и фейка. Выбирай свою сторону - и погнали 👇',
    features: ['Живая органика без накруток', 'Оплата только за результат', 'Сеть проверенных авторов'],
    bizEyebrow: 'Я бизнес',
    bizTitle: 'Запустить продвижение',
    bizDesc: 'Продвигай продукт через живой контент и плати только за результат.',
    crEyebrow: 'Я креатор',
    crTitle: 'Зарабатывать на контенте',
    crDesc: 'Снимай ролики с телефона и превращай свой рост в реальный доход.',
    contact: 'Связаться',
    login: 'Войти',
    play: 'Смотреть',
    call: 'Позвонить',
    ribbon: ['Живая органика', 'Оплата за результат', 'UGC-контент', 'Реальные просмотры', 'Сеть авторов'],
    // Дословно из /business (Business.jsx: steps.items[1], featureB, steps.items[3]) —
    // не выдумка, повтор уже опубликованных формулировок.
    beats: [
      { title: 'Платформа распределяет задачи', text: 'Заказ уходит сети проверенных авторов.' },
      { title: 'Полный автопилот и защита от накруток', text: 'Платформа сама раздаёт заказы проверенным авторам и считает просмотры. Умные фильтры отсекают ботов и «левый» трафик.' },
      { title: 'Бренд получает охват', text: 'Подтверждённые органические просмотры и прозрачный отчёт.' },
    ],
    phoneScreens: [
      { mode: 'reel', badge: '● ОПУБЛИКОВАНО', handle: '@автор', caption: ['UGC-видео о продукте,', 'снято на телефон'], brand: 'CLICKI', note: 'ПРОСМОТРЫ РАСТУТ' },
      { mode: 'stats', kicker: 'ПОДТВЕРЖДЁННЫЕ ПРОСМОТРЫ', bars: [0.34, 0.46, 0.4, 0.58, 0.52, 0.7, 0.86], axis: 'СЧИТАЮТСЯ АВТОМАТИЧЕСКИ', note: 'Метрики подтягиваются из площадок без ручного ввода' },
      { mode: 'payout', kicker: 'ВЫПЛАТА ОТПРАВЛЕНА', sub: 'На карту автора', foot: 'CLICKI · АВТОМАТИЧЕСКИ' },
    ],
  },
  en: {
    seoTitle: 'CLICKI - performance platform for organic views',
    seoDesc: 'Pay-for-result advertising. Pick your path: business or creator.',
    title1: 'Content that',
    title2: 'actually',
    accent: 'takes off',
    subtitle: 'Real organic reach - no bots, no fakes. Pick your side and let’s go 👇',
    features: ['Real organic reach, no bots', 'Pay only for results', 'A network of vetted creators'],
    bizEyebrow: 'I’m a business',
    bizTitle: 'I want reach',
    bizDesc: 'Promote your product through real content and pay only for results.',
    crEyebrow: 'I’m a creator',
    crTitle: 'I want to earn',
    crDesc: 'Film clips on your phone and turn your growth into real income.',
    contact: 'Get in touch',
    login: 'Log in',
    play: 'Watch',
    call: 'Call',
    ribbon: ['Real organic reach', 'Pay for results', 'UGC content', 'Real views', 'Creator network'],
    // Verbatim from /business (Business.jsx en: steps.items[1], featureB, steps.items[3]).
    beats: [
      { title: 'The platform distributes tasks', text: 'The order goes to a network of vetted creators.' },
      { title: 'Full autopilot and bot protection', text: 'The platform assigns tasks to vetted creators and counts the views. Smart filters cut out bots and junk traffic.' },
      { title: 'The brand gets reach', text: 'Confirmed organic views and a transparent report.' },
    ],
    phoneScreens: [
      { mode: 'reel', badge: '● PUBLISHED', handle: '@creator', caption: ['UGC video about the product,', 'filmed on a phone'], brand: 'CLICKI', note: 'VIEWS GROWING' },
      { mode: 'stats', kicker: 'CONFIRMED VIEWS', bars: [0.34, 0.46, 0.4, 0.58, 0.52, 0.7, 0.86], axis: 'COUNTED AUTOMATICALLY', note: 'Metrics are pulled from platforms, no manual entry' },
      { mode: 'payout', kicker: 'PAYOUT SENT', sub: 'To the creator’s card', foot: 'CLICKI · AUTOMATIC' },
    ],
  },
};

/**
 * Neutral entry point (ТЗ 4.1), reworked in a light "Shinta-style" layout:
 * headline + feature list on the left, a 3D-phone / video card on the right,
 * the two isolated funnels kept as the primary choice. No business mechanics
 * are revealed here.
 */
export default function Hub() {
  const { lang } = useLang();
  const { hubVideo } = useContent();
  const t = COPY[lang] || COPY.ru;

  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef(null);
  const slotRef = useRef(null);
  const [phone3dActive, setPhone3dActive] = useState(false);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      // play() rejects if the browser blocks unmuted autoplay — revert state, don't crash.
      v.play().then(() => setPlaying(true)).catch(() => { v.muted = true; setPlaying(false); });
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  const ribbon = [...t.ribbon, ...t.ribbon];

  return (
    <main className="hub">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/" />
      <Header variant="hub" />

      <section className="hub__hero">
        <div className="hub__logos" aria-hidden="true">
          {FLY_LOGOS.map((name, i) => (
            <img key={i} src={`/social/${name}.svg`} alt="" />
          ))}
        </div>

        {/* Sticky 3D-phone layer + the hero/beat content that scrolls past it —
           see components/ClickiPhoneHero.jsx for the activation gating
           (reduced-motion / low-end devices never load three.js at all, the
           slot below just keeps showing its normal fallback). */}
        <div className="phone-stage" ref={stageRef}>
          <ClickiPhoneHero
            stageRef={stageRef}
            slotRef={slotRef}
            modelUrl="/models/iphone.glb"
            screens={t.phoneScreens}
            onActive={setPhone3dActive}
          />

          <div className="phone-stage__content">
            <div className="container hub__inner">
              <div className="hub-hero">
                <div className="hub-hero__copy">
                  <h1 className="hub-hero__title">
                    {t.title1}
                    <br />
                    {t.title2} <span className="accent">{t.accent}</span>
                  </h1>

                  <ul className="hub-hero__features">
                    {t.features.map((f) => (
                      <li key={f}>
                        <span className="hub-hero__star" aria-hidden="true">✳</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <p className="hub-hero__lead">{t.subtitle}</p>

                  <div className="hub-hero__choices">
                    <Link to="/business" className="hub-choice hub-choice--business" data-track="Хаб: Я бизнес">
                      <span className="hub-choice__eyebrow">{t.bizEyebrow}</span>
                      <span className="hub-choice__title">{t.bizTitle}</span>
                      <span className="hub-choice__desc">{t.bizDesc}</span>
                      <span className="hub-choice__arrow" aria-hidden="true">→</span>
                    </Link>

                    <Link to="/creators" className="hub-choice hub-choice--creator" data-track="Хаб: Я креатор">
                      <span className="hub-choice__eyebrow">{t.crEyebrow}</span>
                      <span className="hub-choice__title">{t.crTitle}</span>
                      <span className="hub-choice__desc">{t.crDesc}</span>
                      <span className="hub-choice__arrow" aria-hidden="true">→</span>
                    </Link>
                  </div>

                  <div className="hub-hero__cta">
                    <Link to="/contacts" className="btn btn--primary btn--lg">
                      {t.contact}
                    </Link>
                  </div>
                </div>

                {/* Always rendered (not just when hubVideo is set) — this is where
                   the 3D phone docks once it activates, so the slot needs to exist
                   and be correctly sized from the first render. Content inside is
                   conditional: the 3D phone (once active) draws over this via the
                   sticky canvas layer; otherwise the real CMS video if configured,
                   else a plain gradient card — never an invented screenshot. */}
                <div className="hub-hero__media" ref={slotRef}>
                  {!phone3dActive && hubVideo && (
                    <div className="hub-video">
                      <video
                        ref={videoRef}
                        src={hubVideo}
                        muted
                        loop
                        autoPlay
                        playsInline
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                      />
                      <button
                        type="button"
                        className={`hub-video__play ${playing ? 'is-playing' : ''}`}
                        onClick={togglePlay}
                        aria-label={t.play}
                      >
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
                          {playing ? <path d="M8 5h3v14H8zM13 5h3v14h-3z" /> : <path d="M8 5v14l11-7z" />}
                        </svg>
                      </button>
                    </div>
                  )}
                  {!phone3dActive && !hubVideo && (
                    <div className="hub-video">
                      <div className="hub-video__empty" />
                    </div>
                  )}
                </div>
              </div>

              <div className="hub-marquee" aria-hidden="true">
                <div className="hub-marquee__track">
                  {ribbon.map((w, i) => (
                    <span key={i} className="hub-marquee__item">
                      {w}
                      <span className="hub-marquee__dot">•</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="hub__social">
                <a className="hub__social-btn" href="tel:+77753056326" title="+7 775 305 63 26" aria-label={`${t.call} +7 775 305 63 26`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z" />
                  </svg>
                </a>
                <a className="hub__social-btn" href="tel:+77770814444" title="+7 777 081 44 44" aria-label={`${t.call} +7 777 081 44 44`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z" />
                  </svg>
                </a>
                <a
                  className="hub__social-btn"
                  href="https://www.linkedin.com/in/assanali-tursumbayev-45795639a/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 9.5H5.67V18h2.67V9.5zM7 5.7a1.55 1.55 0 1 0 0 3.1 1.55 1.55 0 0 0 0-3.1zM18.33 18v-4.67c0-2.5-1.34-3.66-3.12-3.66-1.44 0-2.08.79-2.44 1.35V9.5h-2.66V18h2.66v-4.42c0-1.17.22-2.3 1.67-2.3 1.43 0 1.45 1.34 1.45 2.38V18h2.6z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* DEFAULT_KEYS puts the phone left/right/left across the three beats
               (see lib/clickiPhone3d.js) — text goes on the opposite side so
               they never overlap: right/left/right. */}
            {t.beats.map((b, i) => (
              <div className={`phone-beat ${i !== 1 ? 'phone-beat--right' : ''}`} key={b.title}>
                <div className="container phone-beat__inner">
                  <span className="phone-beat__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="phone-beat__title">{b.title}</h2>
                  <p className="phone-beat__text">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
