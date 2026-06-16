import { useMemo, useState } from 'react';

import {
  COMMUNITY_VISIBILITIES,
  EVENT_RSVP_STATUSES,
} from '../../shared/chatConfig.js';
import {
  getCategoryConfig,
  getCategoryDefaultRules,
  getCategoryOptions,
  getCategorySlug,
} from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

const COMMUNITY_CATEGORY_OPTIONS = getCategoryOptions();
const COMMUNITY_FILTERS = ['all', ...COMMUNITY_CATEGORY_OPTIONS.map((category) => category.slug), 'trending', 'new'];

export function DiscoverCommunities({
  communities = [],
  loading = false,
  isLoggedIn = false,
  onBack,
  onCreate,
  onOpen,
  onLogin,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return communities.filter((community) => {
      const categoryMatch = ['all', 'trending', 'new'].includes(filter) || getCategorySlug(community.categorySlug || community.category) === filter;
      const queryMatch =
        !query ||
        community.name.toLowerCase().includes(query) ||
        community.description.toLowerCase().includes(query) ||
        (community.tags || []).some((tag) => tag.toLowerCase().includes(query));
      return categoryMatch && queryMatch;
    });
  }, [communities, filter, search]);

  return (
    <main className={cn('communities-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Communities</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Small circles for real conversations</h1>
          <p className={tw.subcopy}>Discover study groups, GameHub crews, coding rooms, creative lounges, and MH Horizon communities.</p>
          <div className="header-stat-row">
            <span>{communities.length} public communities</span>
            <span>{communities.reduce((sum, community) => sum + Number(community.memberCountSnapshot || 0), 0)} members</span>
          </div>
        </div>
        <div className="rooms-header__actions flex flex-wrap gap-3">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>Explore Rooms</button>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={isLoggedIn ? onCreate : onLogin}>
            {isLoggedIn ? 'Create Community' : 'Login to Create'}
          </button>
        </div>
      </section>

      <section className={cn('panel explore-tools premium-card command-panel', tw.glassSoft, 'space-y-4 p-5')}>
        <label className="field search-bar">
          <span>Search communities</span>
          <input className={tw.input} value={search} placeholder="Search by name, tag, or topic" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="filter-row">
          {COMMUNITY_FILTERS.map((item) => (
            <button className={`filter-chip ${filter === item ? 'is-active' : ''}`} key={item} type="button" onClick={() => setFilter(item)}>
              {formatCommunityFilter(item)}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className={cn('room-grid', tw.roomGrid)}>{[1, 2, 3].map((item) => <div className={cn('room-card skeleton', tw.card, 'min-h-[260px] animate-pulse')} key={item} />)}</section>
      ) : filtered.length === 0 ? (
        <div className={cn('empty-state empty-state--decorated', tw.glassSoft, 'mx-auto max-w-xl p-8 text-center')}>
          <span className="empty-state__sigil" aria-hidden="true" />
          <h2>No communities found</h2>
          <p>Try a different search or create a focused community.</p>
        </div>
      ) : (
        <section className={cn('community-grid room-grid', tw.roomGrid)}>
          {filtered.map((community) => {
            const communityCategory = getCategoryConfig(community.categorySlug || community.category);
            return (
            <article className={cn(`community-card premium-card community-theme--${community.coverTheme || 'classic'} ${communityCategory.accentClass}`, tw.card)} key={community.communityId}>
              <div className="community-cover" aria-hidden="true">
                <span>{community.avatar || 'N'}</span>
              </div>
              <div className="room-card__pills">
                <CategoryBadge category={communityCategory.slug} compact />
                <span className="pill pill--muted">{community.visibility}</span>
                {community.featuredUntil && <span className="pill pill--live">featured</span>}
              </div>
              <h2>{community.name}</h2>
              <p>{community.description || 'A premium Nexus Chat community for focused rooms.'}</p>
              <div className="community-tags">
                {(community.tags || []).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <div className="room-card__footer">
                <span>{community.memberCountSnapshot || 0} members · {community.roomCountSnapshot || 0} rooms</span>
                <button className={cn('button button--small', tw.buttonSoft, 'min-h-9 px-4 py-2')} type="button" onClick={() => onOpen(community)}>
                  Open
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

export function CreateCommunity({ billingSummary, onSubmit, onBack }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('study');
  const [visibility, setVisibility] = useState('public');
  const [tags, setTags] = useState('');
  const [coverTheme, setCoverTheme] = useState('classic');
  const limits = billingSummary?.limits || {};
  const selectedCategory = getCategoryConfig(category);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      name,
      slug,
      description,
      category,
      visibility,
      coverTheme,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
  }

  return (
    <main className={cn('form-page premium-page', tw.pageWide)}>
      <form className={cn('panel room-form entrance-card room-builder glass-panel', tw.glass, 'space-y-6 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="room-builder__intro">
          <p className="eyebrow">Create community</p>
          <h1>Shape a lightweight social space</h1>
          <p className="muted">Communities group rooms, events, rules, announcements, and safe moderation without becoming a giant server.</p>
        </div>
        <div className="notice notice--compact plan-limit-card">
          <span>Current plan</span>
          <strong>{billingSummary?.planTier || 'free'}</strong>
          <em>{limits.communities || 1} communities · {limits.roomsPerCommunity || 3} rooms each</em>
        </div>
        <section className="form-group-card">
          <div>
            <p className="eyebrow">Identity</p>
            <h2>Community profile</h2>
          </div>
          <label className="field"><span>Name</span><input className={tw.input} maxLength={56} value={name} onChange={(event) => setName(event.target.value)} placeholder="JEE Study Circle" /></label>
          <label className="field"><span>Slug</span><input className={tw.input} maxLength={40} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="jee-study-circle" /></label>
          <label className="field"><span>Description</span><textarea className={tw.input} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should people expect here?" /></label>
        </section>
        <section className="form-group-card">
          <div>
            <p className="eyebrow">Discovery</p>
            <h2>Category and access</h2>
          </div>
          <label className="field"><span>Category</span><select className={tw.input} value={category} onChange={(event) => setCategory(event.target.value)}>{COMMUNITY_CATEGORY_OPTIONS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
          <label className="field"><span>Visibility</span><select className={tw.input} value={visibility} onChange={(event) => setVisibility(event.target.value)}>{COMMUNITY_VISIBILITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Tags</span><input className={tw.input} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="study, jee, doubts" /></label>
          <div className={`category-guidance ${selectedCategory.accentClass}`}>
            <CategoryBadge category={selectedCategory.slug} compact />
            <p>{selectedCategory.createRoomMicrocopy}</p>
          </div>
        </section>
        <section className="form-group-card">
          <div>
            <p className="eyebrow">Style</p>
            <h2>Cover theme</h2>
          </div>
          <label className="field"><span>Theme</span><select className={tw.input} value={coverTheme} onChange={(event) => setCoverTheme(event.target.value)}>{(limits.communityCoverThemes || ['classic']).map((item) => <option key={item}>{item}</option>)}</select></label>
        </section>
        <div className="form-actions">
          <button className="button button--ghost" type="button" onClick={onBack}>Back</button>
          <button className="button button--primary" type="submit">Create Community</button>
        </div>
      </form>
    </main>
  );
}

export function CommunityHome({
  details,
  isLoggedIn,
  onBack,
  onJoin,
  onLeave,
  onFavorite,
  onCreateRoom,
  onCreateEvent,
  onScheduleAnnouncement,
  onOpenRoom,
  onOpenEvent,
  onSettings,
  onReport,
}) {
  const community = details?.community;
  const membership = details?.membership;

  if (!community) {
    return (
      <main className={cn('premium-page', tw.page)}>
        <div className="empty-state empty-state--decorated">
          <span className="empty-state__sigil" aria-hidden="true" />
          <h2>Community unavailable</h2>
          <p>This community may be private, deleted, or unavailable.</p>
          <button className="button button--primary" type="button" onClick={onBack}>Back to Communities</button>
        </div>
      </main>
    );
  }

  const canManage = ['owner', 'admin'].includes(membership?.role);
  const canAnnounce = ['owner', 'admin', 'moderator'].includes(membership?.role);

  return (
    <main className={cn('community-home premium-page', tw.pageWide, 'space-y-6')}>
      <section className={`community-hero premium-card community-theme--${community.coverTheme || 'classic'} ${getCategoryConfig(community.categorySlug || community.category).accentClass}`}>
        <button className="button button--ghost" type="button" onClick={onBack}>Communities</button>
        <div className="community-hero__body">
          <div className="community-avatar avatar-ring">{community.avatar || 'N'}</div>
          <div>
            <p className="eyebrow"><CategoryBadge category={community.categorySlug || community.category} compact /> community</p>
            <h1>{community.name}</h1>
            <p>{community.description || 'A Nexus Chat community for focused real-time rooms.'}</p>
            <div className="header-stat-row">
              <span>{community.memberCountSnapshot || 0} members</span>
              <span>{community.roomCountSnapshot || 0} rooms</span>
              <span>{membership?.role || (isLoggedIn ? 'not joined' : 'guest view')}</span>
            </div>
          </div>
        </div>
        <div className="community-hero__actions">
          {membership ? (
            <button className="button button--soft" type="button" onClick={onLeave}>Leave</button>
          ) : (
            <button className="button button--primary" type="button" onClick={onJoin}>{isLoggedIn ? 'Join Community' : 'Login to Join'}</button>
          )}
          {membership && <button className="favorite-button is-active" type="button" onClick={onFavorite}>Pin</button>}
          {canManage && <button className="button button--ghost" type="button" onClick={onSettings}>Settings</button>}
          <button className="button button--ghost" type="button" onClick={onReport}>Report</button>
        </div>
      </section>

      {(details.announcements || [])[0] && (
        <section className="panel premium-card community-announcement">
          <p className="eyebrow">Announcement</p>
          <h2>{details.announcements[0].title}</h2>
          <p>{details.announcements[0].body}</p>
        </section>
      )}

      <div className="community-layout">
        <section className="panel premium-card">
          <div className="admin-card__header">
            <div><p className="eyebrow">Rooms</p><h2>Community rooms</h2></div>
            {canManage && <button className="button button--small" type="button" onClick={onCreateRoom}>New Room</button>}
          </div>
          {(details.rooms || []).length === 0 ? <p className="muted">No community rooms yet.</p> : (
            <div className="saved-room-list">
              {details.rooms.map((room) => {
                const roomCategory = getCategoryConfig(room.categorySlug || room.category);
                return (
                <article className={cn(`saved-room saved-room--structured community-room-card ${roomCategory.accentClass}`, 'community-room-card--room')} key={room.roomId}>
                  <div className="saved-room__body">
                    <div className="saved-room__title-row">
                      <strong>{room.title}</strong>
                    </div>
                    <div className="saved-room__meta">
                      <CategoryBadge category={roomCategory.slug} compact />
                      <span>{room.type || 'room'}</span>
                      {room.roomPurpose && <span>{room.roomPurpose}</span>}
                    </div>
                    {room.latestMessagePreview && <p className="saved-room__preview">{room.latestMessagePreview}</p>}
                  </div>
                  <div className="saved-room__actions">
                    <button className="button button--small" type="button" onClick={() => onOpenRoom(room)}>Join</button>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel premium-card">
          <div className="admin-card__header">
            <div><p className="eyebrow">Events</p><h2>Scheduled chats</h2></div>
            {canManage && <button className="button button--small" type="button" onClick={onCreateEvent}>New Event</button>}
          </div>
          {(details.events || []).length === 0 ? <p className="muted">No events scheduled.</p> : (
            <div className="saved-room-list">
              {details.events.map((event) => (
                <article className="saved-room saved-room--structured community-room-card community-room-card--event event-card" key={event.eventId}>
                  <div className="saved-room__body">
                    <div className="saved-room__title-row">
                      <strong>{event.title}</strong>
                    </div>
                    <div className="saved-room__meta">
                      <span>{event.status}</span>
                      <span>{formatDate(event.startsAt)}</span>
                    </div>
                    {event.description && <p className="saved-room__preview">{event.description}</p>}
                  </div>
                  <div className="saved-room__actions">
                    <button className="button button--small" type="button" onClick={() => onOpenEvent(event)}>Open</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel premium-card">
        <div className="admin-card__header">
          <div><p className="eyebrow">Rules and activity</p><h2>Community safety</h2></div>
          {canAnnounce && <button className="button button--small" type="button" onClick={onScheduleAnnouncement}>Schedule Announcement</button>}
        </div>
        <p>{community.rules}</p>
        {!community.rules && (
          <ul>
            {getCategoryDefaultRules(community.categorySlug || community.category).map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        )}
        <div className="activity-timeline">
          {(details.activity || []).slice(0, 8).map((activity) => (
            <span key={activity.activityId}>{activity.actorName} · {activity.type.replaceAll('_', ' ')} · {formatDate(activity.createdAt)}</span>
          ))}
        </div>
      </section>
    </main>
  );
}

export function CommunitySettings({ details, onBack, onSave, onRoleChange, onBanMember, onDeleteCommunity }) {
  const community = details?.community;
  const membership = details?.membership;
  const [name, setName] = useState(community?.name || '');
  const [description, setDescription] = useState(community?.description || '');
  const [rules, setRules] = useState(community?.rules || '');
  const [visibility, setVisibility] = useState(community?.visibility || 'public');

  if (!community) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ name, description, rules, visibility });
  }

  return (
    <main className={cn('form-page premium-page', tw.pageWide)}>
      <form className={cn('panel room-form entrance-card room-builder glass-panel', tw.glass, 'space-y-6 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="room-builder__intro">
          <p className="eyebrow">Community settings</p>
          <h1>{community.name}</h1>
          <p className="muted">Keep rules clear and member roles intentional.</p>
        </div>
        <section className="form-group-card">
          <label className="field"><span>Name</span><input className={tw.input} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Description</span><textarea className={tw.input} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field"><span>Visibility</span><select className={tw.input} value={visibility} onChange={(event) => setVisibility(event.target.value)}>{COMMUNITY_VISIBILITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Rules</span><textarea className={tw.input} value={rules} onChange={(event) => setRules(event.target.value)} /></label>
        </section>
        <section className="form-group-card">
          <div><p className="eyebrow">Members</p><h2>Roles and safety</h2></div>
          {(details.members || []).map((member) => (
            <div className="member-row" key={member.memberId}>
              <span>{member.displayName}</span>
              <strong>{member.role}</strong>
              {member.role !== 'owner' && (
                <div>
                  <button className="button button--small" type="button" onClick={() => onRoleChange(member, member.role === 'moderator' ? 'member' : 'moderator')}>Toggle Mod</button>
                  <button className="button button--danger button--small" type="button" onClick={() => onBanMember(member)}>Ban</button>
                </div>
              )}
            </div>
          ))}
        </section>
        {membership?.role === 'owner' && (
          <section className="form-group-card community-danger-zone">
            <div>
              <p className="eyebrow">Owner danger zone</p>
              <h2>Delete community</h2>
              <p className="muted">
                Close this community and remove it from discovery. This action needs confirmation.
              </p>
            </div>
            <button className="button button--danger" type="button" onClick={onDeleteCommunity}>
              Delete Community
            </button>
          </section>
        )}
        <div className="form-actions">
          <button className="button button--ghost" type="button" onClick={onBack}>Back</button>
          <button className="button button--primary" type="submit">Save Settings</button>
        </div>
      </form>
    </main>
  );
}

export function EventEditor({ community, onBack, onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [category, setCategory] = useState(getCategorySlug(community?.categorySlug || community?.category || 'study'));
  const [visibility, setVisibility] = useState('public');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ title, description, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt), category, visibility, communityId: community?.communityId || '' });
  }

  return (
    <main className={cn('form-page premium-page', tw.pageWide)}>
      <form className={cn('panel room-form entrance-card room-builder glass-panel', tw.glass, 'space-y-6 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="room-builder__intro">
          <p className="eyebrow">Event room</p>
          <h1>Schedule a live chat</h1>
          <p className="muted">Before start, members see a calm lobby. When live, it behaves like a normal room.</p>
        </div>
        <section className="form-group-card">
          <label className="field"><span>Title</span><input className={tw.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="JEE Night Study Sprint" /></label>
          <label className="field"><span>Description</span><textarea className={tw.input} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="field"><span>Starts</span><input className={tw.input} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label className="field"><span>Ends</span><input className={tw.input} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          <label className="field"><span>Category</span><select className={tw.input} value={category} onChange={(event) => setCategory(event.target.value)}>{COMMUNITY_CATEGORY_OPTIONS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
          <label className="field"><span>Visibility</span><select className={tw.input} value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>public</option><option>private</option></select></label>
        </section>
        <div className="form-actions">
          <button className="button button--ghost" type="button" onClick={onBack}>Back</button>
          <button className="button button--primary" type="submit">Create Event</button>
        </div>
      </form>
    </main>
  );
}

export function EventLobby({ event, isLoggedIn, onBack, onJoinRoom, onRsvp, onLogin }) {
  if (!event) {
    return null;
  }

  return (
    <main className={cn('event-lobby premium-page', tw.pageWide)}>
      <section className="community-hero premium-card">
        <button className="button button--ghost" type="button" onClick={onBack}>Back</button>
        <div className="community-hero__body">
          <div className="community-avatar avatar-ring">E</div>
          <div>
            <p className="eyebrow">{event.status} event · <CategoryBadge category={event.categorySlug || event.category} compact /></p>
            <h1>{event.title}</h1>
            <p>{event.description || 'A scheduled Nexus Chat event room.'}</p>
            <div className="header-stat-row">
              <span>Starts {formatDate(event.startsAt)}</span>
              <span>Ends {formatDate(event.endsAt)}</span>
              <span>Hosted by {event.hostName}</span>
            </div>
          </div>
        </div>
        <div className="community-hero__actions">
          {isLoggedIn ? EVENT_RSVP_STATUSES.slice(0, 2).map((status) => (
            <button className="button button--soft" key={status} type="button" onClick={() => onRsvp(status)}>{status}</button>
          )) : <button className="button button--soft" type="button" onClick={onLogin}>Login to RSVP</button>}
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={onJoinRoom} disabled={event.status === 'cancelled'}>
            {event.status === 'scheduled' ? 'Enter Lobby' : event.status === 'ended' ? 'View History' : 'Join Live Room'}
          </button>
        </div>
      </section>
    </main>
  );
}

export function ScheduledAnnouncementManager({ communities = [], rooms = [], onBack, onSubmit }) {
  const [targetType, setTargetType] = useState('community');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scheduledFor, setScheduledFor] = useState(toLocalInput(new Date(Date.now() + 15 * 60 * 1000)));
  const targets = targetType === 'community' ? communities : rooms.map((relationship) => relationship.room || relationship);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ targetType, targetId, title, body, scheduledFor: fromLocalInput(scheduledFor) });
  }

  return (
    <main className={cn('form-page premium-page', tw.pageWide)}>
      <form className={cn('panel room-form entrance-card room-builder glass-panel', tw.glass, 'space-y-6 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="room-builder__intro">
          <p className="eyebrow">Scheduled announcements</p>
          <h1>Publish at the right moment</h1>
          <p className="muted">A bounded server scheduler publishes due announcements after restart or interval ticks.</p>
        </div>
        <section className="form-group-card">
          <label className="field"><span>Target type</span><select className={tw.input} value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="community">community</option><option value="room">room</option></select></label>
          <label className="field"><span>Target</span><select className={tw.input} value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose target</option>{targets.map((item) => <option key={item.communityId || item.roomId} value={item.communityId || item.roomId}>{item.name || item.title}</option>)}</select></label>
          <label className="field"><span>Title</span><input className={tw.input} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field"><span>Body</span><textarea className={tw.input} value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <label className="field"><span>Publish time</span><input className={tw.input} type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label>
        </section>
        <div className="form-actions">
          <button className="button button--ghost" type="button" onClick={onBack}>Back</button>
          <button className="button button--primary" type="submit">Schedule</button>
        </div>
      </form>
    </main>
  );
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'soon';
}

function toLocalInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function formatCommunityFilter(value) {
  if (value === 'all') {
    return 'All';
  }

  if (value === 'trending' || value === 'new') {
    return `${value[0].toUpperCase()}${value.slice(1)}`;
  }

  return getCategoryConfig(value).label;
}
