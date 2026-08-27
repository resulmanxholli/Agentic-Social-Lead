import type { FC } from 'react';

interface ScoreBadgeProps {
  score: number;
}

const ScoreBadge: FC<ScoreBadgeProps> = ({ score }) => {
  const classes =
    score >= 70
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 40
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

  return (
    <span
      className={`inline-flex min-w-[36px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {score}
    </span>
  );
};

export default ScoreBadge;