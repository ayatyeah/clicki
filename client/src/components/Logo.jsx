import { Link } from 'react-router-dom';

/** CLICKI brand mark + wordmark. */
export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="CLICKI - на главную">
      <img className="logo__img" src="/logo-adini.png" alt="" width="96" height="96" />
      <span className="logo__word">CLICKI</span>
    </Link>
  );
}
