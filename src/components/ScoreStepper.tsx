export function ScoreStepper({
  value,
  par,
  onChange,
}: {
  value: number;
  par: number;
  onChange: (next: number) => void;
}) {
  const diff = value - par;
  const diffColor =
    diff < 0 ? "text-blue-600" : diff === 0 ? "text-slate-500" : "text-red-600";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease score"
        className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 text-lg font-bold active:bg-slate-200 disabled:opacity-30"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <div className="w-10 text-center">
        <div className="text-lg font-bold text-slate-900 tabular-nums">{value}</div>
        <div className={`text-[10px] font-medium tabular-nums ${diffColor}`}>
          {diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}
        </div>
      </div>
      <button
        type="button"
        aria-label="Increase score"
        className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 text-lg font-bold active:bg-slate-200"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
