import { type FC, useCallback, useEffect, useState } from 'react';
import { getStatus } from '../api/client';
import type { StatusResponse } from '../api/types';

const POLL_INTERVAL_MS = 15000;

const StatusWidget: FC = () => {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(() => {
    getStatus()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unreachable');
      });
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);

  const checking = !data && !error;
  const online = !error && data?.status === 'ok';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          checking ? 'bg-gray-300' : online ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      <span className="font-medium text-gray-800">
        {online ? 'Backend online' : checking ? 'Checking…' : 'Backend offline'}
      </span>
      <span className="text-gray-400">
        {data
          ? `Last checked ${new Date(data.timestamp).toLocaleTimeString()}`
          : error
            ? error
            : ''}
      </span>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="ml-auto text-gray-400 hover:text-gray-700 disabled:opacity-50"
      >
        Refresh
      </button>
    </div>
  );
};

export default StatusWidget;
