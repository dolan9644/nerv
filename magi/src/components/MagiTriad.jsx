const MAGI_NAMES = ['MELCHIOR', 'BALTHASAR', 'CASPER'];

export default function MagiTriad({ states }) {
  return (
    <footer className="magi-triad">
      {MAGI_NAMES.map((name, i) => (
        <div key={name} className="magi-unit">
          <span className="magi-label">{name}</span>
          <span className={`magi-indicator ${states[i] || 'standby'}`} />
        </div>
      ))}
    </footer>
  );
}
