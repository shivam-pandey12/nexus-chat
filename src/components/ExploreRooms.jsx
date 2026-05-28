import { useMemo, useState } from 'react';

import {
  getCategoryConfig,
  getCategoryOptions,
  getCategorySlug,
} from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

export default function ExploreRooms({ rooms, loading, favoriteRoomIds = [], roomRelationships = [], onJoin, onCreate, onToggleFavorite, onBack }) {
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesCategory = category === 'all' || getCategorySlug(room.categorySlug || room.category) === category;
      const matchesSearch = !query || room.title.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [rooms, category, search]);
  const activeCategory = category === 'all' ? null : getCategoryConfig(category);
  const roomHighlights = useMemo(
    () => new Map((roomRelationships || []).map((relationship) => [relationship.roomId, relationship])),
    [roomRelationships],
  );

  function handleJoinCode(event) {
    event.preventDefault();
    onJoin({ code });
  }

  return (
    <main className={cn('rooms-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Explore rooms</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Find your next live conversation</h1>
          <p className={tw.subcopy}>Study, gaming, coding, creative, random, and MH Horizon rooms with real people online.</p>
          <div className="header-stat-row mt-4 flex flex-wrap gap-2" aria-label="Explore room summary">
            <span>{rooms.length} rooms visible</span>
            <span>{rooms.reduce((sum, room) => sum + Number(room.memberCount || 0), 0)} people online</span>
          </div>
        </div>
        <div className="rooms-header__actions flex flex-wrap gap-3">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>
            Home
          </button>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={() => onCreate('public')}>
            New Room
          </button>
        </div>
      </section>

      <form className={cn('panel join-code premium-card command-panel', tw.glassSoft, 'grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5')} onSubmit={handleJoinCode}>
        <label className="field">
          <span>Private invite code</span>
          <input
            className={tw.input}
            value={code}
            placeholder="A1B2C3D4"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
        <button className={cn('button button--soft', tw.buttonSoft)} type="submit">
          Join by Code
        </button>
      </form>

      <section className={cn('panel explore-tools premium-card command-panel', tw.glassSoft, 'space-y-4 p-4 sm:p-5')} aria-label="Room filters">
        <label className="field search-bar">
          <span>Search rooms</span>
          <input
            className={tw.input}
            value={search}
            placeholder="Search by room title"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="filter-row flex gap-2 overflow-x-auto pb-1">
          {['all', ...categoryOptions.map((item) => item.slug)].map((item) => {
            const itemCategory = item === 'all' ? null : getCategoryConfig(item);
            return (
            <button
              className={cn('filter-chip shrink-0 transition-all duration-200 hover:-translate-y-0.5', category === item ? 'is-active ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              {itemCategory ? itemCategory.label : 'All'}
              {item === 'all' && <small>{rooms.length}</small>}
            </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <section className={cn('room-grid', tw.roomGrid)}>
          {[1, 2, 3].map((item) => (
            <div className={cn('room-card skeleton', tw.card, 'min-h-[260px] animate-pulse')} key={item} />
          ))}
        </section>
      ) : filteredRooms.length === 0 ? (
        <div className={cn('empty-state empty-state--decorated', tw.glassSoft, 'mx-auto max-w-xl p-8 text-center')}>
          <span className="empty-state__sigil" aria-hidden="true" />
          <h2>{activeCategory?.emptyStateTitle || 'No matching rooms'}</h2>
          <p>{activeCategory?.emptyStateBody || 'Create a room or try a different category.'}</p>
        </div>
      ) : (
        <section className={cn('room-grid', tw.roomGrid)}>
          {filteredRooms.map((room) => {
            const roomCategory = getCategoryConfig(room.categorySlug || room.category);
            return (
            <article className={cn(`room-card premium-card room-theme--${room.themeId || 'classic'} ${roomCategory.accentClass}`, tw.card, 'min-h-[270px]')} key={room.roomId}>
              {(roomHighlights.get(room.roomId)?.unreadCount || 0) > 0 && (
                <em className="unread-badge room-card__unread">{roomHighlights.get(room.roomId).unreadCount} unread</em>
              )}
              <button
                className={cn(`favorite-button room-card__favorite ${favoriteRoomIds.includes(room.roomId) ? 'is-active' : ''}`, 'absolute right-4 top-4 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-black shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5')}
                type="button"
                onClick={() => onToggleFavorite?.(room, !favoriteRoomIds.includes(room.roomId))}
              >
                {favoriteRoomIds.includes(room.roomId) ? 'Pinned' : 'Pin'}
              </button>
              <div className="room-card__pills">
                <span className={cn('pill status-pill', tw.pill)}>{room.type}</span>
                <CategoryBadge category={roomCategory.slug} compact />
                {room.communityName && <span className="pill pill--muted">{room.communityName}</span>}
                <span className={`pill ${room.isLocked ? 'pill--locked' : 'pill--live'}`}>
                  {room.isLocked ? 'locked' : 'open'}
                </span>
              </div>
              <h2>{room.title}</h2>
              <p>
                Hosted by {room.ownerName || 'Nexus host'} · Created {formatRelativeTime(room.createdAt)}
                {room.roomPurpose ? ` · ${room.roomPurpose}` : ''}
                {room.type === 'temp' && room.expiresAt ? ` · ${formatExpiry(room.expiresAt)}` : ''}
              </p>
              <div className="room-theme-strip" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="room-card__footer">
                <span><i className="live-dot" />{room.memberCount} online</span>
                <button
                  className={cn('button button--small', tw.buttonSoft, 'min-h-9 px-4 py-2')}
                  type="button"
                  disabled={room.isExpired}
                  onClick={() => onJoin({ roomId: room.roomId })}
                >
                  {room.isExpired ? 'Expired' : 'Join'}
                </button>
              </div>
            </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'recently';
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.floor(minutes / 60)}h ago`;
}

function formatExpiry(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    return 'expired';
  }

  const hours = Math.ceil((timestamp - Date.now()) / (60 * 60 * 1000));

  if (hours <= 1) {
    return 'ends in 1h';
  }

  if (hours < 24) {
    return `ends in ${hours}h`;
  }

  return hours <= 36 ? 'ends today' : `ends in ${Math.ceil(hours / 24)}d`;
}
