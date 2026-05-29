import { useState } from 'react';

import { AVATARS } from '../data/avatars.js';
import { createGuestProfile } from '../utils/profile.js';
import AvatarBadge from './AvatarBadge.jsx';
import { cn, tw } from './ui/premium.js';

export default function GuestEntry({
  onComplete,
  onGoogleSignIn,
  onEmailAuth,
  googleEnabled = false,
  googleLoading = false,
  emailEnabled = false,
  emailLoading = false,
  guestEnabled = true,
  signupsEnabled = true,
}) {
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0].id);
  const [emailMode, setEmailMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const cleanLength = displayName.trim().length;
  const helperText = cleanLength === 0
    ? 'Skip it and Nexus will choose a safe guest name.'
    : cleanLength > 20
      ? 'Almost full. Keep names short and readable.'
      : 'This name appears in rooms.';

  function handleSubmit(event) {
    event.preventDefault();

    if (!guestEnabled) {
      return;
    }

    onComplete(createGuestProfile({ displayName, avatar }));
  }

  function handleGoogleSignIn() {
    onGoogleSignIn?.({ displayName, avatar });
  }

  function handleEmailSubmit() {
    onEmailAuth?.({
      mode: emailMode,
      email,
      password,
      displayName,
      avatar,
    });
  }

  function handleEmailKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleEmailSubmit();
    }
  }

  return (
    <main className={cn('auth-shell premium-page', tw.page, 'flex min-h-[calc(100vh-110px)] items-center justify-center')}>
      <form className={cn('panel guest-card entrance-card glass-panel', tw.glass, 'w-full max-w-2xl space-y-5 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="guest-card__halo" aria-hidden="true" />
        <div className="guest-card__head space-y-3">
          <p className={cn('eyebrow', tw.eyebrow)}>Nexus identity</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Choose your Nexus identity</h1>
          <p className={cn('muted', tw.subcopy)}>Guest mode is quick and local. Google or email login saves your profile, rooms, and premium access.</p>
        </div>

        <div className="identity-mode-grid grid gap-3 sm:grid-cols-2" aria-label="Profile mode comparison">
          <div className="identity-mode is-active">
            <strong>Guest</strong>
            <span>Fast temporary identity</span>
          </div>
          <div className="identity-mode">
            <strong>Account</strong>
            <span>Google or email login</span>
          </div>
        </div>

        <label className="field">
          <span>Display name</span>
          <input
            className={tw.input}
            maxLength={24}
            value={displayName}
            placeholder="Guest"
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <small>{helperText}</small>
        </label>

        <div className="avatar-picker grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose avatar">
          {AVATARS.map((item) => (
            <button
              className={cn(`avatar-option ${avatar === item.id ? 'is-active' : ''}`, 'min-h-[96px] rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5', avatar === item.id ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_74%)]' : '')}
              key={item.id}
              type="button"
              role="radio"
              aria-checked={avatar === item.id}
              onClick={() => setAvatar(item.id)}
            >
              <AvatarBadge avatarId={item.id} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {!guestEnabled && (
          <div className="notice notice--error launch-gate-notice">
            Guest chat is paused for this launch mode. Google entry may still be available.
          </div>
        )}
        <button className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')} type="submit" disabled={!guestEnabled}>
          {guestEnabled ? 'Continue as Guest' : 'Guest Chat Paused'}
        </button>
        {googleEnabled && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <button
              className={cn('button button--soft button--wide', tw.buttonSoft, 'w-full')}
              type="button"
              disabled={googleLoading || !signupsEnabled}
              onClick={handleGoogleSignIn}
            >
              {googleLoading ? 'Opening Google...' : signupsEnabled ? 'Continue with Google' : 'Google Login Paused'}
            </button>
            <small className="auth-note">
              {signupsEnabled ? 'Optional. Guest rooms stay open without login.' : 'New Google entry is disabled for this launch mode.'}
            </small>
          </>
        )}
        {emailEnabled && (
          <section className={cn('email-auth-card', tw.cardCompact, 'space-y-3')}>
            <div className="email-auth-card__head">
              <div>
                <strong>Email account</strong>
                <span>Use Firebase email and password login.</span>
              </div>
              <div className="email-auth-toggle" role="tablist" aria-label="Email auth mode">
                <button className={emailMode === 'signin' ? 'is-active' : ''} type="button" onClick={() => setEmailMode('signin')}>
                  Sign in
                </button>
                <button className={emailMode === 'signup' ? 'is-active' : ''} type="button" onClick={() => setEmailMode('signup')} disabled={!signupsEnabled}>
                  Create
                </button>
              </div>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                className={tw.input}
                type="email"
                value={email}
                placeholder="you@example.com"
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleEmailKeyDown}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className={tw.input}
                type="password"
                value={password}
                placeholder={emailMode === 'signup' ? 'Create a strong password' : 'Your password'}
                autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handleEmailKeyDown}
              />
            </label>
            <button
              className={cn('button button--ghost button--wide', tw.buttonGhost, 'w-full')}
              type="button"
              disabled={emailLoading || !email || password.length < 6 || (emailMode === 'signup' && !signupsEnabled)}
              onClick={handleEmailSubmit}
            >
              {emailLoading
                ? 'Checking account...'
                : emailMode === 'signup'
                  ? signupsEnabled ? 'Create Email Account' : 'Email Sign-up Paused'
                  : 'Sign in with Email'}
            </button>
            <small className="auth-note">
              {emailMode === 'signup' ? 'Use at least 6 characters. You can still choose a Nexus avatar.' : 'Sign in to your existing Firebase email account.'}
            </small>
          </section>
        )}
      </form>
    </main>
  );
}
