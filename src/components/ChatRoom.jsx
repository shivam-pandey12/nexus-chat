import { useEffect, useMemo, useRef, useState } from 'react';

import { ROOM_THEME_PRESETS } from '../../shared/billingCatalog.js';
import { CHAT_LIMITS, REACTION_EMOJIS } from '../../shared/chatConfig.js';
import { STATIC_TOPIC_PROMPTS, detectCodingSecretRisk, getCategoryConfig, getCategoryDefaultRules, isToolEnabledForCategory } from '../../shared/categoryConfig.js';
import { getAvatar } from '../data/avatars.js';
import AvatarBadge from './AvatarBadge.jsx';
import CategoryBadge from './CategoryBadge.jsx';
import CategoryToolsPanel, { CategoryQuickTools } from './CategoryToolsPanel.jsx';
import Icon from './Icon.jsx';
import MiniProfileCard from './MiniProfileCard.jsx';
import ReportModal from './ReportModal.jsx';
import { cn, tw } from './ui/premium.js';

const SAFETY_BANNER_KEY = 'nexusChat.publicRoomSafetyDismissed.v1';

export default function ChatRoom({
  state,
  profile,
  connectionState,
  error,
  onSend,
  onLeave,
  onRename,
  onLock,
  onDelete,
  onReact,
  onDeleteMessage,
  onReport,
  onMuteUser,
  onUnmuteUser,
  onKickUser,
  onBanUser,
  onUnbanUser,
  onSetRole,
  onSaveRules,
  onCreateAnnouncement,
  onUpdateRoomNotifications,
  onClearRecentMessages,
  onCategoryToolAction,
  onSendCardMessage,
  billingSummary = null,
  onApplyRoomTheme,
  onOpenStore,
  onLoadProfile,
  isFavorite = false,
  onToggleFavorite,
  blockedUsers = [],
  onBlockUser,
  onUnblockUser,
  onTypingStart,
  onTypingStop,
  onToast,
}) {
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState('');
  const [newTitle, setNewTitle] = useState(state?.room?.title || '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [shownBlockedMessages, setShownBlockedMessages] = useState(() => new Set());
  const [safetyDismissed, setSafetyDismissed] = useState(() => localStorage.getItem(SAFETY_BANNER_KEY) === 'true');
  const [rulesDraft, setRulesDraft] = useState(state?.room?.rules || '');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [codeMode, setCodeMode] = useState(false);
  const [secretWarningAccepted, setSecretWarningAccepted] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef(new Map());
  const typingStopTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const onTypingStopRef = useRef(onTypingStop);

  const room = state?.room;
  const messages = state?.messages || [];
  const users = state?.users || [];
  const typingUsers = state?.typingUsers || [];
  const isOwner = Boolean(state?.currentUser?.isOwner || room?.ownerSessionId === profile?.sessionId);
  const canModerate = Boolean(state?.currentUser?.canModerate || isOwner);
  const isMuted = Boolean(state?.currentUser?.isMuted);
  const activeAnnouncement = (state?.announcements || []).find((announcement) => announcement.active);
  const blockedSet = useMemo(() => new Set(blockedUsers), [blockedUsers]);
  const roomCategory = getCategoryConfig(room?.categorySlug || room?.category);
  const categoryTools = state?.categoryTools || [];
  const codingSecretRisk = roomCategory.slug === 'coding' ? detectCodingSecretRisk(draft) : { risky: false };

  useEffect(() => {
    setNewTitle(room?.title || '');
  }, [room?.title]);

  useEffect(() => {
    setRulesDraft(room?.rules || '');
  }, [room?.rules]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    onTypingStopRef.current = onTypingStop;
  }, [onTypingStop]);

  useEffect(() => () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    onTypingStopRef.current?.();
  }, []);

  const inviteLink = useMemo(() => {
    if (!room?.inviteCode) {
      return '';
    }

    return `${window.location.origin}/room/${room.inviteCode}`;
  }, [room?.inviteCode]);

  if (!room) {
    return (
      <main className={cn('form-page', tw.page, 'flex min-h-[60vh] items-center justify-center')}>
        <div className={cn('empty-state', tw.glassSoft, 'max-w-xl p-8 text-center')}>
          <h1>No room found</h1>
          <p>The room may have closed or the invite code may be invalid.</p>
        </div>
      </main>
    );
  }

  function submitMessage(event) {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    if (isMuted) {
      onToast?.('You are muted in this room.', 'error');
      return;
    }

    if (codeMode && codingSecretRisk.risky && !secretWarningAccepted) {
      onToast?.('This code may contain credentials. Review it, then confirm if it is safe.', 'error');
      return;
    }

    onSend(draft, replyTarget, {
      messageType: codeMode ? 'code_snippet' : 'text',
      categoryToolType: codeMode ? 'code_snippet_mode' : '',
      secretWarningAccepted,
    });
    setDraft('');
    setReplyTarget(null);
    setSecretWarningAccepted(false);
    onTypingStop?.();
  }

  function handleDraftChange(value) {
    setDraft(value);
    setSecretWarningAccepted(false);

    if (!value.trim()) {
      onTypingStop?.();
      return;
    }

    const now = Date.now();

    if (now - lastTypingSentRef.current > CHAT_LIMITS.TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      onTypingStart?.();
    }

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 1400);
  }

  function insertMention(user) {
    const token = `@${(user.handle || user.displayName || 'User').replace(/\s+/g, '')} `;
    setDraft((current) => current.replace(/@[\p{L}\p{N}._-]*$/u, token));
  }

  function insertComposerText(text) {
    setDraft((current) => `${current}${current.trim() ? '\n' : ''}${text}`);
  }

  function sendRandomTopic() {
    const topic = STATIC_TOPIC_PROMPTS[Math.floor(Math.random() * STATIC_TOPIC_PROMPTS.length)];
    onSendCardMessage?.('topic_card', topic, { topic }, 'topic_spinner');
  }

  function handleCategoryMessageAction(message, toolType, label) {
    if (!room || !message?.messageId) {
      return;
    }

    onCategoryToolAction?.(
      toolType === 'fix_solved_marker' ? 'categoryTool:markSolved' : 'categoryTool:create',
      {
        toolType,
        targetMessageId: message.messageId,
        title: label,
        body: message.content || label,
      },
      { success: label },
    );
  }

  function setMessageRef(messageId, node) {
    if (!node) {
      messageRefs.current.delete(messageId);
      return;
    }

    messageRefs.current.set(messageId, node);
  }

  function jumpToMessage(messageId) {
    const node = messageRefs.current.get(messageId);

    if (!node) {
      onToast?.('Original message is no longer loaded.', 'error');
      return;
    }

    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId(''), 1600);
  }

  async function copyInviteLink() {
    await copyText(inviteLink);
    onToast?.('Invite link copied');
  }

  async function copyRoomCode() {
    await copyText(room.inviteCode);
    onToast?.('Room code copied');
  }

  async function copyMessageText(content) {
    await copyText(content);
    onToast?.('Message copied');
  }

  function openReport(target) {
    setReportTarget(target);
  }

  async function openProfile(target) {
    setProfileTarget(target);
    setProfilePreview(null);

    if (!onLoadProfile || !(target.userId || target.sessionId)) {
      return;
    }

    setProfileLoading(true);

    try {
      const loaded = await onLoadProfile(target.userId || target.sessionId);
      setProfilePreview(loaded?.profile || loaded || null);
    } catch {
      setProfilePreview(null);
    } finally {
      setProfileLoading(false);
    }
  }

  function submitReport(payload) {
    onReport?.(payload);
    setReportTarget(null);
  }

  function submitAnnouncement(event) {
    event.preventDefault();

    if (!announcementTitle.trim() || !announcementBody.trim()) {
      onToast?.('Announcement title and body are required.', 'error');
      return;
    }

    onCreateAnnouncement?.({ title: announcementTitle, body: announcementBody });
    setAnnouncementTitle('');
    setAnnouncementBody('');
  }

  function dismissSafetyBanner() {
    localStorage.setItem(SAFETY_BANNER_KEY, 'true');
    setSafetyDismissed(true);
  }

  function showBlockedMessageOnce(messageId) {
    setShownBlockedMessages((current) => new Set([...current, messageId]));
  }

  const typingLabel = getTypingLabel(typingUsers);
  const mentionSuggestions = getMentionSuggestions(draft, users, profile.sessionId);

  return (
    <main className={cn(`chat-shell premium-page room-theme--${room.themeId || 'classic'} ${roomCategory.accentClass} ${roomCategory.themeClass}`, tw.chatShell)}>
      <section className={cn('chat-panel', tw.chatPanel)}>
        <header className={cn('chat-header', tw.chatHeader)}>
          <div className="chat-header__identity min-w-0 space-y-2">
            <p className={cn('eyebrow', tw.eyebrow)}>Nexus room</p>
            <h1 className="truncate text-3xl font-black tracking-normal text-[var(--text)] sm:text-4xl">{room.title}</h1>
            <div className="chat-header__meta flex flex-wrap gap-2">
              <CategoryBadge category={roomCategory.slug} />
              <span className={cn('pill pill--muted', tw.pill)}>{room.type}</span>
              {room.communityName && <span className="pill pill--muted">{room.communityName}</span>}
              {room.eventRoomId && <span className="pill pill--live">event room</span>}
              <span className={`pill ${room.isLocked ? 'pill--locked' : 'pill--live'}`}>
                {room.isLocked ? 'locked' : 'open'}
              </span>
              <span className="pill pill--muted">{room.memberCount} online</span>
              <span className={`connection connection--${connectionState}`}>
                {formatConnectionState(connectionState)}
              </span>
            </div>
          </div>
          <div className="chat-header__actions flex flex-wrap gap-2 lg:justify-end">
            <button className={cn(`button ${isFavorite ? 'button--soft' : 'button--ghost'}`, isFavorite ? tw.buttonSoft : tw.buttonGhost, 'min-h-10 px-4 py-2')} type="button" onClick={() => onToggleFavorite?.(room, !isFavorite)}>
              {isFavorite ? 'Pinned' : 'Pin'}
            </button>
            <button className={cn('button button--ghost users-toggle', tw.buttonGhost, 'min-h-10 px-4 py-2')} type="button" onClick={() => setDrawerOpen(true)}>
              Room Info
            </button>
            <button className={cn('button button--soft', tw.buttonSoft, 'min-h-10 px-4 py-2')} type="button" onClick={copyInviteLink}>
              Copy Invite Link
            </button>
            <button className={cn('button button--ghost', tw.buttonGhost, 'min-h-10 px-4 py-2')} type="button" onClick={onLeave}>
              Leave
            </button>
          </div>
        </header>

        {connectionState !== 'connected' && (
          <div className="notice notice--connection">Connection is {formatConnectionState(connectionState).toLowerCase()}.</div>
        )}
        {error && <div className="notice notice--error">{error}</div>}
        {isMuted && <div className="notice notice--error">You are muted in this room.</div>}
        {room.type === 'public' && !safetyDismissed && (
          <div className={cn('safety-banner', tw.cardCompact, 'mx-3 mt-3 flex flex-col gap-3 sm:mx-5 sm:flex-row sm:items-center sm:justify-between')}>
            <div>
              <strong>Room safety</strong>
              <p>{roomCategory.safetyReminder}</p>
            </div>
            <button className={cn('button button--ghost button--small', tw.buttonGhost, 'min-h-9 px-4 py-2')} type="button" onClick={dismissSafetyBanner}>
              Dismiss
            </button>
          </div>
        )}
        {activeAnnouncement && (
          <div className={cn('announcement-banner', tw.cardCompact, 'mx-3 mt-3 flex gap-3 sm:mx-5')}>
            <span className="announcement-banner__mark" aria-hidden="true" />
            <div>
              <strong>{activeAnnouncement.title}</strong>
              <p>{activeAnnouncement.body}</p>
            </div>
          </div>
        )}

        <div className={cn('messages premium-scroll', tw.messageList)} aria-live="polite">
          {messages.length === 0 ? (
            <div className={cn('empty-state empty-state--compact', tw.glassSoft, 'm-auto max-w-md p-7 text-center')}>
              <span className="empty-state__sigil" aria-hidden="true" />
              <h2>No messages yet</h2>
              <p>Send the first message when someone joins.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isBlocked =
                message.type !== 'system' &&
                isBlockedTarget(blockedSet, message) &&
                !shownBlockedMessages.has(message.messageId);
              const isMine =
                Boolean(profile?.userId && message.senderUserId && message.senderUserId === profile.userId) ||
                Boolean(profile?.sessionId && message.senderSessionId && message.senderSessionId === profile.sessionId);

              if (isBlocked) {
                return (
                  <BlockedMessage
                    key={message.messageId}
                    message={message}
                    onShowOnce={() => showBlockedMessageOnce(message.messageId)}
                    onUnblock={() => onUnblockUser?.(blockKeyFor(message), message.senderName)}
                  />
                );
              }

              return (
                <MessageBubble
                  key={message.messageId}
                  message={message}
                  isMine={isMine}
                  isOwner={canModerate}
                  isHighlighted={highlightedMessageId === message.messageId}
                  onRef={setMessageRef}
                  onReply={() => setReplyTarget(message)}
                  onReact={(emoji) => onReact(message.messageId, emoji)}
                  onCopy={() => copyMessageText(message.content)}
                  onDelete={() => onDeleteMessage(message.messageId)}
                  onReportMessage={() =>
                    openReport({
                      targetType: 'message',
                      targetId: message.messageId,
                      roomId: room.roomId,
                      label: 'Report message',
                    })
                  }
                  onReportUser={() =>
                    openReport({
                      targetType: 'user',
                      targetId: message.senderSessionId,
                      roomId: room.roomId,
                      label: `Report ${message.senderName}`,
                    })
                  }
                  onBlockUser={() => onBlockUser?.(toBlockTarget(message))}
                  onOpenProfile={() => openProfile(toProfileTarget(message))}
                  onJumpToReply={jumpToMessage}
                  roomCategory={roomCategory.slug}
                  onCategoryMessageAction={(toolType, label) => handleCategoryMessageAction(message, toolType, label)}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {typingLabel && (
          <div className="typing-banner">
            <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
            {typingLabel}
          </div>
        )}

        <form className={cn('composer composer--phase2', tw.composer)} onSubmit={submitMessage}>
          {replyTarget && (
            <div className={cn('composer-reply', tw.cardCompact, 'mb-3 flex items-center justify-between gap-3')}>
              <div>
                <strong>Replying to {replyTarget.senderName}</strong>
                <p>{replyTarget.content || 'Message deleted'}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
          <CategoryQuickTools
            room={room}
            codeMode={codeMode}
            draft={draft}
            onToggleCodeMode={() => setCodeMode((current) => !current)}
            onInsertComposerText={insertComposerText}
            onSendTopic={sendRandomTopic}
          />
          {codeMode && codingSecretRisk.risky && (
              <div className={cn('composer-warning', tw.cardCompact, 'mb-3 flex flex-wrap items-center gap-3')}>
              <Icon name="shield" size={16} />
              <span>Possible credential-like text detected. Remove secrets before sending.</span>
              <button className={cn('button button--ghost button--small', tw.buttonGhost, 'min-h-9 px-4 py-2')} type="button" onClick={() => setSecretWarningAccepted(true)}>
                I reviewed it
              </button>
            </div>
          )}
          <div className="composer__input-wrap relative">
            <textarea
              className={cn(codeMode ? 'is-code-mode' : '', tw.input, 'min-h-[58px] resize-none pr-4')}
              maxLength={codeMode ? CHAT_LIMITS.MAX_CODE_SNIPPET_LENGTH : CHAT_LIMITS.MAX_MESSAGE_LENGTH}
              value={draft}
              placeholder={codeMode ? 'Paste code as plain text. Never include secrets.' : 'Write a message...'}
              onBlur={() => onTypingStop?.()}
              onChange={(event) => handleDraftChange(event.target.value)}
              disabled={isMuted}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(event);
                }
              }}
            />
            {mentionSuggestions.length > 0 && (
              <div className={cn('mention-suggestions', tw.glassSoft, 'absolute bottom-full left-0 z-30 mb-2 w-full max-w-md p-2')} role="listbox" aria-label="Mention suggestions">
                {mentionSuggestions.map((user) => (
                  <button key={user.sessionId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(user)}>
                    <AvatarBadge avatarId={user.avatar} photoURL={user.photoURL || ''} size="sm" />
                    <span>{user.displayName}</span>
                    {user.handle && <em>@{user.handle}</em>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={cn('button button--primary composer__send', tw.buttonPrimary)} type="submit" disabled={!draft.trim() || isMuted}>
            Send
          </button>
        </form>
      </section>

      <aside className={cn(`side-panel ${drawerOpen ? 'is-open' : ''}`, tw.drawer, drawerOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')}>
        <button className="icon-button side-panel__close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close room drawer">
          <Icon name="close" size={18} />
        </button>
        <section className={cn('panel room-info drawer-card', tw.glassSoft, 'mb-4 p-5')}>
          <p className={cn('eyebrow', tw.eyebrow)}>Room info</p>
          <h2>{room.title}</h2>
          <div className="info-grid">
            <span>Type</span>
            <strong>{room.type}</strong>
            <span>Category</span>
            <strong>{roomCategory.label}</strong>
            {room.communityName && (
              <>
                <span>Community</span>
                <strong>{room.communityName}</strong>
              </>
            )}
            {room.roomPurpose && (
              <>
                <span>Purpose</span>
                <strong>{room.roomPurpose}</strong>
              </>
            )}
            <span>Invite code</span>
            <strong>{room.inviteCode}</strong>
            <span>Members</span>
            <strong>{room.memberCount}</strong>
            <span>Created</span>
            <strong>{formatDateTime(room.createdAt)}</strong>
            {room.type === 'temp' && room.expiresAt && (
              <>
                <span>Expires</span>
                <strong>{formatDateTime(room.expiresAt)}</strong>
              </>
            )}
            <span>Owner</span>
            <strong>{room.ownerName || 'Owner'}</strong>
            <span>Status</span>
            <strong>{room.isLocked ? 'Locked' : 'Open'}</strong>
            <span>Theme</span>
            <strong>{formatThemeTitle(room.themeId)}</strong>
            <span>Capacity</span>
            <strong>{room.maxMembers || CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM}</strong>
          </div>
          <div className="stacked-actions">
            <button className={`button button--wide ${isFavorite ? 'button--soft' : 'button--ghost'}`} type="button" onClick={() => onToggleFavorite?.(room, !isFavorite)}>
              {isFavorite ? 'Pinned to My Rooms' : 'Pin Room'}
            </button>
            <button className="button button--soft button--wide" type="button" onClick={copyInviteLink}>
              Copy Invite Link
            </button>
            <button className="button button--ghost button--wide" type="button" onClick={copyRoomCode}>
              Copy Room Code
            </button>
            <button
              className="button button--ghost button--wide"
              type="button"
              onClick={() => onUpdateRoomNotifications?.({ notificationsEnabled: true, notificationsMuted: true, snooze: '8h' })}
            >
              Snooze Room 8h
            </button>
            <button
              className="button button--ghost button--wide"
              type="button"
              onClick={() => onUpdateRoomNotifications?.({ notificationsEnabled: true, notificationsMuted: false, mutedUntil: null })}
            >
              Unmute Room
            </button>
            <button className="button button--ghost button--wide" type="button" onClick={onLeave}>
              Leave Room
            </button>
            <button
              className="button button--ghost button--wide"
              type="button"
              onClick={() =>
                openReport({
                  targetType: 'room',
                  targetId: room.roomId,
                  roomId: room.roomId,
                  label: 'Report room',
                })
              }
            >
              Report Room
            </button>
            {isOwner && (
              <button
                className="button button--soft button--wide"
                type="button"
                onClick={() => document.getElementById('owner-tools')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Owner Controls
              </button>
            )}
          </div>
          <div className="room-rules">
            <p className="eyebrow">Room rules</p>
            {room.rules ? <p>{room.rules}</p> : <DefaultRules category={roomCategory.slug} />}
          </div>
          <div className="room-rules">
            <p className="eyebrow">Announcements</p>
            {(state?.announcements || []).length === 0 ? (
              <p className="muted">No active announcements.</p>
            ) : (
              <div className="announcement-list">
                {(state?.announcements || []).map((announcement) => (
                  <article className="announcement-card" key={announcement.announcementId}>
                    <strong>{announcement.title}</strong>
                    <p>{announcement.body}</p>
                    <small>{formatDateTime(announcement.createdAt)}</small>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <CategoryToolsPanel
          room={room}
          tools={categoryTools}
          canModerate={canModerate}
          currentSessionId={profile.sessionId}
          codeMode={codeMode}
          onToggleCodeMode={() => setCodeMode((current) => !current)}
          onInsertComposerText={insertComposerText}
          onToolAction={onCategoryToolAction}
          onSendCardMessage={onSendCardMessage}
          onToast={onToast}
        />

        {isOwner && (
          <section className={cn('panel owner-tools drawer-card', tw.drawerSection, 'mb-4')} id="owner-tools">
            <p className="eyebrow">Owner controls</p>
            <label className="field">
              <span>Rename room</span>
              <input value={newTitle} maxLength={54} onChange={(event) => setNewTitle(event.target.value)} />
            </label>
            <button className="button button--soft button--wide" type="button" onClick={() => onRename(newTitle)}>
              Rename
            </button>
            <button className="button button--ghost button--wide" type="button" onClick={() => onLock(!room.isLocked)}>
              {room.isLocked ? 'Unlock Room' : 'Lock Room'}
            </button>
            <label className="field">
              <span>Custom rules</span>
              <textarea
                value={rulesDraft}
                maxLength={600}
                placeholder="Default safety rules apply when this is empty."
                onChange={(event) => setRulesDraft(event.target.value)}
              />
            </label>
            <button className="button button--soft button--wide" type="button" onClick={() => onSaveRules?.(rulesDraft)}>
              Save Rules
            </button>
            <RoomThemePicker
              currentThemeId={room.themeId || 'classic'}
              billingSummary={billingSummary}
              onApplyRoomTheme={onApplyRoomTheme}
              onOpenStore={onOpenStore}
            />
            <button className="button button--danger button--wide" type="button" onClick={onDelete}>
              Delete Room
            </button>
            <button className="button button--danger button--wide" type="button" onClick={onClearRecentMessages}>
              Clear Recent Messages
            </button>
          </section>
        )}

        {canModerate && (
          <section className={cn('panel announcement-tools drawer-card', tw.drawerSection, 'mb-4')}>
            <p className="eyebrow">Announcements</p>
            <h2>Post room update</h2>
            <form className="announcement-form" onSubmit={submitAnnouncement}>
              <label className="field">
                <span>Title</span>
                <input
                  value={announcementTitle}
                  maxLength={80}
                  placeholder="Study session starts in 10 minutes"
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Body</span>
                <textarea
                  value={announcementBody}
                  maxLength={600}
                  placeholder="Share a concise room update. No HTML is rendered."
                  onChange={(event) => setAnnouncementBody(event.target.value)}
                />
              </label>
              <button className="button button--soft button--wide" type="submit">
                Post Announcement
              </button>
            </form>
          </section>
        )}

        {canModerate && state?.moderationState && (
          <section className={cn('panel room-moderation drawer-card', tw.drawerSection, 'mb-4')}>
            <p className="eyebrow">Moderation state</p>
            <h2>Muted and banned</h2>
            <ModerationShelf title="Muted" items={state.moderationState.muted || []} empty="No muted users." />
            <ModerationShelf
              title="Banned"
              items={state.moderationState.banned || []}
              empty="No banned users."
              onClear={(item) => onUnbanUser?.(item.memberId)}
            />
          </section>
        )}

        <section className={cn('panel online-users drawer-card', tw.drawerSection, 'mb-4')}>
          <p className="eyebrow">Online users</p>
          <h2>{users.length} online</h2>
          <div className="user-list">
            {users.map((user) => (
              <div className="user-row" key={user.sessionId}>
                <button className="user-row__profile" type="button" onClick={() => openProfile(toProfileTarget(user))}>
                  <AvatarBadge avatarId={user.avatar} photoURL={user.photoURL || ''} />
                  <div>
                    <strong>
                    {user.displayName}
                    {user.sessionId === profile.sessionId && <em>you</em>}
                    </strong>
                    <span>
                    {user.isOwner ? 'Owner' : user.isModerator ? 'Moderator' : 'online'}
                    {user.isMuted ? ' · muted' : ''}
                    {typingUsers.some((item) => item.sessionId === user.sessionId) ? ' · typing' : ''}
                    </span>
                  </div>
                </button>
                {user.sessionId !== profile.sessionId && (
                  <UserActions
                    user={user}
                    isOwner={isOwner}
                    canModerate={canModerate}
                    isBlocked={isBlockedTarget(blockedSet, user)}
                    onReport={() =>
                      openReport({
                        targetType: 'user',
                        targetId: user.sessionId,
                        roomId: room.roomId,
                        label: `Report ${user.displayName}`,
                      })
                    }
                    onBlock={() => onBlockUser?.(toBlockTarget(user))}
                    onUnblock={() => onUnblockUser?.(blockKeyFor(user), user.displayName)}
                    onMute={() => onMuteUser?.(user.sessionId)}
                    onUnmute={() => onUnmuteUser?.(user.sessionId)}
                    onKick={() => onKickUser?.(user.sessionId)}
                    onBan={() => onBanUser?.(user.sessionId)}
                    onRole={() => onSetRole?.(user.sessionId, user.isModerator ? 'member' : 'moderator')}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={cn('panel blocked-users drawer-card', tw.drawerSection, 'mb-4')}>
          <p className="eyebrow">Blocked users</p>
          {blockedUsers.length === 0 ? (
            <p className="muted">No blocked users in this browser.</p>
          ) : (
            <div className="stacked-actions">
              {blockedUsers.map((sessionId) => {
                const user = users.find((item) => item.sessionId === sessionId);
                return (
                  <button
                    className="button button--ghost button--wide"
                    key={sessionId}
                    type="button"
                    onClick={() => onUnblockUser?.(sessionId, user?.displayName || 'User')}
                  >
                    Unblock {user?.displayName || 'User'}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className={cn('panel room-activity drawer-card', tw.glassSoft, 'p-5')}>
          <p className={cn('eyebrow', tw.eyebrow)}>Activity</p>
          <h2>Room timeline</h2>
          {(state?.activity || []).length === 0 ? (
            <p className="muted">Important room events will appear here.</p>
          ) : (
            <div className="activity-timeline">
              {(state?.activity || []).slice(0, 20).map((activity) => (
                <article className="activity-item" key={activity.activityId}>
                  <span aria-hidden="true" />
                  <div>
                    <strong>{formatActivity(activity)}</strong>
                    <small>{formatDateTime(activity.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </aside>
      <ReportModal reportTarget={reportTarget} onClose={() => setReportTarget(null)} onSubmit={submitReport} />
      <MiniProfileCard
        target={profileTarget}
        profile={profilePreview}
        roomRole={profileTarget?.role || 'member'}
        loading={profileLoading}
        blocked={profileTarget ? isBlockedTarget(blockedSet, profileTarget) : false}
        canModerate={Boolean(
          profileTarget &&
            canModerate &&
            profileTarget.sessionId !== profile.sessionId &&
            profileTarget.role !== 'owner' &&
            (!profileTarget.isModerator || isOwner),
        )}
        canBan={Boolean(profileTarget && (isOwner || !profileTarget.isModerator))}
        onClose={() => setProfileTarget(null)}
        onReport={() => {
          openReport({
            targetType: 'user',
            targetId: profileTarget.sessionId,
            roomId: room.roomId,
            label: `Report ${profileTarget.displayName}`,
          });
          setProfileTarget(null);
        }}
        onBlock={() => onBlockUser?.(toBlockTarget(profileTarget))}
        onUnblock={() => onUnblockUser?.(blockKeyFor(profileTarget), profileTarget.displayName)}
        onMute={() => onMuteUser?.(profileTarget.sessionId)}
        onKick={() => onKickUser?.(profileTarget.sessionId)}
        onBan={() => onBanUser?.(profileTarget.sessionId)}
      />
    </main>
  );
}

function MessageBubble({
  message,
  isMine,
  isOwner,
  isHighlighted,
  onRef,
  onReply,
  onReact,
  onCopy,
  onDelete,
  onReportMessage,
  onReportUser,
  onBlockUser,
  onOpenProfile,
  onJumpToReply,
  roomCategory,
  onCategoryMessageAction,
}) {
  const time = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(message.createdAt));
  const avatar = getAvatar(message.senderAvatar);
  const isDeleted = Boolean(message.deletedAt);
  const canAct = message.type !== 'system' && !isDeleted;

  if (message.type === 'system') {
    return <div className={cn('system-message', tw.messageBubbleSystem)}><span />{message.content}</div>;
  }

  return (
    <article
      className={cn(`message ${isMine ? 'message--mine' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${
        isDeleted ? 'message--deleted' : ''
      }`, 'group flex w-full items-start gap-3', isMine ? 'justify-end' : 'justify-start', isHighlighted ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_72%)]' : '')}
      ref={(node) => onRef(message.messageId, node)}
    >
      <button className={cn('message__profile', isMine ? 'order-2' : '', 'shrink-0 rounded-full transition-transform hover:scale-105')} type="button" onClick={onOpenProfile}>
        <AvatarBadge avatarId={avatar.id} photoURL={message.senderPhotoURL || ''} size="sm" />
      </button>
      <div className={cn('message__body', isMine ? tw.messageBubbleMine : tw.messageBubbleOther)}>
        <header>
          <button type="button" onClick={onOpenProfile}>{message.senderName}</button>
          <span>{time}</span>
        </header>

        {message.replyToMessageId && (
          <button className={cn('reply-preview', 'mb-2 w-full rounded-[1rem] border border-[var(--line)] bg-[var(--surface-inset)] p-3 text-left')} type="button" onClick={() => onJumpToReply(message.replyToMessageId)}>
            <span>{message.replyToSenderName}</span>
            <p>{message.replyToContentSnippet}</p>
          </button>
        )}

        <MessageContent message={message} isDeleted={isDeleted} />

        {message.categoryMarkers?.length > 0 && (
          <div className="message-marker-row">
            {message.categoryMarkers.map((marker) => (
              <span className={`status-pill message-marker message-marker--${marker.status || 'open'}`} key={`${marker.toolType}_${marker.toolId}`}>
                {marker.label}
              </span>
            ))}
          </div>
        )}

        {message.reactions?.length > 0 && (
          <div className="reaction-row">
            {message.reactions.map((reaction) => (
              <button
                className={reaction.reactedByMe ? 'is-active' : ''}
                key={reaction.emoji}
                type="button"
                onClick={() => canAct && onReact(reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {canAct && (
        <details className={cn('message-menu action-menu opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100', tw.actionMenu)}>
          <summary aria-label={`Message actions for ${message.senderName}`}>Menu</summary>
          <div>
            <div className="action-menu__group">
              <button type="button" onClick={onReply}>
                Reply
              </button>
              <button type="button" onClick={onCopy}>
                Copy text
              </button>
              {(isMine || isOwner) && isToolEnabledForCategory('doubt_marker', roomCategory) && (
                <button type="button" onClick={() => onCategoryMessageAction?.('doubt_marker', 'Need help')}>
                  Need help
                </button>
              )}
              {(isMine || isOwner) && isToolEnabledForCategory('help_queue', roomCategory) && (
                <button type="button" onClick={() => onCategoryMessageAction?.('help_queue', 'Need help')}>
                  Add to help queue
                </button>
              )}
              {(isMine || isOwner) && isToolEnabledForCategory('fix_solved_marker', roomCategory) && (
                <button type="button" onClick={() => onCategoryMessageAction?.('fix_solved_marker', 'Fix found')}>
                  Fix found
                </button>
              )}
              {(isMine || isOwner) && isToolEnabledForCategory('feedback_request', roomCategory) && (
                <button type="button" onClick={() => onCategoryMessageAction?.('feedback_request', 'Feedback requested')}>
                  Request feedback
                </button>
              )}
            </div>
            <div className="reaction-picker" aria-label="React">
              {REACTION_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => onReact(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="action-menu__group action-menu__group--safety">
              {isMine && (
                <button className="danger-link" type="button" onClick={onDelete}>
                  Delete
                </button>
              )}
              {!isMine && isOwner && (
                <button className="danger-link" type="button" onClick={onDelete}>
                  Delete as owner
                </button>
              )}
              <button type="button" onClick={onReportMessage}>
                Report message
              </button>
              {!isMine && (
                <>
                <button type="button" onClick={onReportUser}>
                  Report user
                </button>
                <button type="button" onClick={onBlockUser}>
                  Block user
                </button>
                </>
              )}
            </div>
          </div>
        </details>
      )}
    </article>
  );
}

function MessageContent({ message, isDeleted }) {
  if (isDeleted) {
    return <p className="message__content">Message deleted</p>;
  }

  if (message.messageType === 'code_snippet') {
    return (
      <div className="message-card message-card--code rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--page-strong),transparent_8%)] p-3">
        <div className="message-card__head">
          <span><Icon name="code" size={15} /> Code snippet</span>
          <button className="button button--ghost button--small" type="button" onClick={() => copyText(message.content)}>
            Copy
          </button>
        </div>
        <pre className="max-w-full overflow-x-auto rounded-[1rem] bg-[rgba(0,0,0,0.08)] p-4 text-sm leading-6"><code>{message.content}</code></pre>
      </div>
    );
  }

  if (['match_invite', 'score_card', 'topic_card', 'poll_card'].includes(message.messageType)) {
    return <SpecialMessageCard message={message} />;
  }

  return (
    <p className="message__content">
      <MentionText content={message.content} mentions={message.mentions || []} />
    </p>
  );
}

function SpecialMessageCard({ message }) {
  const card = {
    match_invite: {
      icon: 'gamepad',
      title: message.metadata?.gameName || 'Match invite',
      label: message.metadata?.roomLinkText || 'Join from room details',
    },
    score_card: {
      icon: 'gamepad',
      title: 'Score card',
      label: `${message.metadata?.teamA || 'Team A'} vs ${message.metadata?.teamB || 'Team B'}`,
    },
    topic_card: {
      icon: 'shuffle',
      title: 'Topic card',
      label: 'Room prompt',
    },
    poll_card: {
      icon: 'shuffle',
      title: message.metadata?.question || 'Poll',
      label: 'Live poll',
    },
  }[message.messageType] || { icon: 'sparkle', title: 'Room card', label: 'Category tool' };

  return (
    <article className={`message-card message-card--${message.messageType} rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-inset)] p-4 shadow-[var(--shadow-sm)]`}>
      <div className="message-card__head">
        <span><Icon name={card.icon} size={15} /> {card.title}</span>
        <em>{card.label}</em>
      </div>
      <p>{message.content}</p>
      {Array.isArray(message.metadata?.options) && (
        <div className="message-card__options">
          {message.metadata.options.map((option, index) => (
            <span key={`${option}_${index}`}>{option}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function BlockedMessage({ message, onShowOnce, onUnblock }) {
  return (
    <article className={cn('blocked-message text-sm text-[var(--text-soft)]', tw.cardCompact)}>
      <span>Message hidden from blocked user</span>
      <div>
        <button type="button" onClick={onShowOnce}>
          Show once
        </button>
        <button type="button" onClick={onUnblock}>
          Unblock
        </button>
      </div>
    </article>
  );
}

function UserActions({
  user,
  isOwner,
  canModerate,
  isBlocked,
  onReport,
  onBlock,
  onUnblock,
  onMute,
  onUnmute,
  onKick,
  onBan,
  onRole,
}) {
  return (
    <details className={cn('user-actions action-menu', tw.actionMenu)}>
      <summary aria-label={`Actions for ${user.displayName}`}>Actions</summary>
      <div>
        <button type="button" onClick={onReport}>
          Report
        </button>
        <button type="button" onClick={isBlocked ? onUnblock : onBlock}>
          {isBlocked ? 'Unblock' : 'Block'}
        </button>
        {canModerate && !user.isOwner && (
          <>
            <button type="button" onClick={user.isMuted ? onUnmute : onMute}>
              {user.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button className="danger-link" type="button" onClick={onKick}>
              Kick
            </button>
            <button className="danger-link" type="button" onClick={onBan}>
              Ban
            </button>
            {isOwner && user.userId && (
              <button type="button" onClick={onRole}>
                {user.isModerator ? 'Make member' : 'Make moderator'}
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function RoomThemePicker({ currentThemeId, billingSummary, onApplyRoomTheme, onOpenStore }) {
  const ownedThemeIds = billingSummary?.ownedThemeIds || ['classic'];
  const ownedProductIds = billingSummary?.ownedProductIds || [];

  return (
    <div className="room-theme-picker">
      <div className="room-theme-picker__head">
        <div>
          <p className="eyebrow">Room theme</p>
          <span>Apply owned premium room looks.</span>
        </div>
        {onOpenStore && (
          <button className="button button--ghost button--small" type="button" onClick={onOpenStore}>
            Store
          </button>
        )}
      </div>
      <div className="room-theme-options">
        {ROOM_THEME_PRESETS.map((theme) => {
          const owned = !theme.productId || ownedThemeIds.includes(theme.themeId) || ownedProductIds.includes(theme.productId);
          const active = currentThemeId === theme.themeId;

          return (
            <button
              className={`room-theme-option theme-preview--${theme.themeId} ${active ? 'is-active' : ''}`}
              key={theme.themeId}
              type="button"
              disabled={!owned || active}
              onClick={() => onApplyRoomTheme?.(theme.themeId)}
            >
              <span className="room-theme-option__swatches" aria-hidden="true">
                {theme.swatches.map((swatch) => (
                  <i key={swatch} style={{ background: swatch }} />
                ))}
              </span>
              <strong>{theme.title}</strong>
              <em>{active ? 'Applied' : owned ? 'Owned' : 'Locked'}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DefaultRules({ category }) {
  return (
    <ul>
      {getCategoryDefaultRules(category).map((rule) => <li key={rule}>{rule}</li>)}
    </ul>
  );
}

function MentionText({ content, mentions = [] }) {
  if (!content || mentions.length === 0) {
    return content;
  }

  const mentionKeys = new Set(
    mentions
      .flatMap((mention) => [mention.handle, mention.displayName, String(mention.displayName || '').replace(/\s+/g, '')])
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  );
  const parts = String(content).split(/(@[\p{L}\p{N}._-]+)/gu);

  return parts.map((part, index) => {
    const clean = part.replace(/^@/, '').toLowerCase();

    if (part.startsWith('@') && mentionKeys.has(clean)) {
      return (
        <span className="mention-highlight" key={`${part}_${index}`}>
          {part}
        </span>
      );
    }

    return part;
  });
}

function ModerationShelf({ title, items, empty, onClear }) {
  return (
    <div className="moderation-shelf">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="stacked-actions">
          {items.map((item) => (
            <div className="moderation-row" key={item.memberId}>
              <div>
                <strong>{item.displayName}</strong>
                <span>{item.bannedUntil || item.mutedUntil}</span>
              </div>
              {onClear && (
                <button className="button button--ghost button--small" type="button" onClick={() => onClear(item)}>
                  Unban
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTypingLabel(typingUsers) {
  if (typingUsers.length === 0) {
    return '';
  }

  if (typingUsers.length === 1) {
    return `${typingUsers[0].displayName} is typing...`;
  }

  return 'A few people are typing...';
}

function getMentionSuggestions(draft, users, currentSessionId) {
  const match = String(draft || '').match(/@([\p{L}\p{N}._-]*)$/u);

  if (!match) {
    return [];
  }

  const query = match[1].toLowerCase();
  return users
    .filter((user) => user.sessionId !== currentSessionId)
    .filter((user) => {
      const name = String(user.displayName || '').toLowerCase().replace(/\s+/g, '');
      const handle = String(user.handle || '').toLowerCase();
      return !query || name.includes(query) || handle.includes(query);
    })
    .slice(0, 5);
}

function formatActivity(activity) {
  const actor = activity.actorName || 'Nexus';
  const title = activity.metadata?.title || activity.metadata?.target || '';

  return {
    room_created: `${actor} created the room`,
    user_joined: `${actor} joined`,
    announcement_posted: `${actor} posted an announcement${title ? `: ${title}` : ''}`,
    room_renamed: `${actor} renamed the room${title ? ` to ${title}` : ''}`,
    room_locked: `${actor} locked the room`,
    room_unlocked: `${actor} unlocked the room`,
    role_changed: `${actor} updated a member role`,
    moderation_action: `${actor} updated moderation`,
    theme_changed: `${actor} changed the room theme`,
    room_deleted: `${actor} closed the room`,
    system_notice: `${actor} posted a system notice`,
    category_tool_created: `${actor} added a category tool`,
    category_tool_updated: `${actor} updated ${activity.metadata?.toolType || 'a category tool'}`,
    category_tool_completed: `${actor} completed a category tool`,
  }[activity.type] || `${actor} updated the room`;
}

function formatConnectionState(state) {
  if (state === 'connected') {
    return 'Connected';
  }

  if (state === 'disconnected') {
    return 'Disconnected';
  }

  if (state === 'connecting') {
    return 'Connecting';
  }

  return 'Reconnecting';
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatThemeTitle(themeId) {
  return ROOM_THEME_PRESETS.find((theme) => theme.themeId === themeId)?.title || 'Classic Ivory';
}

async function copyText(value) {
  const text = String(value || '');

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function blockKeyFor(target) {
  return target?.userId ? `user_${target.userId}` : target?.targetUserId ? `user_${target.targetUserId}` : target?.sessionId || target?.senderSessionId || '';
}

function isBlockedTarget(blockedSet, target) {
  return blockedSet.has(blockKeyFor(target)) || blockedSet.has(target?.sessionId || target?.senderSessionId || '');
}

function toBlockTarget(target) {
  return {
    blockedId: blockKeyFor(target),
    targetUserId: target?.userId || target?.senderUserId || null,
    targetSessionId: target?.sessionId || target?.senderSessionId || null,
    displayName: target?.displayName || target?.senderName || 'User',
  };
}

function toProfileTarget(target) {
  return {
    userId: target?.userId || target?.senderUserId || null,
    sessionId: target?.sessionId || target?.senderSessionId || null,
    displayName: target?.displayName || target?.senderName || 'User',
    avatar: target?.avatar || target?.senderAvatar || 'nexus',
    photoURL: target?.photoURL || target?.senderPhotoURL || '',
    role: target?.role || (target?.isOwner ? 'owner' : target?.isModerator ? 'moderator' : 'member'),
    isModerator: Boolean(target?.isModerator),
  };
}
