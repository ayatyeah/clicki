/**
 * Decorative animated background for the light funnels: soft drifting colour
 * blobs + a few floating social marks. Purely decorative, non-interactive.
 */
const MARKS = ['tiktok', 'instagram', 'youtube', 'threads', 'x', 'instagram', 'tiktok', 'youtube'];

export default function FloatingBg() {
  return (
    <div className="fx-bg" aria-hidden="true">
      <span className="fx-bg__blob fx-bg__blob--1" />
      <span className="fx-bg__blob fx-bg__blob--2" />
      <span className="fx-bg__blob fx-bg__blob--3" />
      {MARKS.map((m, i) => (
        <img key={i} className="fx-bg__mark" src={`/social/${m}.svg`} alt="" />
      ))}
    </div>
  );
}
