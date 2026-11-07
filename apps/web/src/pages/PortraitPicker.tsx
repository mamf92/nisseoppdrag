import { useState } from 'react';
import type { FormEvent } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button, NisseAvatar, PORTRAITS } from '../ui';
import type { PortraitId } from '../ui';

// A fixed set of painted portraits plus the drawn nisse ('' in the form). Radios inside labels,
// so the grid works with arrow keys and screen readers like any radio group.
export function PortraitPicker({
  value,
  onCancel,
  onSubmit,
}: {
  value: PortraitId | null;
  onCancel: () => void;
  onSubmit: (portrait: PortraitId | null) => Promise<void>;
}) {
  const t = useT();
  const [picked, setPicked] = useState<PortraitId | null>(value);
  const [busy, setBusy] = useState(false);
  const options: readonly (PortraitId | null)[] = [null, ...PORTRAITS];
  const label = (id: PortraitId | null) => t(id ? `portrait.${id}` : 'portrait.default');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit(picked);
    setBusy(false);
  }

  return (
    <form className="n-form" onSubmit={(e) => void submit(e)}>
      <p>{t('portrait.lead')}</p>
      <div className="n-portrait-preview" aria-live="polite">
        <NisseAvatar portrait={picked} size={112} />
        <p>{label(picked)}</p>
      </div>
      <fieldset className="n-portrait-grid">
        <legend className="sr-only">{t('portrait.choose')}</legend>
        {options.map((id) => (
          <label key={id ?? 'default'} title={label(id)}>
            <input
              type="radio"
              name="portrait"
              value={id ?? ''}
              checked={picked === id}
              onChange={() => {
                setPicked(id);
              }}
            />
            <NisseAvatar portrait={id} size={60} />
            <span className="sr-only">{label(id)}</span>
          </label>
        ))}
      </fieldset>
      <div className="n-row">
        <Button type="submit" disabled={busy || picked === value}>
          {t('portrait.use')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
