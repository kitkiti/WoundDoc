export function DisclaimerBanner() {
  return (
    <div className="rounded-[24px] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-ink shadow-card">
      <p className="font-semibold text-coral">Documentation support only. Not for autonomous diagnosis.</p>
      <p className="mt-1 text-ink/70">
        Outputs are draft suggestions for clinician review and include uncertainty handling.
      </p>
    </div>
  );
}
