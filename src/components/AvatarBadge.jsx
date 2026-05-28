import { getAvatar } from '../data/avatars.js';

export default function AvatarBadge({ avatarId, size = 'md', ringId = '', photoURL = '' }) {
  const avatar = getAvatar(avatarId);
  const ringClass = ringId ? ` avatar-ring--${ringId}` : '';

  return (
    <span className={`avatar avatar--${avatar.tone} avatar--${size}${photoURL ? ' avatar--photo' : ''}${ringClass}`} aria-hidden="true">
      {photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="avatar__label">{avatar.label}</span>}
    </span>
  );
}
