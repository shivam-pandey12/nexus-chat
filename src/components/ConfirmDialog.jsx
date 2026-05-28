import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

export default function ConfirmDialog({ confirmation, onCancel, onConfirm }) {
  if (!confirmation) {
    return null;
  }

  const {
    eyebrow = 'Confirm action',
    title = 'Are you sure?',
    body = 'Please confirm before continuing.',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    busy = false,
  } = confirmation;
  const isDanger = tone === 'danger';

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={busy ? undefined : onCancel}>
      <section
        className={cn('modal-panel confirm-card', tw.glass, 'w-[min(94vw,560px)] space-y-5 p-5 sm:p-6')}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-card__halo" aria-hidden="true" />
        <div className="modal-panel__header confirm-card__header">
          <div className="confirm-card__title">
            <span className={cn('confirm-card__icon', isDanger ? 'confirm-card__icon--danger' : 'confirm-card__icon--safe')}>
              <Icon name={isDanger ? 'shield' : 'check'} size={20} />
            </span>
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 id="confirm-dialog-title">{title}</h2>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel action" disabled={busy}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="confirm-card__body" id="confirm-dialog-body">{body}</p>

        <div className="confirm-card__actions">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={cn('button', isDanger ? 'button--danger' : 'button--primary', isDanger ? tw.dangerButton : tw.buttonPrimary)}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
