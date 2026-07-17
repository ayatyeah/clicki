import { useEffect, useState } from 'react';
import {
  canPromptInstall, onInstallAvailability, promptInstall,
  isStandalone, isIos, isIosSafari,
} from '../lib/installPrompt.js';

/**
 * "Установить приложение" for the cabinet.
 *
 * Android/desktop Chrome: opens the real install dialog with the event parked at
 * app start. iOS: there is no such dialog, so it shows the gesture instead —
 * and only in Safari, since Chrome and Firefox on iOS cannot install at all.
 *
 * Renders nothing when there is nothing honest to offer: already installed, or a
 * browser with neither the API nor an instruction we could give (desktop
 * Firefox, say). A dead button that does nothing when tapped is worse than none.
 */
export default function InstallApp() {
  const [ready, setReady] = useState(canPromptInstall());
  const [showHint, setShowHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onInstallAvailability(() => setReady(canPromptInstall())), []);

  if (installed) {
    return (
      <div className="creator-portal__card cp-install">
        <h3 className="cp-card__title">Приложение установлено ✓</h3>
        <p className="creator-portal__muted" style={{ margin: 0 }}>
          Открывай его с домашнего экрана — вход уже сохранён.
        </p>
      </div>
    );
  }
  if (isStandalone()) return null;

  const ios = isIos();
  if (!ready && !ios) return null;

  const install = async () => {
    setBusy(true);
    try {
      if (await promptInstall() === 'accepted') setInstalled(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="creator-portal__card cp-install">
      <h3 className="cp-card__title">Приложение на телефон</h3>
      <p className="creator-portal__muted cp-install__lead">
        Кабинет можно поставить на домашний экран и открывать как обычное приложение —
        без вкладок и адресной строки, сразу в своих заказах.
      </p>

      {ready ? (
        <button className="btn btn--primary btn--sm" onClick={install} disabled={busy}>
          {busy ? 'Устанавливаю…' : '📲 Установить приложение'}
        </button>
      ) : isIosSafari() ? (
        <>
          <button className="btn btn--primary btn--sm" onClick={() => setShowHint((s) => !s)} aria-expanded={showHint}>
            📲 Как установить
          </button>
          {showHint && (
            <ol className="cp-install__steps">
              <li>Нажми <b>«Поделиться»</b> — квадрат со стрелкой вверх, внизу Safari.</li>
              <li>Пролистай вниз и выбери <b>«На экран „Домой“»</b>.</li>
              <li>Нажми <b>«Добавить»</b> — иконка появится рядом с остальными приложениями.</li>
              <li>
                Открой приложение и войди в свой аккаунт один раз: на iPhone у приложения
                своё хранилище, отдельное от Safari. Дальше вход запомнится.
              </li>
            </ol>
          )}
        </>
      ) : (
        // iOS, but not Safari — Chrome/Firefox there have no way to install.
        <p className="creator-portal__muted" style={{ margin: 0 }}>
          Открой сайт в <b>Safari</b> — оттуда кабинет можно поставить на домашний экран.
        </p>
      )}
    </div>
  );
}
