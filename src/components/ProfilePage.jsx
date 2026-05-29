import { useEffect, useState } from 'react';

import { PROFILE_COSMETICS } from '../../shared/billingCatalog.js';
import { AVATARS } from '../data/avatars.js';
import AvatarBadge from './AvatarBadge.jsx';
import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

export default function ProfilePage({
  profile,
  accountProfile,
  saving = false,
  isLoggedIn = false,
  billingSummary = null,
  blockedUsers = [],
  notificationPreferences = {},
  pwaState = {},
  pushState = {},
  pwaStatus = {},
  onInstallApp,
  onDismissInstall,
  onEnablePush,
  onDisablePush,
  onBack,
  onSave,
  onUnblock,
  onNotificationPreferences,
  onLogin,
  onLogout,
  onFeedback,
}) {
  const activeProfile = {
    ...(profile || {}),
    ...(accountProfile || {}),
    photoURL: accountProfile?.photoURL || profile?.photoURL || '',
    googlePhotoURL: profile?.googlePhotoURL || accountProfile?.photoURL || profile?.photoURL || '',
    email: accountProfile?.email || profile?.email || '',
  };
  const [displayName, setDisplayName] = useState(activeProfile?.displayName || '');
  const [avatar, setAvatar] = useState(activeProfile?.avatar || AVATARS[0].id);
  const [photoMode, setPhotoMode] = useState(activeProfile?.photoMode === 'avatar' ? 'avatar' : 'google');
  const [handle, setHandle] = useState(activeProfile?.handle || '');
  const [status, setStatus] = useState(activeProfile?.status || '');
  const [profileRingId, setProfileRingId] = useState(activeProfile?.profileRingId || '');
  const [badgeIds, setBadgeIds] = useState(activeProfile?.badgeIds || []);
  const [preferences, setPreferences] = useState(() => ({
    mentions: true,
    replies: true,
    roomAnnouncements: true,
    moderationUpdates: true,
    reportUpdates: true,
    billingStatus: true,
    systemNotices: true,
    pushEnabled: false,
    pushMentions: true,
    pushReplies: true,
    pushAnnouncements: true,
    pushEventReminders: true,
    pushSafetyUpdates: true,
    pushBillingSystem: true,
    ...(notificationPreferences || {}),
  }));
  const ownedCosmeticIds = billingSummary?.ownedCosmeticIds || [];
  const ownedBadgeIds = billingSummary?.ownedBadgeIds || [];

  useEffect(() => {
    setDisplayName(activeProfile?.displayName || '');
    setAvatar(activeProfile?.avatar || AVATARS[0].id);
    setPhotoMode(activeProfile?.photoMode === 'avatar' ? 'avatar' : activeProfile?.googlePhotoURL ? 'google' : 'avatar');
    setHandle(activeProfile?.handle || '');
    setStatus(activeProfile?.status || '');
    setProfileRingId(activeProfile?.profileRingId || '');
    setBadgeIds(activeProfile?.badgeIds || []);
  }, [
    activeProfile?.displayName,
    activeProfile?.avatar,
    activeProfile?.photoMode,
    activeProfile?.googlePhotoURL,
    activeProfile?.handle,
    activeProfile?.status,
    activeProfile?.profileRingId,
    activeProfile?.badgeIds,
  ]);

  useEffect(() => {
    setPreferences({
      mentions: true,
      replies: true,
      roomAnnouncements: true,
      moderationUpdates: true,
      reportUpdates: true,
      billingStatus: true,
      systemNotices: true,
      pushEnabled: false,
      pushMentions: true,
      pushReplies: true,
      pushAnnouncements: true,
      pushEventReminders: true,
      pushSafetyUpdates: true,
      pushBillingSystem: true,
      ...(notificationPreferences || {}),
    });
  }, [notificationPreferences]);

  function submit(event) {
    event.preventDefault();
    onSave?.({
      displayName,
      avatar,
      handle,
      status,
      profileRingId,
      badgeIds,
      photoMode,
      photoURL: photoMode === 'google' ? activeProfile?.googlePhotoURL || activeProfile?.photoURL || '' : '',
      googlePhotoURL: activeProfile?.googlePhotoURL || '',
    });
  }

  return (
    <main className={cn('profile-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('profile-hero glass-panel', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div className="profile-hero__aura" aria-hidden="true" />
        <div className="profile-hero__identity">
          <ProfilePortrait profile={activeProfile} avatar={avatar} ringId={profileRingId} photoMode={photoMode} />
          <div>
            <p className={cn('eyebrow', tw.eyebrow)}>Nexus identity</p>
            <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">{displayName || 'Your Nexus profile'}</h1>
            <p className={tw.subcopy}>{isLoggedIn ? 'Synced with your MH Horizon chat account.' : 'A polished guest identity for this browser.'}</p>
            <div className="profile-hero__chips">
              <span className="pill">{isLoggedIn ? 'Account' : 'Guest mode'}</span>
              <span className="pill pill--muted">{billingSummary?.planTier ? `Nexus ${billingSummary.planTier}` : 'Free access'}</span>
              {handle && <span className="pill pill--muted">@{handle}</span>}
            </div>
          </div>
        </div>
        <div className="profile-hero__actions">
          <button className="icon-button profile-icon-action" type="button" onClick={onBack} aria-label="Go back">
            <Icon name="chevronLeft" size={21} />
          </button>
          {isLoggedIn ? (
            <button className={cn('button button--ghost profile-auth-button', tw.buttonGhost)} type="button" onClick={onLogout}>
              <Icon name="logout" size={18} />
              Logout
            </button>
          ) : (
            <button className={cn('button button--primary profile-auth-button', tw.buttonPrimary)} type="button" onClick={onLogin}>
              <Icon name="login" size={18} />
              Login / Sign up
            </button>
          )}
        </div>
      </section>

      <section className="profile-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form className={cn('panel profile-editor entrance-card', tw.glassSoft, 'space-y-5 p-5')} onSubmit={submit}>
          <div className="profile-preview">
            <ProfilePortrait profile={activeProfile} avatar={avatar} ringId={profileRingId} photoMode={photoMode} compact />
            <div>
              <strong>{displayName || 'NexusUser'}</strong>
              <span>{handle ? `@${handle}` : isLoggedIn ? 'Choose a handle' : 'Guest'}</span>
              <p>{status || 'Set a short status for mini profile cards.'}</p>
              <span className="pill pill--muted">{billingSummary?.planTier || 'free'} plan</span>
              {badgeIds.includes('early_supporter') && <em className="profile-badge">Early Supporter</em>}
            </div>
          </div>

          <label className="field">
            <span>Display name</span>
            <input className={tw.input} value={displayName} maxLength={24} onChange={(event) => setDisplayName(event.target.value)} />
          </label>

          {isLoggedIn && (
            <label className="field">
              <span>Unique handle</span>
              <input className={tw.input} value={handle} maxLength={24} placeholder="mhfriend" onChange={(event) => setHandle(event.target.value)} />
            </label>
          )}

          <label className="field">
            <span>Status</span>
            <textarea className={tw.input} value={status} maxLength={160} onChange={(event) => setStatus(event.target.value)} />
          </label>

          <section className="profile-image-picker" aria-label="Profile image source">
            <div>
              <p className="eyebrow">Profile image</p>
              <h2>Choose your room portrait</h2>
              <p className="muted">Account photos can travel into room cards. Nexus avatars stay available whenever you want a quieter identity.</p>
            </div>
            <div className="profile-image-options grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose profile image">
              {activeProfile?.googlePhotoURL && (
                <button
                  className={cn(`profile-image-option ${photoMode === 'google' ? 'is-active' : ''}`, tw.cardCompact, photoMode === 'google' ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
                  type="button"
                  role="radio"
                  aria-checked={photoMode === 'google'}
                  onClick={() => setPhotoMode('google')}
                >
                  <AvatarBadge avatarId={avatar} photoURL={activeProfile.googlePhotoURL} size="md" />
                  <span>
                    <strong>Account photo</strong>
                    <em>Account portrait</em>
                  </span>
                </button>
              )}
              <button
                className={cn(`profile-image-option ${photoMode === 'avatar' ? 'is-active' : ''}`, tw.cardCompact, photoMode === 'avatar' ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
                type="button"
                role="radio"
                aria-checked={photoMode === 'avatar'}
                onClick={() => setPhotoMode('avatar')}
              >
                <AvatarBadge avatarId={avatar} size="md" ringId={profileRingId} />
                <span>
                  <strong>Nexus avatar</strong>
                  <em>Editable preset</em>
                </span>
              </button>
            </div>
          </section>

          <div className="avatar-picker grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Profile avatar">
            {AVATARS.map((item) => (
              <button
                className={cn(`avatar-option ${avatar === item.id ? 'is-active' : ''}`, tw.cardCompact, 'text-center', avatar === item.id ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
                key={item.id}
                type="button"
                onClick={() => {
                  setAvatar(item.id);
                  setPhotoMode('avatar');
                }}
              >
                <AvatarBadge avatarId={item.id} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          {isLoggedIn && (
            <div className="profile-cosmetics">
              <p className="eyebrow">Owned profile cosmetics</p>
              <div className="cosmetic-choice-grid">
                {PROFILE_COSMETICS.map((cosmetic) => {
                  const owned =
                    ownedCosmeticIds.includes(cosmetic.cosmeticId) || ownedBadgeIds.includes(cosmetic.cosmeticId);
                  const active =
                    cosmetic.type === 'profileRing'
                      ? profileRingId === cosmetic.cosmeticId
                      : badgeIds.includes(cosmetic.cosmeticId);

                  return (
                    <button
                      className={`cosmetic-choice ${active ? 'is-active' : ''}`}
                      key={cosmetic.cosmeticId}
                      type="button"
                      disabled={!owned}
                      onClick={() => {
                        if (cosmetic.type === 'profileRing') {
                          setProfileRingId(cosmetic.cosmeticId);
                          return;
                        }

                        setBadgeIds((current) => [...new Set([...current, cosmetic.cosmeticId])]);
                      }}
                    >
                      <span>{owned ? cosmetic.title : `${cosmetic.title} locked`}</span>
                      <strong>{active ? 'Applied' : owned ? 'Apply' : 'Store'}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')} type="submit" disabled={saving}>
            <Icon name="sparkle" size={18} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <aside className="profile-side">
          <section className={cn('panel profile-stats', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Room presence</p>
            <div className="admin-metrics">
              <Metric label="Created" value={accountProfile?.stats?.roomsCreated || 0} />
              <Metric label="Messages" value={accountProfile?.stats?.messagesSent || 0} />
              <Metric label="Reports" value={accountProfile?.stats?.helpfulReports || 0} />
              <Metric label="Mod acts" value={accountProfile?.stats?.moderationActions || 0} />
            </div>
          </section>

          <section className={cn('panel settings-card blocked-settings', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Blocked users</p>
            <h2>{blockedUsers.length} blocked</h2>
            {blockedUsers.length === 0 ? (
              <p className="muted">Blocked users stay collapsed in chat until you unblock them.</p>
            ) : (
              <div className="stacked-actions">
                {blockedUsers.map((blocked) => {
                  const blockedId = typeof blocked === 'string' ? blocked : blocked.blockedId;
                  const name = typeof blocked === 'string' ? 'Blocked user' : blocked.displayName;
                  return (
                    <button
                      className="button button--ghost button--wide"
                      key={blockedId}
                      type="button"
                      onClick={() => onUnblock?.(blockedId, name)}
                    >
                      Unblock {name || 'user'}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={cn('panel settings-card notification-settings', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Notifications</p>
            <h2>Calm room alerts</h2>
            <div className="push-status-card">
              <span className={`push-status-card__orb ${pushState.tokenRegistered ? 'is-on' : ''}`} aria-hidden="true">
                <Icon name="bell" size={18} />
              </span>
              <div>
                <strong>{getPushStatusTitle(pushState, pwaStatus)}</strong>
                <p>{getPushStatusBody(pushState, pwaStatus, isLoggedIn)}</p>
              </div>
            </div>
            <div className="stacked-actions stacked-actions--split">
              {pushState.tokenRegistered ? (
                <button className="button button--ghost button--wide" type="button" onClick={onDisablePush} disabled={pushState.loading}>
                  <Icon name="close" size={17} />
                  {pushState.loading ? 'Updating...' : 'Disable push on this device'}
                </button>
              ) : (
                <button
                  className={cn('button button--soft button--wide', tw.buttonSoft)}
                  type="button"
                  onClick={onEnablePush}
                  disabled={pushState.loading || !isLoggedIn || !pushState.supported}
                >
                  <Icon name="smartphone" size={17} />
                  {pushState.loading ? 'Preparing...' : 'Enable push notifications'}
                </button>
              )}
            </div>
            <div className="preference-list">
              {[
                ['mentions', 'Mentions'],
                ['replies', 'Replies'],
                ['roomAnnouncements', 'Room announcements'],
                ['moderationUpdates', 'Moderation updates'],
                ['reportUpdates', 'Report status'],
                ['billingStatus', 'Billing status'],
                ['systemNotices', 'System notices'],
                ['pushMentions', 'Push mentions'],
                ['pushReplies', 'Push replies'],
                ['pushAnnouncements', 'Push announcements'],
                ['pushEventReminders', 'Push event reminders'],
                ['pushSafetyUpdates', 'Push safety updates'],
                ['pushBillingSystem', 'Push billing/system notices'],
              ].map(([key, label]) => (
                <label className="preference-toggle" key={key}>
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={preferences[key] !== false}
                    onChange={(event) => {
                      const next = { ...preferences, [key]: event.target.checked };
                      setPreferences(next);
                      onNotificationPreferences?.(next);
                    }}
                  />
                </label>
              ))}
            </div>
            {!isLoggedIn && <p className="muted">Guest preferences stay local to this browser. Durable push requires account login.</p>}
          </section>

          <section className={cn('panel settings-card pwa-settings-card', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Mobile app shell</p>
            <h2>{pwaState.installed ? 'Nexus is installed' : 'Install Nexus Chat'}</h2>
            <p className="muted">
              {pwaState.serviceWorkerReady
                ? 'The offline-safe app shell is ready. Live chat still needs network access.'
                : 'Service worker support will appear here when the browser allows it.'}
            </p>
            <div className="pwa-status-list">
              <span>{pwaState.online ? 'Online now' : 'Offline mode visible'}</span>
              <span>{pwaState.serviceWorkerReady ? 'Shell cached' : 'Shell pending'}</span>
              <span>{pwaState.installAvailable ? 'Install prompt ready' : pwaState.installed ? 'Standalone app' : 'Install prompt hidden'}</span>
            </div>
            {pwaState.installAvailable && !pwaState.installDismissed && !pwaState.installed ? (
              <div className="stacked-actions stacked-actions--split">
                <button className={cn('button button--primary button--wide', tw.buttonPrimary)} type="button" onClick={onInstallApp}>
                  <Icon name="download" size={17} />
                  Install Nexus
                </button>
                <button className="button button--ghost button--wide" type="button" onClick={onDismissInstall}>
                  Later
                </button>
              </div>
            ) : (
              <p className="muted">Install appears only when the browser exposes a safe PWA prompt.</p>
            )}
          </section>

          <section className={cn('panel settings-card profile-feedback-card', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Launch feedback</p>
            <h2>Found a bug or rough edge?</h2>
            <p className="muted">Send a safe note with this profile or guest identity attached.</p>
            <button className={cn('button button--soft button--wide', tw.buttonSoft, 'w-full')} type="button" onClick={onFeedback}>
              <Icon name="sparkle" size={17} />
              Feedback
            </button>
          </section>

          {!isLoggedIn && (
            <section className={cn('panel settings-card profile-login-hint', tw.glassSoft, 'p-5')}>
              <p className="eyebrow">Account benefits</p>
              <h2>Login saves this identity</h2>
              <p className="muted">Guest mode stays free. Account login keeps profile polish, favorites, rooms, and billing entitlements across devices.</p>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function getPushStatusTitle(pushState = {}, pwaStatus = {}) {
  if (pushState.tokenRegistered) {
    return 'Push enabled on this browser';
  }

  if (pushState.permission === 'denied') {
    return 'Push blocked by browser';
  }

  if (!pwaStatus?.fcm?.enabled) {
    return 'Push disabled for this launch';
  }

  if (!pushState.supported) {
    return 'Push unavailable here';
  }

  return 'Optional push notifications';
}

function getPushStatusBody(pushState = {}, pwaStatus = {}, isLoggedIn = false) {
  if (!isLoggedIn) {
    return 'Login to register a browser/device token.';
  }

  if (pushState.tokenRegistered) {
    return 'Mentions, replies, announcements, safety, event, and billing notices can reach this device.';
  }

  if (pushState.permission === 'denied') {
    return 'Enable notifications in browser settings, then return here.';
  }

  if (!pwaStatus?.fcm?.enabled) {
    return 'The server is running without Firebase Cloud Messaging enabled.';
  }

  if (!pushState.supported) {
    return 'This browser or launch config does not currently support FCM web push.';
  }

  return 'Nexus asks only after you press enable. Normal chat works without push.';
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProfilePortrait({ profile, avatar, ringId, photoMode = 'google', compact = false }) {
  const photoURL = photoMode === 'avatar' ? '' : profile?.googlePhotoURL || profile?.photoURL || '';

  return (
    <span className={`profile-portrait ${compact ? 'profile-portrait--compact' : ''}`}>
      {photoURL ? (
        <img src={photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <AvatarBadge avatarId={avatar} ringId={ringId} size={compact ? 'md' : 'lg'} />
      )}
      <i aria-hidden="true">
        <Icon name={profile?.authProvider === 'google' ? 'shield' : 'user'} size={compact ? 13 : 16} />
      </i>
    </span>
  );
}
