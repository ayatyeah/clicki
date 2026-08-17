import { Kpi } from './ui.jsx';

/**
 * "Банк идей" — overview/roadmap scaffold for the format-recommendation engine
 * from CLICKI_TZ_dlya_CTO_bank_idey.md. No backend exists yet: this page is the
 * anchor we build the real Review Queue / Matcher / stats screens into as each
 * sprint below actually ships. Nothing here calls the API.
 */

const PIPELINE = [
  { key: 'harvester', title: 'Harvester', text: 'Ночной сбор роликов по нишам через ScrapeCreators API (TikTok/Reels/Shorts).' },
  { key: 'enricher', title: 'Enricher', text: 'Транскрипция (Whisper) + метрики. Видео не хранится дольше 24 часов — юридическое требование, не пересдаём чужой контент.' },
  { key: 'classifier', title: 'Classifier', text: 'LLM размечает hook_type, нишу, сложность (1–3) по фиксированным энумам.' },
  { key: 'review', title: 'Review Queue', text: 'Человек подтверждает/правит разметку перед тем, как формат попадёт в банк.' },
  { key: 'formats', title: 'Formats + pgvector', text: 'Подтверждённые форматы с эмбеддингами — семантический поиск «похожих» роликов.' },
  { key: 'matcher', title: 'Matcher', text: 'По брифу бизнеса подбирает подходящие форматы (outlier_score, intent_ratio, selling_score, freshness).' },
  { key: 'outcomes', title: 'Outcomes', text: 'Что из рекомендованного реально сняли и как оно выстрелило — обратная связь в success_rate.' },
];

const SPRINTS = [
  { n: 0, title: 'Инфраструктура', done: false, items: ['Postgres + pgvector расширение', 'Схема БД под новый домен (без коллизий имён)', 'Аккаунт ScrapeCreators, тестовый запрос'] },
  { n: 1, title: 'Harvester + Enricher', done: false, items: ['Ночной cron сбора по нишам', 'Транскрипция + метрики, автоудаление видео ≤24ч'] },
  { n: 2, title: 'Classifier + Review Queue', done: false, items: ['LLM-разметка по фиксированным энумам', 'Админ-очередь подтверждения разметки'] },
  { n: 3, title: 'Formats + Matcher', done: false, items: ['pgvector семантический поиск', 'Подбор форматов под бриф', 'Лента форматов для креаторов'] },
  { n: 4, title: 'Outcomes', done: false, items: ['Сбор фактических результатов по рекомендованным форматам', 'success_rate по формату'] },
  { n: 5, title: 'Обкатка', done: false, items: ['Тест на реальных брифах', 'Правки по разметке и весам скоринга'] },
  { n: 6, title: 'Запуск', done: false, items: ['Включить для всех брифов', 'Мониторинг качества рекомендаций'] },
];

const OPEN_DECISIONS = [
  {
    title: 'Коллизия имён таблиц',
    text: 'ТЗ называет таблицы briefs, assignments, outcomes — в CLICKI эти имена уже заняты основной механикой (бизнес-бриф → назначение креатору → сдача видео). Нужны отдельные имена для нового домена (например idea_briefs / format_matches / format_outcomes) до того, как писать любые миграции.',
  },
  {
    title: 'LLM-провайдер',
    text: 'ТЗ подразумевает Claude (классификация) — в проекте уже есть рабочая интеграция с Google Gemini (server/src/gemini.js, ротация ключей, лимиты). Решить: переиспользовать Gemini или заводить второй LLM-вендор ради одного модуля.',
  },
  {
    title: 'Новые внешние сервисы',
    text: 'ScrapeCreators API и OpenAI Whisper — новые платные интеграции, ещё не подключены. Нужны аккаунт/ключи и бюджет на них до старта Sprint 0.',
  },
  {
    title: 'Хранение видео',
    text: 'ТЗ требует удалять исходное видео конкурента не позже 24 часов после транскрипции (не пересдаём чужой контент) — хранится только транскрипт/метрики/эмбеддинг.',
  },
];

function PipelineStep({ step, i, total }) {
  return (
    <div className="admin-idea-step">
      <div className="admin-idea-step__num">{i + 1}</div>
      <div className="admin-idea-step__body">
        <div className="admin-idea-step__title">{step.title}</div>
        <div className="admin-idea-step__text">{step.text}</div>
      </div>
      {i < total - 1 && <div className="admin-idea-step__arrow" aria-hidden="true">→</div>}
    </div>
  );
}

export function IdeaBankView() {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Банк идей</h2>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Движок подбора формата ролика под бриф на основе реально выстреливших видео конкурентов.
        Пока это план и скелет страницы — бэкенда ещё нет, ничего ниже не ходит в API. Реализуем
        по спринтам из ТЗ, эта страница — якорь, куда будут вставать реальные экраны (очередь
        модерации разметки, подбор форматов, статистика по outcomes).
      </p>

      <div className="kpi-grid">
        <Kpi tone="violet" icon="sparkle" value="7" label="Этапов пайплайна" />
        <Kpi tone="amber" icon="chart" value="0 / 7" label="Спринтов сделано" />
        <Kpi tone="rose" icon="check" value="4" label="Открытых решений" />
      </div>

      <h3 className="admin-block__title admin-subhead">Пайплайн</h3>
      <div className="admin-idea-pipeline">
        {PIPELINE.map((step, i) => (
          <PipelineStep key={step.key} step={step} i={i} total={PIPELINE.length} />
        ))}
      </div>

      <h3 className="admin-block__title admin-subhead">Спринты</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Спринт</th>
              <th>Задачи</th>
            </tr>
          </thead>
          <tbody>
            {SPRINTS.map((s) => (
              <tr key={s.n}>
                <td data-label="Спринт"><b>{s.n === 0 ? 'Sprint 0' : `Sprint ${s.n}`}</b> · {s.title}</td>
                <td data-label="Задачи">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {s.items.map((it) => <li key={it}>{it}</li>)}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="admin-block__title admin-subhead">Открытые решения — до старта Sprint 0</h3>
      <div className="admin-idea-decisions">
        {OPEN_DECISIONS.map((d) => (
          <div className="admin-idea-decision" key={d.title}>
            <div className="admin-idea-decision__title">{d.title}</div>
            <div className="admin-idea-decision__text">{d.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
