import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api.js';
import { Button, Field, SectionCard, TextInput } from './ui.jsx';

/**
 * Confidence threshold and the other tunables.
 *
 * Unit note: the threshold is stored as a FRACTION (0-1) everywhere — database,
 * API and classifier — and only shown as a percentage here. The conversion
 * happens at this boundary and nowhere else.
 */
export default function SettingsEditor({ settings, onFlash }) {
  const toDraft = (s) => ({
    thresholdPct: Math.round((s.confidence_threshold ?? 0.6) * 100),
    app_title: s.app_title ?? '',
    unsure_message: s.unsure_message ?? ''
  });

  const [draft, setDraft] = useState(() => toDraft(settings));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  // The values this draft started from. Saving diffs against THIS, not against
  // the latest server state, so a field left alone is never written back — see
  // the comment in save().
  const baseline = useRef(toDraft(settings));

  // Settings arrive over Socket.IO (another device may change them mid-session).
  // Accept those updates only while this form is untouched — otherwise an
  // incoming broadcast would wipe out what is being typed right now.
  useEffect(() => {
    if (!dirty.current) {
      const next = toDraft(settings);
      setDraft(next);
      baseline.current = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const set = (key, value) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = async () => {
    // Send only the fields the USER edited, by diffing against the baseline this
    // draft started from. Diffing against the current server state instead would
    // treat a field left untouched as an edit whenever someone changed it
    // elsewhere — and write the stale draft value back over their change.
    const base = baseline.current;
    const payload = {};

    if (draft.thresholdPct !== base.thresholdPct) {
      payload.confidence_threshold = draft.thresholdPct / 100;
    }
    if (draft.app_title !== base.app_title) payload.app_title = draft.app_title;
    if (draft.unsure_message !== base.unsure_message) {
      payload.unsure_message = draft.unsure_message;
    }

    if (Object.keys(payload).length === 0) {
      dirty.current = false;
      onFlash({ message: 'Nothing to save — no changes' });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await api.updateSettings(payload);
      dirty.current = false;
      // The saved draft becomes the new baseline, so a second save in a row does
      // not re-send fields that are already persisted.
      baseline.current = draft;
      onFlash({ message: 'Settings saved — every device updated' });
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

  const reset = () => {
    dirty.current = false;
    const next = toDraft(settings);
    setDraft(next);
    baseline.current = next;
    setErrors({});
  };

  return (
    <SectionCard
      title="Settings"
      description="Applied live on every connected phone and dashboard."
    >
      <Field
        label={`Confidence threshold — ${draft.thresholdPct}%`}
        error={errors.confidence_threshold}
        hint="Below this, the app shows the “unsure” message instead of a confident guess. 25% suits real photos: the score is a category total, and measured values run 50–90% for clear items."
      >
        <div className="space-y-2">
          <input
            type="range"
            min={5}
            max={95}
            step={1}
            value={draft.thresholdPct}
            onChange={(e) => set('thresholdPct', Number(e.target.value))}
            className="w-full accent-emerald-400"
            aria-label="Confidence threshold percentage"
          />
          <div className="flex justify-between text-[10px] eyebrow text-white/30">
            <span>5% · trusting</span>
            <span>95% · strict</span>
          </div>
        </div>
      </Field>

      <Field label="App title" error={errors.app_title}>
        <TextInput
          value={draft.app_title}
          onChange={(e) => set('app_title', e.target.value)}
          error={errors.app_title}
          maxLength={120}
        />
      </Field>

      <Field
        label="“Unsure” message"
        error={errors.unsure_message}
        hint="Shown when confidence falls below the threshold."
      >
        <TextInput
          value={draft.unsure_message}
          onChange={(e) => set('unsure_message', e.target.value)}
          error={errors.unsure_message}
          maxLength={200}
        />
      </Field>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button tone="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        <Button onClick={reset} disabled={saving}>
          Revert
        </Button>
      </div>
    </SectionCard>
  );
}
