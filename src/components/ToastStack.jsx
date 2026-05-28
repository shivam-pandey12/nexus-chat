import { cn } from './ui/premium.js';

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button
          className={cn(`toast toast--${toast.type || 'info'}`, 'rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 shadow-[var(--shadow)] backdrop-blur-2xl transition-all hover:-translate-y-0.5')}
          key={toast.id}
          type="button"
          aria-label={`Dismiss notification: ${toast.message}`}
          onClick={() => onDismiss(toast.id)}
        >
          <span className="toast__mark" aria-hidden="true" />
          {toast.message}
        </button>
      ))}
    </div>
  );
}
