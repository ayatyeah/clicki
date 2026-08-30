import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { useLang } from '../i18n.jsx';
import { EMAIL, EMAIL_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'Условия использования - CLICKI',
    seoDesc: 'Условия использования платформы CLICKI для бизнеса и креаторов.',
    title: 'Условия использования',
    lead: 'Настоящие условия регулируют использование платформы CLICKI — performance-платформы органических просмотров, соединяющей бизнес и UGC-креаторов.',
    articles: [
      ['Описание сервиса', 'CLICKI — платформа, где бизнес размещает брифы на съёмку коротких видео, а независимые креаторы снимают и публикуют ролики по этим брифам на своих открытых аккаунтах в TikTok, Instagram Reels, YouTube Shorts и других площадках.'],
      ['Регистрация и аккаунты', 'Для использования кабинета бизнеса или креатора необходимо зарегистрироваться и предоставить достоверные контактные данные. Вы несёте ответственность за сохранность доступа к своему аккаунту.'],
      ['Обязанности креатора', 'Креатор снимает оригинальный контент по брифу, соблюдает требования площадки и бренда, подтверждает права на публикуемый материал. Оплата рассчитывается на основе реальных органических просмотров, набранных роликом.'],
      ['Обязанности бизнеса', 'Бизнес предоставляет корректный и полный бриф, оплачивает услуги согласно действующим тарифам платформы и не требует от креаторов действий, нарушающих правила соответствующей социальной сети.'],
      ['Модерация', 'Все сдаваемые видео и брифы проходят проверку оператора платформы перед публикацией или оплатой. Платформа вправе отклонить материал, не соответствующий брифу или правилам.'],
      ['Ограничение ответственности', 'CLICKI не гарантирует конкретное количество просмотров или результат кампании — оплата зависит от фактического органического охвата. Платформа не несёт ответственности за действия третьих сторон (соцсети, банки-эквайеры).'],
      ['Изменения условий', 'Мы можем обновлять эти условия. Продолжение использования платформы после публикации изменений означает согласие с обновлённой редакцией.'],
      ['Контакты', null],
    ],
    contact1: 'По вопросам, связанным с условиями использования, пишите на ',
    offerPre: 'Отношения платформы с креаторами регулируются отдельным договором — ',
    offerLink: 'публичной офертой',
    offerPost: '. В части, касающейся креаторов, она имеет приоритет над настоящими условиями.',
  },
  en: {
    seoTitle: 'Terms of Service - CLICKI',
    seoDesc: 'Terms of Service for the CLICKI platform, for businesses and creators.',
    title: 'Terms of Service',
    lead: 'These terms govern the use of CLICKI — a performance platform for organic reach that connects businesses with UGC creators.',
    articles: [
      ['Description of service', 'CLICKI is a platform where businesses post briefs for short-form video content, and independent creators film and publish videos against those briefs on their own public accounts on TikTok, Instagram Reels, YouTube Shorts and other platforms.'],
      ['Registration and accounts', 'Using the business or creator dashboard requires registration with accurate contact details. You are responsible for keeping your account access secure.'],
      ['Creator obligations', 'Creators film original content per the brief, follow the platform’s and brand’s requirements, and confirm rights to the published material. Payment is calculated from the real organic views a video earns.'],
      ['Business obligations', 'Businesses provide a complete and accurate brief, pay for services per the platform’s current rates, and do not require creators to act against the rules of the relevant social network.'],
      ['Moderation', 'All submitted videos and briefs are reviewed by a platform operator before publication or payout. The platform may reject material that doesn’t match the brief or its guidelines.'],
      ['Limitation of liability', 'CLICKI does not guarantee a specific number of views or campaign outcome — payment depends on actual organic reach. The platform is not liable for the actions of third parties (social networks, payment processors).'],
      ['Changes to these terms', 'We may update these terms. Continued use of the platform after changes are published means you accept the updated version.'],
      ['Contact', null],
    ],
    contact1: 'For questions about these terms, email ',
    offerPre: 'The platform’s relationship with creators is governed by a separate contract — ',
    offerLink: 'the public offer',
    offerPost: '. Where creators are concerned, it prevails over these terms.',
  },
};

export default function Terms() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <div className="page-light">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/terms" />
      <Header variant="hub" />
      <main className="page page--legal">
        <div className="container page__inner">
          <h1 className="page__title">{t.title}</h1>
          <p className="page__lead">{t.lead}</p>
          {/* These terms are the site-level rules; the binding creator contract lives
              at /legal/offer. Cross-linked so a reader who lands here first isn't
              left thinking this page is the whole agreement. */}
          <p className="page__lead">
            {t.offerPre}
            <Link to="/legal/offer">{t.offerLink}</Link>
            {t.offerPost}
          </p>

          {t.articles.map(([title, text], i) => (
            <section className="legal-article" key={title}>
              <h2 className="legal-article__title">
                {i + 1}. {title}
              </h2>
              <p className="legal-article__text">
                {text === null ? (
                  <>
                    {t.contact1}
                    <a href={EMAIL_URL}>{EMAIL}</a>.
                  </>
                ) : (
                  text
                )}
              </p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
