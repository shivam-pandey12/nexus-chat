import { useMemo, useState } from 'react';

import CategoryBadge from './CategoryBadge.jsx';
import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

export default function NotificationCenter({
  notifications = [],
  unreadCount = 0,
  loading = false,
  isLoggedIn = false,
  onOpen,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
  onActivate,
}) {
  const [open, setOpen] = useState(false);
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !notification.dismissedAt).slice(0, 50),
    [notifications],
  );

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      onOpen?.();
    }
  }

  function activateNotification(notification) {
    if (!notification.readAt) {
      onMarkRead?.(notification.notificationId);
    }

    if (notification.targetUrl?.startsWith('/room/')) {
      window.history.replaceState(null, '', notification.targetUrl);
    }

    onActivate?.(notification);
  }

  return (
    <div className={`notification-center ${open ? 'is-open' : ''}`}>
      <button className="notification-bell relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" type="button" onClick={toggleOpen} aria-label="Open notifications">
        <span aria-hidden="true"><Icon name="bell" size={21} /></span>
        {unreadCount > 0 && <strong>{unreadCount > 99 ? '99+' : unreadCount}</strong>}
      </button>

      {open && (
        <section className={cn('notification-panel glass-panel', tw.glass, 'fixed inset-x-3 top-[92px] z-50 max-h-[75vh] overflow-hidden p-4 sm:left-auto sm:right-6 sm:w-[420px]')}>
          <div className="notification-panel__head">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</h2>
            </div>
            <div className="notification-panel__actions flex items-center gap-2">
              <button className={cn('button button--ghost button--small', tw.buttonGhost, 'min-h-9 px-4 py-2')} type="button" onClick={onMarkAllRead}>
                Mark all read
              </button>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close notifications">
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {!isLoggedIn && (
            <div className="notification-note">
              Guest notifications stay in this browser. Login to sync mentions and replies.
            </div>
          )}

          {loading ? (
            <div className="notification-list grid gap-3">
              {[1, 2, 3].map((item) => (
                <div className={cn('notification-card loading-skeleton', tw.cardCompact, 'min-h-[92px] animate-pulse')} key={item} />
              ))}
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className={cn('empty-state empty-state--compact', tw.glassSoft, 'p-6 text-center')}>
              <span className="empty-state__sigil" aria-hidden="true" />
              <h3>No new notifications</h3>
              <p>Mentions, replies, announcements, and account updates will land here.</p>
            </div>
          ) : (
            <div className="notification-list premium-scroll grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
              {visibleNotifications.map((notification) => (
                <article
                  className={cn(`notification-card ${notification.readAt ? '' : 'is-unread'}`, tw.cardCompact, notification.readAt ? '' : 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_80%)]')}
                  key={notification.notificationId}
                >
                  <button type="button" onClick={() => activateNotification(notification)}>
                    <span className={`notification-card__type notification-card__type--${notification.type}`} aria-hidden="true" />
                    <div>
                      <strong>{notification.title}</strong>
                      {notification.body && <p>{notification.body}</p>}
                      {notification.metadata?.categorySlug && (
                        <CategoryBadge category={notification.metadata.categorySlug} compact />
                      )}
                      <small>{formatTime(notification.createdAt)}</small>
                    </div>
                  </button>
                  <div className="notification-card__actions">
                    {!notification.readAt && (
                      <button type="button" onClick={() => onMarkRead?.(notification.notificationId)}>
                        Read
                      </button>
                    )}
                    <button type="button" onClick={() => onDismiss?.(notification.notificationId)}>
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatTime(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'Just now';
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(diff / 60000));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Intl.DateTimeFormat([], { dateStyle: 'short' }).format(new Date(value));
}
