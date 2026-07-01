import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/config.js';

/**
 * Referral entry point: clicki-platform.com/<login>.
 * Resolves the login to its owner, remembers the referral locally, then routes
 * the visitor into the creator funnel. Unknown logins fall through to the Hub.
 */
export default function Referral() {
  const { ref } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/ref/${encodeURIComponent(ref)}`);
        const d = await r.json();
        if (!alive) return;
        if (r.ok && d && d.id) {
          localStorage.setItem('clicki_ref', String(d.id));
          navigate('/creators', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        if (alive) navigate('/', { replace: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ref, navigate]);

  return null;
}
