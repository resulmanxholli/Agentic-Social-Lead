import { type FC, useMemo, useState } from 'react';
import type { Lead } from '../api/types';
import ScoreBadge from './ScoreBadge';

interface LeadTableProps {
  leads: Lead[];
}

type SortDirection = 'asc' | 'desc';

const LeadTable: FC<LeadTableProps> = ({ leads }) => {
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedLeads = useMemo(
    () =>
      [...leads].sort((a, b) =>
        sortDirection === 'asc' ? a.intentScore - b.intentScore : b.intentScore - a.intentScore,
      ),
    [leads, sortDirection],
  );

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
        No leads yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Title / Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Evidence
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reasoning
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="flex items-center gap-1 uppercase tracking-wide text-gray-500 hover:text-gray-800"
              >
                Score {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedLeads.map((lead) => (
            <tr key={lead._id} className="border-b border-gray-100 align-top last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3.5">
                <a
                  href={lead.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {lead.fullName}
                </a>
                <div className="mt-1">
                  <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium capitalize text-blue-700">
                    {lead.platform}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 text-gray-700">
                <div>{lead.jobTitle ?? '—'}</div>
                <div className="text-gray-500">{lead.companyName ?? '—'}</div>
              </td>
              <td className="max-w-[260px] px-4 py-3.5 text-gray-500">
                <p className="line-clamp-2 italic">{lead.triggerContext}</p>
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View source ↗
                </a>
              </td>
              <td className="max-w-[260px] px-4 py-3.5 text-gray-500">{lead.intentReasoning}</td>
              <td className="px-4 py-3.5">
                <ScoreBadge score={lead.intentScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeadTable;
