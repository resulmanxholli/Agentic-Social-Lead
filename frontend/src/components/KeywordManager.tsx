import { type FC, type FormEvent, useState } from 'react';
import type { Keyword } from '../api/types';
import { describeCron } from '../lib/cron';
import Modal from './Modal';

interface KeywordManagerProps {
  keywords: Keyword[];
  onAdd: (input: { keyword: string; cron: string; targetUrls: string[] }) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onEdit: (id: string, updates: { keyword: string; cron: string }) => Promise<void>;
}

const DEFAULT_CRON = '0 * * * *';

const CRON_PRESETS = [
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily', value: '0 0 * * *' },
  { label: 'Weekly', value: '0 0 * * 0' },
  { label: 'Monthly', value: '0 0 1 * *' },
  { label: 'Yearly', value: '0 0 1 1 *' },
] as const;

const CRON_FIELDS = [
  { key: 'minute', label: 'Minute' },
  { key: 'hour', label: 'Hour' },
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
] as const;

type CronFieldKey = (typeof CRON_FIELDS)[number]['key'];
type CronFieldState = Record<CronFieldKey, string>;

function splitCron(expression: string): CronFieldState {
  const [minute = '*', hour = '*', day = '*', month = '*', week = '*'] = expression
    .trim()
    .split(/\s+/);
  return { minute, hour, day, month, week };
}

interface CronBuilderProps {
  idPrefix: string;
  cron: string;
  fields: CronFieldState;
  onPreset: (value: string) => void;
  onFieldChange: (key: CronFieldKey, value: string) => void;
  onApplyFields: () => void;
}

const CronBuilder: FC<CronBuilderProps> = ({
  idPrefix,
  cron,
  fields,
  onPreset,
  onFieldChange,
  onApplyFields,
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-500">Quick schedule</span>
      <div className="flex flex-wrap gap-2">
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPreset(preset.value)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap items-end gap-3">
      {CRON_FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-${field.key}`}
            className="text-xs font-medium text-gray-500"
          >
            {field.label}
          </label>
          <input
            id={`${idPrefix}-${field.key}`}
            value={fields[field.key]}
            onChange={(e) => onFieldChange(field.key, e.target.value || '*')}
            className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-center font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={onApplyFields}
        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Set
      </button>
    </div>

    <span className="text-xs text-gray-400">
      {describeCron(cron.trim()) ?? 'Not a valid cron expression'}
    </span>
  </div>
);

const KeywordManager: FC<KeywordManagerProps> = ({ keywords, onAdd, onToggle, onEdit }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [targetUrlsInput, setTargetUrlsInput] = useState('');
  const [cronInput, setCronInput] = useState(DEFAULT_CRON);
  const [cronFields, setCronFields] = useState<CronFieldState>(() => splitCron(DEFAULT_CRON));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [editCronInput, setEditCronInput] = useState('');
  const [editCronFields, setEditCronFields] = useState<CronFieldState>(() => splitCron(DEFAULT_CRON));
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const targetUrls = targetUrlsInput
    .split(/[,\n]/)
    .map((url) => url.trim())
    .filter(Boolean);

  const resetAddForm = () => {
    setKeywordInput('');
    setTargetUrlsInput('');
    setCronInput(DEFAULT_CRON);
    setCronFields(splitCron(DEFAULT_CRON));
    setSubmitError(null);
  };

  const openAdd = () => {
    resetAddForm();
    setIsAddOpen(true);
  };

  const closeAdd = () => {
    setIsAddOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!keywordInput.trim() || !cronInput.trim() || targetUrls.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onAdd({ keyword: keywordInput.trim(), cron: cronInput.trim(), targetUrls });
      setIsAddOpen(false);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add keyword');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    setToggleError(null);
    try {
      await onToggle(id, enabled);
    } catch (err: unknown) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update keyword');
    } finally {
      setTogglingId(null);
    }
  };

  const openEdit = (kw: Keyword) => {
    setEditingKeyword(kw);
    setEditKeywordInput(kw.keyword);
    setEditCronInput(kw.cron);
    setEditCronFields(splitCron(kw.cron));
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingKeyword(null);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingKeyword || !editKeywordInput.trim() || !editCronInput.trim()) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await onEdit(editingKeyword._id, {
        keyword: editKeywordInput.trim(),
        cron: editCronInput.trim(),
      });
      setEditingKeyword(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update keyword');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {toggleError && <p className="text-sm text-red-600">{toggleError}</p>}
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add keyword
        </button>
      </div>

      <Modal open={isAddOpen} onClose={closeAdd} title="Add keyword">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="keyword" className="text-xs font-medium text-gray-500">
              Keyword
            </label>
            <input
              id="keyword"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="e.g. final expense leads"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="targetUrls" className="text-xs font-medium text-gray-500">
              Target URLs (comma or newline separated)
            </label>
            <textarea
              id="targetUrls"
              value={targetUrlsInput}
              onChange={(e) => setTargetUrlsInput(e.target.value)}
              placeholder="https://facebook.com/groups/insuranceagents"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <CronBuilder
            idPrefix="add-cron"
            cron={cronInput}
            fields={cronFields}
            onPreset={(value) => {
              setCronInput(value);
              setCronFields(splitCron(value));
            }}
            onFieldChange={(key, value) => setCronFields((f) => ({ ...f, [key]: value }))}
            onApplyFields={() =>
              setCronInput(
                `${cronFields.minute} ${cronFields.hour} ${cronFields.day} ${cronFields.month} ${cronFields.week}`,
              )
            }
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={
                submitting || !keywordInput.trim() || !cronInput.trim() || targetUrls.length === 0
              }
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add keyword'}
            </button>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          </div>
        </form>
      </Modal>

      <Modal open={editingKeyword !== null} onClose={closeEdit} title="Edit keyword">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-keyword" className="text-xs font-medium text-gray-500">
              Keyword
            </label>
            <input
              id="edit-keyword"
              value={editKeywordInput}
              onChange={(e) => setEditKeywordInput(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <CronBuilder
            idPrefix="edit-cron"
            cron={editCronInput}
            fields={editCronFields}
            onPreset={(value) => {
              setEditCronInput(value);
              setEditCronFields(splitCron(value));
            }}
            onFieldChange={(key, value) => setEditCronFields((f) => ({ ...f, [key]: value }))}
            onApplyFields={() =>
              setEditCronInput(
                `${editCronFields.minute} ${editCronFields.hour} ${editCronFields.day} ${editCronFields.month} ${editCronFields.week}`,
              )
            }
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={editSubmitting || !editKeywordInput.trim() || !editCronInput.trim()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {editSubmitting ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={closeEdit}
              disabled={editSubmitting}
              className="text-sm font-medium text-gray-500 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
          </div>
        </form>
      </Modal>

      {keywords.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
          No keywords configured.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Cron
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Target URLs
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Added
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw) => (
                <tr key={kw._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3.5 font-semibold text-gray-900">{kw.keyword}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-700">{describeCron(kw.cron) ?? 'Custom schedule'}</div>
                    <div className="font-mono text-xs text-gray-400">{kw.cron}</div>
                  </td>
                  <td className="max-w-[220px] px-4 py-3.5">
                    {kw.targetUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-blue-600 hover:underline"
                        title={url}
                      >
                        {url}
                      </a>
                    ))}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${
                        kw.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {kw.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">
                    {new Date(kw.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(kw)}
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(kw._id, !kw.enabled)}
                        disabled={togglingId === kw._id}
                        className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {kw.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KeywordManager;
