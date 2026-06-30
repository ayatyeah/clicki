import { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE } from './lib/config.js';

const DEFAULTS = {
  showcase: [],
  devices: { iphone: { image: '' }, laptop: { image: '' } },
  creatorVideo: '',
  hubVideo: '',
};

const ContentContext = createContext(DEFAULTS);

/** Fetches site content (showcase feed + device screen images) once at startup. */
export function ContentProvider({ children }) {
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/content`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d) return;
        setContent({
          showcase: Array.isArray(d.showcase) ? d.showcase : [],
          devices: {
            iphone: { image: d?.devices?.iphone?.image || '' },
            laptop: { image: d?.devices?.laptop?.image || '' },
          },
          creatorVideo: d?.creatorVideo || '',
          hubVideo: d?.hubVideo || '',
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);
