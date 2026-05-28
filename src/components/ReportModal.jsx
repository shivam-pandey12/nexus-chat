import { useState } from 'react';

import { REPORT_REASONS } from '../../shared/chatConfig.js';
import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

export default function ReportModal({ reportTarget, onClose, onSubmit }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');

  if (!reportTarget) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...reportTarget,
      reason,
      details,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className={cn('modal-panel report-modal', tw.glass, 'w-[min(94vw,560px)] space-y-5 p-5 sm:p-6')} onSubmit={handleSubmit}>
        <div className="modal-panel__header">
          <div>
            <p className="eyebrow">Report</p>
            <h2>{reportTarget.label}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close report form">
            <Icon name="close" size={18} />
          </button>
        </div>
        <label className="field">
          <span>Reason</span>
          <select className={tw.input} value={reason} onChange={(event) => setReason(event.target.value)}>
            {REPORT_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Details</span>
          <textarea
            className={tw.input}
            maxLength={400}
            value={details}
            placeholder="Optional context for review"
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="submit">
            Send Report
          </button>
        </div>
      </form>
    </div>
  );
}
