import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PWA entry point (manifest start_url = /app). When the installed app opens,
 * send a signed-in creator or business straight to their cabinet; everyone else
 * to the login choice. Tokens are the persistent localStorage ones set by the
 * cabinets — the server session lasts 30 days, so this "remembers" the login.
 */
export default function AppLauncher() {
  const navigate = useNavigate();
  useEffect(() => {
    // Route the installed PWA straight to the right cabinet by which session token
    // is present: creator → /creator, business → /business-cabinet, admin → /admin,
    // otherwise the login chooser. (An expired token just bounces to login there.)
    const creator = localStorage.getItem('clicki_creator_token');
    const business = localStorage.getItem('clicki_business_token');
    const admin = sessionStorage.getItem('clicki_admin_token');
    if (creator) navigate('/creator', { replace: true });
    else if (business) navigate('/business-cabinet', { replace: true });
    else if (admin) navigate('/admin', { replace: true });
    else navigate('/login', { replace: true });
  }, [navigate]);

  // Brief splash while we decide — the mascot, on brand.
  return (
    <main className="app-launcher">
      <div className="mascot-avatar app-launcher__mascot"><img src="/mascot-hood.jpg" alt="CLICKI" /></div>
      <p className="app-launcher__label">CLICKI</p>
    </main>
  );
}
