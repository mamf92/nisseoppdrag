import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  /** Error text from the form or the server. Shown under the field and announced. */
  error?: string | undefined;
}

export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className="n-field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span id={hintId} className="n-field__hint">
          {hint}
        </span>
      ) : null}
      <input
        {...input}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {error ? (
        <p id={errorId} className="n-field__error">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
