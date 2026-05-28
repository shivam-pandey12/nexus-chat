import { useEffect, useState } from 'react';

import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

const FEEDBACK_OPTIONS = [
  ['feedback', 'Feedback'],
  ['bug_report', 'Bug report'],
  ['abuse_safety_concern', 'Safety concern'],
  ['billing_issue', 'Billing issue'],
  ['feature_suggestion', 'Feature idea'],
];

export default function FeedbackModal({ open = false, profile, page = '', roomId = '', onClose, onSubmit }) {
  const [draft, setDraft] = useState(() => emptyDraft(profile));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft(profile));
    }
  }, [open, profile?.displayName, profile?.email]);

  if (!open) {
    return null;
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit?.({
        ...draft,
        page,
        roomId,
        context: page ? `View: ${page}` : '',
      });
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop feedback-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className={cn('modal-shell feedback-modal glass-panel', tw.glass, 'w-[min(94vw,680px)] space-y-5 p-5 sm:p-7')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button feedback-modal__close" type="button" onClick={onClose} aria-label="Close feedback">
          <Icon name="close" size={18} />
        </button>
        <header>
          <p className="eyebrow">Launch feedback</p>
          <h2 id="feedback-title">Tell MH Horizon what you found</h2>
          <p>Report bugs, billing trouble, safety concerns, and launch polish notes without leaving Nexus Chat.</p>
        </header>
        <div className="feedback-type-grid" role="radiogroup" aria-label="Feedback type">
          {FEEDBACK_OPTIONS.map(([value, label]) => (
            <button
              className={cn(`feedback-type ${draft.type === value ? 'is-active' : ''}`, 'rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-4 py-3 text-sm font-black transition-all hover:-translate-y-0.5', draft.type === value ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.type === value}
              onClick={() => setDraft((current) => ({ ...current, type: value }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="feedback-fields">
          <label className="field">
            <span>Title</span>
            <input
              className={tw.input}
              value={draft.title}
              maxLength={90}
              placeholder="What needs attention?"
              required
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea
              className={tw.input}
              value={draft.message}
              maxLength={1200}
              placeholder="Steps, context, what you expected, or what felt off."
              required
              onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
            />
          </label>
          <div className="feedback-contact-grid">
            <label className="field">
              <span>Name</span>
              <input
                className={tw.input}
                value={draft.name}
                maxLength={48}
                placeholder="Optional"
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className={tw.input}
                value={draft.email}
                maxLength={180}
                type="email"
                placeholder="Optional reply contact"
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
          </div>
        </div>
        <footer className="feedback-modal__actions">
          <span className="status-pill">{profile?.userId ? 'Account context attached' : 'Guest feedback welcome'}</span>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="submit" disabled={saving}>
            <Icon name="sparkle" size={17} />
            {saving ? 'Sending...' : 'Send Feedback'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function emptyDraft(profile) {
  return {
    type: 'feedback',
    title: '',
    message: '',
    name: profile?.displayName || '',
    email: profile?.email || '',
  };
}
