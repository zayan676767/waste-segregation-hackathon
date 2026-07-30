import { useState } from 'react';
import { api, ApiError } from '../../lib/api.js';
import { readableTextOn, tint } from '../../lib/color.js';
import { Button, ConfirmButton, Field, SectionCard, TextArea, TextInput } from './ui.jsx';

/**
 * Categories are the heart of the "nothing hardcoded" rule: name, colour,
 * disposal tip and impact text all live here and propagate to the scan page and
 * dashboard over Socket.IO the moment they are saved.
 */
export default function CategoryEditor({ categories, mappings, onFlash }) {
  const [editingId, setEditingId] = useState(null); // id | 'new' | null

  return (
    <SectionCard
      title="Categories"
      description="Name, colour, disposal tip and impact text. Saving updates every connected device instantly."
      action={
        editingId !== 'new' && (
          <Button tone="primary" onClick={() => setEditingId('new')}>
            + Add
          </Button>
        )
      }
    >
      {editingId === 'new' && (
        <CategoryForm
          key="new"
          onCancel={() => setEditingId(null)}
          onSaved={(msg) => {
            setEditingId(null);
            onFlash(msg);
          }}
          onFlash={onFlash}
        />
      )}

      <ul className="space-y-2.5">
        {categories.map((category) => {
          const keywordCount = mappings.filter((m) => m.categoryId === category.id).length;

          return (
            <li key={category.id}>
              {editingId === category.id ? (
                /* Keyed by id so opening a different row starts from that row's
                   values rather than reusing the previous draft. */
                <CategoryForm
                  key={category.id}
                  initial={category}
                  keywordCount={keywordCount}
                  onCancel={() => setEditingId(null)}
                  onSaved={(msg) => {
                    setEditingId(null);
                    onFlash(msg);
                  }}
                  onFlash={onFlash}
                />
              ) : (
                <CategoryRow
                  category={category}
                  keywordCount={keywordCount}
                  onEdit={() => setEditingId(category.id)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {categories.length === 0 && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/8 p-3 text-sm text-amber-100/85">
          No categories exist, so nothing can be classified. Add at least one.
        </p>
      )}
    </SectionCard>
  );
}

function CategoryRow({ category, keywordCount, onEdit }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3"
      style={{ borderColor: tint(category.color, 0.28), backgroundColor: tint(category.color, 0.07) }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold"
        style={{ backgroundColor: category.color, color: readableTextOn(category.color) }}
        aria-hidden="true"
      >
        {category.name.slice(0, 2).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{category.name}</p>
        <p className="truncate text-xs text-white/45">
          {keywordCount} keyword{keywordCount === 1 ? '' : 's'} ·{' '}
          <span className="font-mono">{category.color}</span>
        </p>
      </div>

      <Button onClick={onEdit}>Edit</Button>
    </div>
  );
}

const BLANK = { name: '', color: '#22c55e', disposalTip: '', impactText: '' };

function CategoryForm({ initial, keywordCount = 0, onCancel, onSaved, onFlash }) {
  // Draft state is local and initialised once. Live socket updates re-render the
  // parent list but cannot reach in here and overwrite half-typed input.
  const [draft, setDraft] = useState(
    initial
      ? {
          name: initial.name,
          color: initial.color,
          disposalTip: initial.disposalTip,
          impactText: initial.impactText
        }
      : BLANK
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (initial) {
        await api.updateCategory(initial.id, draft);
        onSaved({ message: `Saved “${draft.name}”` });
      } else {
        await api.createCategory(draft);
        onSaved({ message: `Added “${draft.name}”` });
      }
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors(err.fieldErrors);
      } else {
        onFlash({ tone: 'error', message: err.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      const result = await api.deleteCategory(initial.id);
      onSaved({
        message: `Deleted “${result.name}”${
          result.deletedScans ? ` and ${result.deletedScans} scan(s)` : ''
        }`
      });
    } catch (err) {
      onFlash({ tone: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-3.5 rounded-2xl border border-white/15 bg-white/6 p-4">
      <Field label="Name" error={errors.name}>
        <TextInput
          value={draft.name}
          onChange={set('name')}
          error={errors.name}
          placeholder="e.g. Recyclable"
          maxLength={60}
        />
      </Field>

      <Field label="Display colour" error={errors.color} hint="Used for the result card, chart and badges.">
        <div className="flex items-center gap-2.5">
          {/* Native picker always yields a valid 6-digit hex; the text field
              stays editable for pasting an exact brand colour. */}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : '#22c55e'}
            onChange={set('color')}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-white/12 bg-transparent p-1"
            aria-label="Colour picker"
          />
          <TextInput
            value={draft.color}
            onChange={set('color')}
            error={errors.color}
            placeholder="#22c55e"
            spellCheck={false}
            className="font-mono"
          />
        </div>
      </Field>

      <Field label="Disposal tip" error={errors.disposalTip} hint="Shown on the result card under “How to dispose of this”.">
        <TextArea value={draft.disposalTip} onChange={set('disposalTip')} rows={3} />
      </Field>

      <Field label="Environmental impact" error={errors.impactText} hint="Shown under “Environmental impact”.">
        <TextArea value={draft.impactText} onChange={set('impactText')} rows={3} />
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button tone="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add category'}
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>

      {initial && (
        <div className="border-t border-white/10 pt-3">
          <ConfirmButton
            label="Delete category"
            confirmLabel="Yes, delete it"
            warning={`Deleting “${initial.name}” also permanently removes its ${keywordCount} keyword mapping(s) and every scan recorded against it. This cannot be undone.`}
            onConfirm={remove}
            disabled={saving}
          />
        </div>
      )}
    </div>
  );
}
