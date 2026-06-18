import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { EMAIL, EMAIL_URL } from '../lib/config.js';

/**
 * Privacy policy aligned with the Republic of Kazakhstan law
 * «О персональных данных и их защите» (94-V) — ТЗ 3.7 / 11.
 */
export default function Privacy() {
  return (
    <>
      <Seo
        title="Политика конфиденциальности — CLICKI"
        description="Политика обработки персональных данных CLICKI в соответствии с законом РК 94-V."
        path="/privacy"
      />
      <Header variant="hub" />
      <main className="page page--legal">
        <div className="container page__inner">
          <h1 className="page__title">Политика конфиденциальности</h1>
          <p className="page__lead">
            Настоящая политика описывает порядок обработки и защиты персональных данных пользователей сайта CLICKI в
            соответствии с Законом Республики Казахстан «О персональных данных и их защите» № 94-V.
          </p>

          <Article n="1" title="Общие положения">
            Оставляя заявку через формы на сайте, вы даёте согласие на обработку указанных вами персональных данных.
            Обработка осуществляется с целью обратной связи и предоставления услуг платформы.
          </Article>
          <Article n="2" title="Какие данные мы собираем">
            Имя, контактные данные (телефон, Telegram, email), сведения, добровольно указанные вами в полях формы
            (компания, сфера бизнеса, ссылки на соцсети, город, комментарии).
          </Article>
          <Article n="3" title="Цели обработки">
            Связь с вами по заявке, обработка обращения, информирование об услугах, улучшение сервиса. Мы не передаём
            ваши данные третьим лицам, кроме случаев, предусмотренных законодательством РК.
          </Article>
          <Article n="4" title="Хранение и защита">
            Данные хранятся на защищённых серверах с применением технических и организационных мер защиты. Доступ к
            данным имеют только уполномоченные сотрудники.
          </Article>
          <Article n="5" title="Ваши права">
            Вы вправе запросить доступ к своим данным, их исправление или удаление, а также отозвать согласие на
            обработку, направив запрос на{' '}
            <a href={EMAIL_URL}>{EMAIL}</a>.
          </Article>
          <Article n="6" title="Согласие">
            Отправляя форму и проставляя соответствующий чекбокс, вы подтверждаете, что ознакомлены с настоящей
            политикой и согласны с обработкой ваших персональных данных.
          </Article>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Article({ n, title, children }) {
  return (
    <section className="legal-article">
      <h2 className="legal-article__title">
        {n}. {title}
      </h2>
      <p className="legal-article__text">{children}</p>
    </section>
  );
}
