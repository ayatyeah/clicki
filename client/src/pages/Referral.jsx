import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/config.js';

/**
 * "Invite a friend" entry point: clicki-platform.com/friend/<login>.
 * Resolves the login to its owner, remembers the referral locally, then routes
 * the visitor into the creator funnel. Unknown logins fall through to the Hub.
 */
export default function Referral() {
  const { login } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/ref/${encodeURIComponent(login)}`);
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
  }, [login, navigate]);

  return null;
}
