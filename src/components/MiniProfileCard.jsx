import AvatarBadge from './AvatarBadge.jsx';
import Icon from './Icon.jsx';

export default function MiniProfileCard({
  target,
  profile,
  roomRole = 'member',
  loading = false,
  blocked = false,
  canModerate = false,
  canBan = false,
  onClose,
  onReport,
  onBlock,
  onUnblock,
  onMute,
  onKick,
  onBan,
}) {
  if (!target) {
    return null;
  }

  const safeProfile = profile || target;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="panel modal-panel mini-profile" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button mini-profile__close" type="button" onClick={onClose} aria-label="Close mini profile">
          <Icon name="close" size={18} />
        </button>
        <div className="mini-profile__head">
          <AvatarBadge
            avatarId={safeProfile.avatar || target.avatar}
            photoURL={safeProfile.photoURL || target.photoURL || ''}
            ringId={safeProfile.profileRingId || ''}
          />
          <div>
            <p className="eyebrow">{roomRole}</p>
            <h2>{safeProfile.displayName || target.displayName || 'Nexus user'}</h2>
            <span>{safeProfile.handle ? `@${safeProfile.handle}` : safeProfile.userId ? 'Logged-in profile' : 'Guest profile'}</span>
            {safeProfile.badgeIds?.includes?.('early_supporter') && <em className="profile-badge">Early Supporter</em>}
          </div>
        </div>
        {loading ? <p className="muted">Loading profile...</p> : <p>{safeProfile.status || 'No status set yet.'}</p>}
        {safeProfile.joinedAt && <p className="muted">Joined {formatDate(safeProfile.joinedAt)}</p>}
        <div className="stacked-actions">
          <button className="button button--ghost button--wide" type="button" onClick={onReport}>
            Report User
          </button>
          <button className="button button--soft button--wide" type="button" onClick={blocked ? onUnblock : onBlock}>
            {blocked ? 'Unblock User' : 'Block User'}
          </button>
          {canModerate && (
            <>
              <button className="button button--ghost button--wide" type="button" onClick={onMute}>
                Mute 15 min
              </button>
              <button className="button button--danger button--wide" type="button" onClick={onKick}>
                Kick
              </button>
              {canBan && (
                <button className="button button--danger button--wide" type="button" onClick={onBan}>
                  Ban 24 h
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(value));
}
