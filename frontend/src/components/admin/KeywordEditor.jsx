import { useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api.js';
import { readableTextOn } from '../../lib/color.js';
import { Button, Field, SectionCard, Select, TextInput } from './ui.jsx';

// 164 keywords ship by default, so the list is capped and searchable rather than
// rendering everything at once.
const VISIBLE_LIMIT = 40;

/**
 * Maps a word in the classifier's output to a category.
 *
 * This is the live fix for a wrong guess: if the model calls something
 * "milk can" and it lands in the wrong bin, add or move the keyword here and the
 * next scan is correct — no code change, no restart.
 */
export default function KeywordEditor({ mappings, categories, onFlash }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [errors, setErrors] = useState({});
  const [busyId, setBusyId] = useState(null);

  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mappings.filter((m) => {
      if (categoryFilter !== 'all' && String(m.categoryId) !== categoryFilter) return false;
      return !q || m.keyword.includes(q);
    });
  }, [mappings, query, categoryFilter]);

  const add = async () => {
    setErrors({});
    const categoryId = Number(newCategoryId || categories[0]?.id);
    if (!categoryId) {
      onFlash({ tone: 'error', message: 'Create a category first' });
      return;
    }
    try {
      const created = await api.createMapping({ keyword: newKeyword, categoryId });
      setNewKeyword('');
      onFlash({ message: `“${created.keyword}” → ${created.categoryName}` });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      else onFlash({ tone: 'error', message: err.message });
    }
  };

  const move = async (mapping, categoryId) => {
    setBusyId(mapping.id);
    try {
      const updated = await api.updateMapping(mapping.id, { categoryId: Number(categoryId) });
      onFlash({ message: `“${updated.keyword}” → ${updated.categoryName}` });
    } catch (err) {
      onFlash({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (mapping) => {
    setBusyId(mapping.id);
    try {
      await api.deleteMapping(mapping.id);
      onFlash({ message: `Removed “${mapping.keyword}”` });
    } catch (err) {
      onFlash({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionCard
      title="Keyword mappings"
      description="The classifier names an object; the matching keyword decides its category. Longer keywords win, so “plastic bag” beats “bag”."
    >
      {/* ---- add ---- */}
      <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-3.5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="New keyword" error={errors.keyword} hint="Lower-cased automatically. Matched inside the model's label.">
            <TextInput
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newKeyword.trim() && add()}
              error={errors.keyword}
              placeholder="e.g. milk can"
              maxLength={60}
            />
          </Field>
          <Field label="Category" error={errors.categoryId}>
            <Select
              value={newCategoryId || categories[0]?.id || ''}
              onChange={(e) => setNewCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button tone="primary" onClick={add} disabled={!newKeyword.trim()}>
          Add keyword
        </Button>
      </div>

      {/* ---- filters ---- */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${mappings.length} keywords…`}
        />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-white/35">
        Showing {Math.min(filtered.length, VISIBLE_LIMIT)} of {filtered.length} matching
        {filtered.length !== mappings.length && ` (${mappings.length} total)`}
      </p>

      {/* ---- list ---- */}
      <ul className="space-y-1.5">
        {filtered.slice(0, VISIBLE_LIMIT).map((mapping) => {
          const category = categoriesById[mapping.categoryId];
          const color = category?.color ?? '#94a3b8';
          return (
            <li
              key={mapping.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/85">
                {mapping.keyword}
              </span>

              <span
                className="hidden shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold sm:inline"
                style={{ backgroundColor: color, color: readableTextOn(color) }}
              >
                {category?.name ?? '—'}
              </span>

              <select
                value={mapping.categoryId}
                onChange={(e) => move(mapping, e.target.value)}
                disabled={busyId === mapping.id}
                aria-label={`Category for ${mapping.keyword}`}
                className="shrink-0 rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs text-white outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => remove(mapping)}
                disabled={busyId === mapping.id}
                aria-label={`Remove ${mapping.keyword}`}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-white/40 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/4 p-3 text-sm text-white/50">
          No keywords match. Clear the search, or add “{query.trim() || 'a keyword'}” above.
        </p>
      )}
    </SectionCard>
  );
}
