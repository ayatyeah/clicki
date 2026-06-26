import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { useLang } from '../i18n.jsx';
import { EMAIL, EMAIL_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'Политика конфиденциальности - CLICKI',
    seoDesc: 'Политика обработки персональных данных CLICKI в соответствии с законом РК 94-V.',
    title: 'Политика конфиденциальности',
    lead: 'Настоящая политика описывает порядок обработки и защиты персональных данных пользователей сайта CLICKI в соответствии с Законом Республики Казахстан «О персональных данных и их защите» № 94-V.',
    articles: [
      ['Общие положения', 'Оставляя заявку через формы на сайте, вы даёте согласие на обработку указанных вами персональных данных. Обработка осуществляется с целью обратной связи и предоставления услуг платформы.'],
      ['Какие данные мы собираем', 'Имя, контактные данные (телефон, Telegram, email), сведения, добровольно указанные вами в полях формы (компания, сфера бизнеса, ссылки на соцсети, город, комментарии).'],
      ['Цели обработки', 'Связь с вами по заявке, обработка обращения, информирование об услугах, улучшение сервиса. Мы не передаём ваши данные третьим лицам, кроме случаев, предусмотренных законодательством РК.'],
      ['Хранение и защита', 'Данные хранятся на защищённых серверах с применением технических и организационных мер защиты. Доступ к данным имеют только уполномоченные сотрудники.'],
      ['Ваши права', null],
      ['Согласие', 'Отправляя форму и проставляя соответствующий чекбокс, вы подтверждаете, что ознакомлены с настоящей политикой и согласны с обработкой ваших персональных данных.'],
    ],
    rights1: 'Вы вправе запросить доступ к своим данным, их исправление или удаление, а также отозвать согласие на обработку, направив запрос на ',
  },
  en: {
    seoTitle: 'Privacy policy - CLICKI',
    seoDesc: 'CLICKI personal data processing policy in line with RK law 94-V.',
    title: 'Privacy policy',
    lead: 'This policy describes how the personal data of CLICKI website users is processed and protected, in accordance with the Republic of Kazakhstan law “On Personal Data and Its Protection” No. 94-V.',
    articles: [
      ['General', 'By submitting a request through the site forms, you consent to the processing of the personal data you provide. Processing is carried out for feedback and to deliver the platform’s services.'],
      ['What data we collect', 'Name, contact details (phone, Telegram, email) and information you voluntarily provide in the form fields (company, industry, social links, city, comments).'],
      ['Purposes of processing', 'Contacting you about your request, handling the inquiry, informing you about services, improving the service. We do not share your data with third parties except as required by RK law.'],
      ['Storage and protection', 'Data is stored on secured servers with technical and organizational protection measures. Only authorized staff have access to the data.'],
      ['Your rights', null],
      ['Consent', 'By submitting the form and checking the corresponding box, you confirm that you have read this policy and agree to the processing of your personal data.'],
    ],
    rights1: 'You may request access to your data, its correction or deletion, and withdraw your consent to processing by emailing ',
  },
};

export default function Privacy() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <>
      <Seo title={t.seoTitle} description={t.seoDesc} path="/privacy" />
      <Header variant="hub" />
      <main className="page page--legal">
        <div className="container page__inner">
          <h1 className="page__title">{t.title}</h1>
          <p className="page__lead">{t.lead}</p>

          {t.articles.map(([title, text], i) => (
            <section className="legal-article" key={title}>
              <h2 className="legal-article__title">
                {i + 1}. {title}
              </h2>
              <p className="legal-article__text">
                {text === null ? (
                  <>
                    {t.rights1}
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
    </>
  );
}
