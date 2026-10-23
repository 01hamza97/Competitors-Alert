export default function DeltaValue({ value, delta }) {
  if (delta === undefined || delta === null) return <span className="font-semibold tabular-nums">{value}</span>;
  const isPos = delta >= 0;
  return (
    <span>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className={`ml-1.5 text-xs font-semibold ${isPos ? 'text-green-600' : 'text-red-500'}`}>
        {isPos ? '↑' : '↓'}{Math.abs(delta)}
      </span>
    </span>
  );
}