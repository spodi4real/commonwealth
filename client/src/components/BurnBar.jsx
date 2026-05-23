// A burn-rate bar that compares % of budget consumed against % of month
// elapsed. If you're spending faster than time is passing, the bar shifts
// from gold → amber → red.

export function BurnBar({ spentCents, limitCents, pctMonthElapsed }) {
  if (!limitCents || limitCents <= 0) {
    return <div className="h-2 rounded bg-line/40" />;
  }
  const pct = Math.min((spentCents / limitCents) * 100, 100);
  const over = spentCents > limitCents;
  const pctElapsed = pctMonthElapsed ?? 0;

  let color = 'bg-gold';
  if (over)                            color = 'bg-danger';
  else if (pct > pctElapsed + 15)      color = 'bg-warning';
  else if (pct > pctElapsed + 5)       color = 'bg-gold';
  else                                 color = 'bg-success';

  return (
    <div className="relative h-2 rounded bg-line/40 overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 ${color} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
      {pctElapsed != null && (
        <div
          className="absolute inset-y-0 w-px bg-ink/60"
          style={{ left: `${Math.min(pctElapsed, 100)}%` }}
          title={`Month: ${Math.round(pctElapsed)}% elapsed`}
        />
      )}
    </div>
  );
}
