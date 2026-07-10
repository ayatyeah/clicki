import { Component } from 'react';

/**
 * Every route in this app is `React.lazy`. Without a boundary, one thrown render
 * error — or one chunk that fails to download after a redeploy swapped the
 * hashed filenames — unmounts the tree and leaves the visitor staring at a blank
 * white page with no way back. React has no hook equivalent for this: catching
 * render errors still requires a class component.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[error-boundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Decorative subtrees (the WebGL backdrop) pass fallback={null}: if the GPU
    // context can't be created, the page must lose the effect, not the content.
    if ('fallback' in this.props) return this.props.fallback;

    // A stale chunk reference after a deploy is the common case and a reload
    // genuinely fixes it, so offer that first and say why.
    const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|importing a module script failed/i.test(
      error.message || ''
    );

    return (
      <main className="page-light app-light ae-skip" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <h1 style={{ marginBottom: 12 }}>Что-то пошло не так</h1>
          <p className="creator-portal__muted" style={{ marginBottom: 20 }}>
            {isChunkError
              ? 'Похоже, сайт обновился, пока страница была открыта. Обновите её — этого достаточно.'
              : 'Страница не смогла отрисоваться. Мы уже записали ошибку в журнал.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
            <a className="btn btn--ghost" href="/">
              На главную
            </a>
          </div>
        </div>
      </main>
    );
  }
}
