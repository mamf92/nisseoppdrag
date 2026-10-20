import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';

export type ToastTone = 'info' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const LIFETIME_MS = 5000;

// The live regions are always in the DOM so that screen readers announce what appears in them:
// polite for information, assertive for errors.
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((all) => all.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { id, message, tone }]);
      timers.current.set(
        id,
        window.setTimeout(() => {
          dismiss(id);
        }, LIFETIME_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((timer) => {
        window.clearTimeout(timer);
      });
      active.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  const renderRegion = (tone: ToastTone, role: 'status' | 'alert') => (
    <div
      className="n-toast-region"
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {toasts
        .filter((item) => item.tone === tone)
        .map((item) => (
          <div key={item.id} className={cx('n-toast', tone === 'error' && 'n-toast--error')}>
            <span>{item.message}</span>
            <button
              type="button"
              onClick={() => {
                dismiss(item.id);
              }}
            >
              {t('toast.close')}
            </button>
          </div>
        ))}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="n-toast-stack">
        {renderRegion('info', 'status')}
        {renderRegion('error', 'alert')}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
