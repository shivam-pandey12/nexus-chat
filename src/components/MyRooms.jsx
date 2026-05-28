import { useMemo } from 'react';

import { getCategoryConfig } from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

export default function MyRooms({ rooms = [], loading = false, isLoggedIn = false, onBack, onJoin, onToggleFavorite }) {
  const groups = useMemo(() => ({
    favorites: rooms.filter((item) => item.isFavorite),
    created: rooms.filter((item) => item.role === 'owner'),
    joined: rooms.filter((item) => item.role !== 'owner'),
    recent: [...rooms].sort(sortByRecent).slice(0, 8),
  }), [rooms]);

  return (
    <main className={cn('my-rooms-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>My rooms</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Your room orbit</h1>
          <p className={tw.subcopy}>{isLoggedIn ? 'Joined and favorite rooms follow your account.' : 'Guest recents and favorites stay in this browser.'}</p>
          <div className="header-stat-row">
            <span>{rooms.length} saved</span>
            <span>{groups.favorites.length} pinned</span>
            {!isLoggedIn && <span>Login to sync</span>}
          </div>
        </div>
        <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>
          Explore
        </button>
      </section>

      {loading ? (
        <section className={cn('room-grid', tw.roomGrid)}>
          {[1, 2, 3].map((item) => <div className={cn('room-card skeleton', tw.card, 'min-h-[240px] animate-pulse')} key={item} />)}
        </section>
      ) : rooms.length === 0 ? (
        <div className={cn('empty-state empty-state--decorated', tw.glassSoft, 'mx-auto max-w-xl p-8 text-center')}>
          <span className="empty-state__sigil" aria-hidden="true" />
          <h2>No saved rooms yet</h2>
          <p>Join or create a room and it will appear here.</p>
        </div>
      ) : (
        <div className="my-rooms-grid dashboard-grid grid gap-5 lg:grid-cols-2">
          <RoomShelf title="Favorites" items={groups.favorites} empty="Favorite a room to pin it here." onJoin={onJoin} onToggleFavorite={onToggleFavorite} />
          <RoomShelf title="Created" items={groups.created} empty="Rooms you create appear here." onJoin={onJoin} onToggleFavorite={onToggleFavorite} />
          <RoomShelf title="Joined" items={groups.joined} empty="Joined rooms appear after your first visit." onJoin={onJoin} onToggleFavorite={onToggleFavorite} />
          <RoomShelf title="Recent" items={groups.recent} empty="Recent room visits appear here." onJoin={onJoin} onToggleFavorite={onToggleFavorite} />
        </div>
      )}
    </main>
  );
}

function RoomShelf({ title, items, empty, onJoin, onToggleFavorite }) {
  return (
    <section className={cn('panel room-shelf', tw.glassSoft, 'p-5')}>
      <div className="admin-card__header">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{items.length}</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="saved-room-list">
          {items.map((relationship) => (
            <article className={cn(`saved-room room-theme--${relationship.room.themeId || 'classic'} ${getCategoryConfig(relationship.room.categorySlug || relationship.room.category).accentClass}`, tw.cardCompact, 'grid gap-4 sm:grid-cols-[1fr_auto]')} key={`${title}_${relationship.roomId}`}>
              <div>
                <strong>{relationship.room.title}</strong>
                <span>
                  <CategoryBadge category={relationship.room.categorySlug || relationship.room.category} compact /> · {relationship.role} · {relationship.room.type || 'room'}
                  {relationship.room.communityName ? ` · ${relationship.room.communityName}` : ''}
                </span>
                <small>{formatVisited(relationship.lastVisitedAt)}{relationship.room.expiresAt ? ` · ${formatExpiry(relationship.room.expiresAt)}` : ''}</small>
                {(relationship.unreadCount || 0) > 0 && <em className="unread-badge">{relationship.unreadCount} unread</em>}
                {(relationship.latestMessagePreview || relationship.room.latestMessagePreview) && (
                  <p className="saved-room__preview">{relationship.latestMessagePreview || relationship.room.latestMessagePreview}</p>
                )}
                {(relationship.latestAnnouncement || relationship.room.latestAnnouncement) && (
                  <p className="saved-room__announcement">
                    Announcement: {(relationship.latestAnnouncement || relationship.room.latestAnnouncement).title}
                  </p>
                )}
                {relationship.notificationsMuted && <small>Notifications muted</small>}
              </div>
              <div className="saved-room__actions">
                <button
                  className={`favorite-button ${relationship.isFavorite ? 'is-active' : ''}`}
                  type="button"
                  aria-label={relationship.isFavorite ? 'Remove favorite' : 'Favorite room'}
                  onClick={() => onToggleFavorite?.(relationship.room, !relationship.isFavorite)}
                >
                  {relationship.isFavorite ? 'Pinned' : 'Pin'}
                </button>
                <button className={cn('button button--small', tw.buttonSoft, 'min-h-9 px-4 py-2')} type="button" onClick={() => onJoin?.({ roomId: relationship.roomId })}>
                  Join
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function sortByRecent(a, b) {
  return new Date(b.lastVisitedAt || 0).getTime() - new Date(a.lastVisitedAt || 0).getTime();
}

function formatVisited(value) {
  if (!value) {
    return 'Recent';
  }

  return `Visited ${new Intl.DateTimeFormat([], { dateStyle: 'short' }).format(new Date(value))}`;
}

function formatExpiry(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return '';
  }

  return timestamp <= Date.now() ? 'Expired' : `Ends ${new Intl.DateTimeFormat([], { dateStyle: 'short' }).format(new Date(value))}`;
}
