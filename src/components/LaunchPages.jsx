import { useEffect, useState } from 'react';

import { fetchStatus } from '../services/api.js';
import { cn, tw } from './ui/premium.js';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@mhhorizon.example';

const PAGE_COPY = {
  privacy: {
    eyebrow: 'Launch placeholder',
    title: 'Privacy Policy',
    intro:
      'This plain-language draft explains how Nexus Chat expects to handle account, guest, room, moderation, and billing data. Owner/legal review is required before public launch.',
    sections: [
      ['Account and guest data', 'Google/email login profiles, guest session IDs, display names, avatars, and local preferences may be used to keep chat identity and room history working.'],
      ['Rooms and messages', 'Rooms, messages, replies, reactions, reports, moderation logs, announcements, and notifications may be stored when persistence is enabled.'],
      ['Push notifications', 'If enabled by the owner and accepted by you, Nexus may store Firebase Cloud Messaging browser tokens under your account so mentions, replies, announcements, event reminders, safety updates, and billing notices can reach your device. You can disable push in profile settings.'],
      ['Billing records', 'Razorpay payment status, entitlements, product IDs, and safe billing metadata are stored by the backend. Raw secrets and private keys are never shown in the app UI.'],
      ['Local storage', 'Guest identity, blocks, room recents, theme, local notification preferences, install-prompt state, and app-shell cache metadata may be stored in your browser.'],
      ['Contact', `For privacy questions, contact ${SUPPORT_EMAIL}. Replace this placeholder before launch.`],
    ],
  },
  terms: {
    eyebrow: 'Launch placeholder',
    title: 'Terms of Use',
    intro:
      'These draft terms are a starting point for Nexus Chat public launch. They are not final legal advice and need owner/legal review.',
    sections: [
      ['Acceptable use', 'Use Nexus Chat for respectful people-to-people conversations. Abuse, harassment, spam, scams, impersonation, and illegal activity are not allowed.'],
      ['Room owner duties', 'Room and community owners are responsible for using moderation tools calmly and keeping their spaces safe.'],
      ['Temporary rooms', 'Temporary rooms may expire, close, or lose history depending on configured retention and availability.'],
      ['Premium features', 'Premium plans and cosmetics unlock hosting and identity benefits, but basic chat and safety tools remain free.'],
      ['Enforcement', 'MH Horizon may remove rooms, restrict accounts, or revoke abusive access to protect users and the service.'],
    ],
  },
  'refund-policy': {
    eyebrow: 'Launch placeholder',
    title: 'Refund Policy',
    intro:
      'This refund draft covers digital services, passes, and cosmetics at a high level. Customize it before accepting production payments.',
    sections: [
      ['Digital access', 'Plans, passes, and cosmetics are digital products. Refund eligibility should be reviewed against Razorpay settings and applicable law before launch.'],
      ['Failed payments', 'If money is deducted but premium access is not granted, keep the Razorpay payment ID and contact support.'],
      ['Cosmetics', 'One-time cosmetic purchases should be reviewed carefully before buying because they may be delivered instantly.'],
      ['Contact', `Billing support placeholder: ${SUPPORT_EMAIL}. Replace this before launch.`],
    ],
  },
  safety: {
    eyebrow: 'Nexus safety',
    title: 'Safety Center',
    intro:
      'Nexus Chat is for real people and real conversations. Keep private information private, use safety tools early, and report suspicious behavior.',
    sections: [
      ['Never share sensitive details', 'Do not share OTPs, passwords, phone numbers, addresses, payment details, private documents, or recovery codes.'],
      ['Report and block', 'Use report, block, mute, kick, and ban tools to keep rooms calm. Safety tools are not premium-gated.'],
      ['Room and community rules', 'Follow the rules shown in each room or community. Owners and moderators should keep rules clear and fair.'],
      ['Payments', 'Do not send money to other users because someone asks in chat. Nexus billing happens only through official app billing flows.'],
      ['Notification privacy', 'Nexus push notifications use short, safe text and should not include OTPs, passwords, payment details, private documents, or full sensitive chat content.'],
      ['Emergencies', 'Nexus Chat is not an emergency service. Contact local authorities or trusted support if someone is in immediate danger.'],
    ],
  },
  contact: {
    eyebrow: 'MH Horizon support',
    title: 'Contact Nexus Chat',
    intro:
      'Use this placeholder contact page for launch preparation. Replace the email and support process before going fully public.',
    sections: [
      ['Support email', SUPPORT_EMAIL],
      ['Safety reports', 'Use in-app reports first when possible so moderators receive room, message, and user context safely.'],
      ['Billing support', 'Include your account email, product name, date, and Razorpay payment ID when asking about payments.'],
      ['Business and ecosystem', 'Nexus Chat is part of MH Horizon. Add official MH Horizon contact links before launch.'],
    ],
  },
};

export function LaunchPage({ pageKey = 'privacy', onNavigate, onFeedback }) {
  const page = PAGE_COPY[pageKey] || PAGE_COPY.privacy;

  return (
    <main className={cn('launch-page premium-page', tw.page, 'space-y-6')}>
      <section className={cn('launch-hero glass-panel', tw.glass, 'space-y-4 p-6 sm:p-8')}>
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <small className="launch-review-date">Last updated placeholder: May 2026. Owner review is required before public launch.</small>
        <div className="launch-actions">
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={() => onNavigate?.('explore')}>
            Explore Rooms
          </button>
          <button className="button button--ghost" type="button" onClick={() => onNavigate?.('safety')}>
            Safety Center
          </button>
          <button className="button button--soft" type="button" onClick={onFeedback}>
            Feedback
          </button>
        </div>
      </section>
      <section className="launch-grid grid gap-4 sm:grid-cols-2">
        {page.sections.map(([title, body]) => (
          <article className={cn('premium-card launch-card', tw.card)} key={title}>
            <span className="status-pill">Owner review required</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export function UpdatesPage({ onNavigate, onFeedback }) {
  const shelves = [
    ['Latest updates', 'Production status, optional Redis jobs, premium community/event rooms, and launch-readiness surfaces are now connected.'],
    ['Launch polish', 'Feedback intake, onboarding guidance, calmer error states, and legal/status pages make Nexus easier to test in public beta.'],
    ['Known limitations', 'Guest identity is browser-scoped. Voice, video, uploads, email notifications, and Discord-style channels are not active. Push notifications are optional and depend on browser, HTTPS, Firebase Cloud Messaging, and owner configuration.'],
    ['Coming next', 'Public launch feedback, deeper load testing, support workflows, owner-reviewed legal/payment operations, and delivery analytics for opted-in push.'],
  ];

  return (
    <main className={cn('launch-page updates-page premium-page', tw.page, 'space-y-6')}>
      <section className={cn('launch-hero glass-panel', tw.glass, 'space-y-4 p-6 sm:p-8')}>
        <p className="eyebrow">Nexus updates</p>
        <h1>Launch notes and honest limits.</h1>
        <p>What changed, what is ready to test, and what Nexus Chat deliberately keeps out of launch scope.</p>
        <div className="launch-actions">
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={() => onNavigate?.('explore')}>
            Explore Rooms
          </button>
          <button className="button button--soft" type="button" onClick={onFeedback}>
            Send Feedback
          </button>
        </div>
      </section>
      <section className="launch-grid updates-grid grid gap-4 sm:grid-cols-2">
        {shelves.map(([title, body]) => (
          <article className={cn('premium-card launch-card', tw.card)} key={title}>
            <span className="status-pill">Phase 10</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export function MaintenancePage({ onNavigate }) {
  return (
    <main className={cn('launch-page maintenance-page premium-page', tw.page, 'flex min-h-[60vh] items-center justify-center')}>
      <section className={cn('launch-hero glass-panel maintenance-hero', tw.glass, 'max-w-3xl space-y-4 p-8 text-center')}>
        <span className="maintenance-orbit" aria-hidden="true" />
        <p className="eyebrow">Launch maintenance</p>
        <h1>Nexus Chat is being tuned right now.</h1>
        <p>Rooms are paused while MH Horizon checks launch systems. Status stays visible and admin operations remain guarded.</p>
        <div className="launch-actions">
          <button className="button button--primary" type="button" onClick={() => onNavigate?.('status')}>
            View Status
          </button>
          <button className="button button--ghost" type="button" onClick={() => onNavigate?.('contact')}>
            Contact
          </button>
        </div>
      </section>
    </main>
  );
}

export function UnavailablePage({ title, body, onNavigate }) {
  return (
    <main className={cn('launch-page premium-page unavailable-page', tw.page, 'flex min-h-[60vh] items-center justify-center')}>
      <section className={cn('launch-hero glass-panel', tw.glass, 'max-w-3xl space-y-4 p-8 text-center')}>
        <p className="eyebrow">Launch mode</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="launch-actions">
          <button className="button button--primary" type="button" onClick={() => onNavigate?.('explore')}>
            Explore Rooms
          </button>
          <button className="button button--ghost" type="button" onClick={() => onNavigate?.('updates')}>
            Updates
          </button>
        </div>
      </section>
    </main>
  );
}

export function StatusPage({ onNavigate }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchStatus()
      .then((data) => {
        if (alive) {
          setStatus(data);
        }
      })
      .catch((requestError) => {
        if (alive) {
          setError(requestError.message);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className={cn('launch-page premium-page', tw.page, 'space-y-6')}>
      <section className={cn('launch-hero glass-panel', tw.glass, 'space-y-4 p-6 sm:p-8')}>
        <p className="eyebrow">Public system status</p>
        <h1>Nexus Chat Status</h1>
        <p>Safe launch-readiness signals for users. Detailed operational internals stay inside the admin panel.</p>
        <div className="launch-actions">
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={() => onNavigate?.('explore')}>
            Explore Rooms
          </button>
          <button className="button button--ghost" type="button" onClick={() => onNavigate?.('admin')}>
            Admin Ops
          </button>
        </div>
      </section>
      {error && <div className="notice notice--error">{error}</div>}
      <section className="status-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="App" value={status?.ok ? 'Operational' : 'Checking'} />
        <StatusCard label="Persistence" value={status?.persistence?.enabled ? 'Firestore' : 'Memory fallback'} />
        <StatusCard label="Redis" value={status?.redis?.state || 'fallback'} />
        <StatusCard label="Billing" value={status?.billing?.enabled ? 'Enabled' : 'Disabled'} />
        <StatusCard label="Jobs" value={status?.jobs?.enabled ? 'Enabled' : 'Disabled'} />
        <StatusCard label="Analytics" value={status?.analytics?.enabled ? 'Aggregate on' : 'No-op'} />
        <StatusCard label="PWA Shell" value={status?.pwa?.serviceWorker ? 'Ready' : 'Browser'} />
        <StatusCard label="Push" value={status?.pwa?.fcm?.ready ? 'Optional' : status?.pwa?.fcm?.enabled ? 'Config needed' : 'Disabled'} />
        <StatusCard label="Launch" value={status?.launch?.mode || 'checking'} />
        <StatusCard label="Maintenance" value={status?.launch?.maintenanceMode ? 'Paused' : 'Open'} />
      </section>
    </main>
  );
}

function StatusCard({ label, value }) {
  return (
    <article className={cn('dashboard-card status-card', tw.cardCompact)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
