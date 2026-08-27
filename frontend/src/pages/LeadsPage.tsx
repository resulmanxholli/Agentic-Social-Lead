import { type FC, useCallback } from 'react';
import { getLeads } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import LeadTable from '../components/LeadTable';

const LeadsPage: FC = () => {
  const fetchLeads = useCallback(() => getLeads(), []);
  const { data, loading, error } = useAsync(fetchLeads);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Leads</h1>
      <p className="mb-6 text-sm text-gray-500">
        Facebook profiles matched to tracked keywords, scored by intent.
      </p>
      {loading && !data && <p className="text-sm text-gray-400">Loading leads…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && <LeadTable leads={data} />}
    </div>
  );
};

export default LeadsPage;
