import { type FC, useEffect, useState } from 'react';
import { addKeyword, getKeywords, setKeywordEnabled, updateKeyword } from '../api/client';
import type { Keyword } from '../api/types';
import KeywordManager from '../components/KeywordManager';

const KeywordsPage: FC = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getKeywords()
      .then((data) => {
        if (!cancelled) setKeywords(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load keywords');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async (input: { keyword: string; cron: string; targetUrls: string[] }) => {
    const created = await addKeyword(input);
    setKeywords((prev) => [created, ...prev]);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const updated = await setKeywordEnabled(id, enabled);
    setKeywords((prev) => prev.map((kw) => (kw._id === id ? updated : kw)));
  };

  const handleEdit = async (id: string, updates: { keyword: string; cron: string }) => {
    const updated = await updateKeyword(id, updates);
    setKeywords((prev) => prev.map((kw) => (kw._id === id ? updated : kw)));
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Keywords</h1>
      <p className="mb-6 text-sm text-gray-500">
        Terms tracked on Facebook, and the schedule each one runs on.
      </p>
      {loading && <p className="text-sm text-gray-400">Loading keywords…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <KeywordManager
          keywords={keywords}
          onAdd={handleAdd}
          onToggle={handleToggle}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};

export default KeywordsPage;
