import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { Button } from './Button';

// A modal sheet on the native <dialog>: focus is trapped, Escape closes it and focus returns to
// the opener. It slides up from the bottom on phones and in from the right from 768 px.
export function Sheet({
  open,
  onClose,
  title,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Room for two columns from 768 px, for sheets that hold a form next to a preview. */
  wide?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom and very old browsers lack showModal; the sheet then opens non-modally.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    // The backdrop click is a convenience; Escape and the close button are the accessible ways out.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className={wide ? 'n-sheet n-sheet--wide' : 'n-sheet'}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open ? (
        <>
          <div className="n-sheet__head">
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" onClick={onClose}>
              {t('sheet.close')}
            </Button>
          </div>
          <div className="n-sheet__body">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
