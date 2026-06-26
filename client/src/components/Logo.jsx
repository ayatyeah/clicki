import { Link } from 'react-router-dom';

/** CLICKI brand mark (violet "C") + wordmark. */
export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="CLICKI - на главную">
      <img className="logo__img" src="/logo-mark.png" alt="" width="36" height="36" />
      <span className="logo__word">CLICKI</span>
    </Link>
  );
}
