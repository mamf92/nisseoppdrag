export function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="n-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
