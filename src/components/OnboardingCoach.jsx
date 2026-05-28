import { useEffect, useMemo, useState } from 'react';

import Icon from './Icon.jsx';

const ONBOARDING_VERSION = 10;
const LOCAL_KEY = 'nexusChat.onboarding.v10';

export default function OnboardingCoach({ profile, accountProfile, isLoggedIn = false, onComplete, onFeedback }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const steps = useMemo(() => getSteps(isLoggedIn), [isLoggedIn]);

  useEffect(() => {
    if (!profile?.sessionId) {
      setVisible(false);
      return;
    }

    const serverDone = Number(accountProfile?.settings?.onboardingVersion || 0) >= ONBOARDING_VERSION;
    const localDone = localStorage.getItem(getLocalKey(profile, isLoggedIn)) === 'done';
    setVisible(!serverDone && !localDone);
    setStep(0);
  }, [profile?.sessionId, profile?.userId, isLoggedIn, accountProfile?.settings?.onboardingVersion]);

  if (!visible) {
    return null;
  }

  const current = steps[step];
  const finalStep = step === steps.length - 1;

  function complete() {
    localStorage.setItem(getLocalKey(profile, isLoggedIn), 'done');
    setVisible(false);
    onComplete?.(ONBOARDING_VERSION);
  }

  return (
    <aside className="onboarding-coach glass-panel" aria-live="polite">
      <div className="onboarding-coach__rail" aria-hidden="true">
        {steps.map((item, index) => (
          <i className={index <= step ? 'is-active' : ''} key={item.title} />
        ))}
      </div>
      <button className="icon-button onboarding-coach__close" type="button" onClick={complete} aria-label="Skip onboarding">
        <Icon name="close" size={17} />
      </button>
      <p className="eyebrow">{isLoggedIn ? 'Account launch guide' : 'Guest launch guide'}</p>
      <h2>{current.title}</h2>
      <p>{current.body}</p>
      {current.safety && <strong className="onboarding-safety">{current.safety}</strong>}
      <div className="onboarding-coach__actions">
        {current.feedback && (
          <button className="button button--ghost button--small" type="button" onClick={onFeedback}>
            Feedback
          </button>
        )}
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => (finalStep ? complete() : setStep((currentStep) => currentStep + 1))}
        >
          {finalStep ? 'Enter Nexus' : 'Next'}
        </button>
      </div>
    </aside>
  );
}

function getSteps(isLoggedIn) {
  if (isLoggedIn) {
    return [
      { title: 'Complete your profile', body: 'Your Google-backed identity can keep a display name, portrait, and room memory across devices.' },
      { title: 'Save rooms that matter', body: 'Favorites, My Rooms, notifications, and unread markers help you return to live conversations.' },
      { title: 'Alerts stay calm', body: 'Mentions, replies, and announcements arrive in the bell without turning rooms into noisy feeds.' },
      {
        title: 'Safety travels first',
        body: 'Premium hosting and communities are optional. Chat and safety stay available.',
        safety: 'Never share OTPs, passwords, phone numbers, addresses, payment details, or private documents.',
        feedback: true,
      },
    ];
  }

  return [
    { title: 'Your guest identity is ready', body: 'Use this browser profile to create or join rooms quickly without being forced into login.' },
    { title: 'Choose a room path', body: 'Explore public rooms, create a room, or open a private invite when someone shares one.' },
    {
      title: 'Safety before speed',
      body: 'Report suspicious behavior and use block tools early when a conversation turns wrong.',
      safety: 'Do not share OTPs, passwords, phone numbers, addresses, payment details, or private documents.',
    },
    { title: 'Chat tips', body: 'Replies keep context close. Reactions stay lightweight. Feedback helps shape the launch.', feedback: true },
  ];
}

function getLocalKey(profile, isLoggedIn) {
  return `${LOCAL_KEY}.${isLoggedIn ? profile?.userId || 'account' : 'guest'}`;
}
