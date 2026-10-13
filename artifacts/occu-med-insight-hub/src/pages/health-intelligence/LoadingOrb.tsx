/** A temporary scan sphere. CSS keeps it usable without creating GPU contexts. */
export default function LoadingOrb({ exiting = false }: { exiting?: boolean }) {
  return (
    <div className={`hi-loading-orb${exiting ? " is-exiting" : ""}`} data-testid="health-scan-sphere" aria-hidden="true">
      <div className="hi-loading-orb-field"><i /><i /><i /></div>
    </div>
  );
}
