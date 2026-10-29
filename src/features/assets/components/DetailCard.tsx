'use client';

export interface DetailCardProps {
  label: string;
  value: string;
}

export function DetailCard({ label, value }: DetailCardProps) {
  return (
    <div className="bg-surface-raised p-4 rounded-2xl border border-white/5">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className="text-zinc-200 font-semibold text-sm" dir="ltr">
        {value}
      </p>
    </div>
  );
}
