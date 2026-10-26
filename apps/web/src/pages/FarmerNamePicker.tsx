import { useId, useState } from 'react';
import {
  FARM_NAMES,
  farmerName,
  freeFarms,
  freeFirstNames,
  randomFarmer,
} from '../auth/farmerName';
import type { FarmerChoice, TakenNames } from '../auth/farmerName';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="n-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

// Låven names are picked, not typed. One is chosen for you, from the names nobody has taken:
// shuffle it, or open the lists (first name and farm side by side, on every screen size).
export function FarmerNamePicker({
  value,
  taken,
  onChange,
  error,
}: {
  value: FarmerChoice;
  taken: TakenNames;
  onChange: (next: FarmerChoice) => void;
  error?: string | undefined;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const farms = freeFarms(value.first, taken);
  return (
    <div className="n-namepick">
      <div>
        <p className="n-namepick__label">{t('onboard.farmer.yours')}</p>
        <p className="n-namepick__name" aria-live="polite">
          {farmerName(value)}
        </p>
      </div>
      <div className="n-namepick__actions">
        <Button
          variant="ghost"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {t('onboard.farmer.change')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const next = randomFarmer(taken);
            if (next) onChange(next);
          }}
        >
          {t('onboard.farmer.random')}
        </Button>
      </div>
      {open ? (
        <div className="n-namepick__lists">
          <Select
            label={t('onboard.farmer.first')}
            value={value.first}
            options={freeFirstNames(taken)}
            onChange={(first) => {
              const free = freeFarms(first, taken);
              const farm = free.includes(value.farm) ? value.farm : (free[0] ?? FARM_NAMES[0]);
              onChange({ first, farm });
            }}
          />
          <Select
            label={t('onboard.farmer.farm')}
            value={value.farm}
            options={farms}
            onChange={(farm) => {
              onChange({ ...value, farm });
            }}
          />
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
