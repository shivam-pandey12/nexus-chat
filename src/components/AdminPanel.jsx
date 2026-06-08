import { useEffect, useState } from 'react';

import { PRODUCT_CATALOG } from '../../shared/billingCatalog.js';
import { getCategoryConfig, getCategoryOptions, getCategorySlug } from '../../shared/categoryConfig.js';
import {
  clearAdminReports,
  cleanupExpiredAdminRooms,
  cancelAdminEvent,
  cancelAdminScheduledAnnouncement,
  deleteAdminCategoryTool,
  deleteAdminCommunity,
  deleteAdminRoom,
  fetchAdminCategoryTools,
  fetchAdminBilling,
  fetchAdminAnalytics,
  fetchAdminCommunities,
  fetchAdminErrors,
  fetchAdminEvents,
  fetchAdminFeedback,
  fetchAdminOverview,
  fetchAdminRoomActivity,
  fetchAdminRoomMembers,
  fetchAdminScheduledAnnouncements,
  fetchAdminSystemStatus,
  grantAdminEntitlement,
  removeAdminAnnouncement,
  removeAdminRoomMember,
  runAdminJobs,
  revokeAdminEntitlement,
  updateReportStatus,
  updateAdminCategoryToolStatus,
  updateAdminFeedbackStatus,
} from '../services/api.js';
import CategoryBadge from './CategoryBadge.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { cn, tw } from './ui/premium.js';

const ADMIN_KEY_STORAGE = 'nexusChat.adminKey.v1';
const CATEGORY_FILTERS = ['all', ...getCategoryOptions().map((category) => category.slug)];

export default function AdminPanel({ authToken = '', sessionId = '', onBack, onToast }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [draftKey, setDraftKey] = useState(adminKey);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('all');
  const [roomMembers, setRoomMembers] = useState({});
  const [roomActivity, setRoomActivity] = useState({});
  const [billing, setBilling] = useState(null);
  const [communityOps, setCommunityOps] = useState({ communities: [], events: [], scheduledAnnouncements: [], activity: [] });
  const [systemStatus, setSystemStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentErrors, setRecentErrors] = useState([]);
  const [adminFeedback, setAdminFeedback] = useState([]);
  const [categoryTools, setCategoryTools] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [toolCategoryFilter, setToolCategoryFilter] = useState('all');
  const [toolStatusFilter, setToolStatusFilter] = useState('all');
  const [roomCategoryFilter, setRoomCategoryFilter] = useState('all');
  const [communityCategoryFilter, setCommunityCategoryFilter] = useState('all');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [confirmation, setConfirmation] = useState(null);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantProductId, setGrantProductId] = useState('nexus_plus_monthly');
  const [grantReason, setGrantReason] = useState('');

  useEffect(() => {
    if (adminKey || authToken) {
      loadOverview(adminKey);
    }
  }, [adminKey, authToken]);

  function requestConfirmation(options) {
    setConfirmation({
      tone: 'danger',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options,
      busy: false,
    });
  }

  function cancelConfirmation() {
    setConfirmation((current) => (current?.busy ? current : null));
  }

  async function confirmCurrentAction() {
    const current = confirmation;

    if (!current || current.busy) {
      return;
    }

    setConfirmation({ ...current, busy: true });
    try {
      await current.onConfirm?.();
      setConfirmation(null);
    } catch (requestError) {
      onToast?.(requestError.message || 'Admin action failed.', 'error');
      setConfirmation(null);
    }
  }

  async function loadOverview(key = adminKey) {
    setLoading(true);
    setError('');

    try {
      const auth = getAdminAuth(key);
      const data = await fetchAdminOverview(auth);
      setOverview(data);

      const optionalResults = await Promise.allSettled([
        fetchAdminBilling(auth),
        fetchAdminCommunities(auth),
        fetchAdminEvents(auth),
        fetchAdminScheduledAnnouncements(auth),
        fetchAdminSystemStatus(auth),
        fetchAdminAnalytics(auth),
        fetchAdminErrors(auth),
        fetchAdminFeedback(auth, { limit: 80 }),
        fetchAdminCategoryTools(auth, { limit: 80 }),
      ]);
      const [billingData, communitiesData, eventsData, scheduledData, systemData, analyticsData, errorsData, feedbackData, categoryToolsData] = optionalResults.map((result) => (
        result.status === 'fulfilled' ? result.value : null
      ));
      const failedSections = optionalResults
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.message || 'Admin section failed.');

      setBilling(billingData);
      setCommunityOps({
        communities: communitiesData?.communities || [],
        events: eventsData?.events || [],
        scheduledAnnouncements: scheduledData?.scheduledAnnouncements || [],
        activity: communitiesData?.activity || [],
      });
      setSystemStatus(systemData);
      setAnalytics(analyticsData);
      setRecentErrors(errorsData?.errors || []);
      setAdminFeedback(feedbackData?.feedback || []);
      setCategoryTools(categoryToolsData?.tools || data.categoryTools || []);
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      if (failedSections.length) {
        onToast?.(`Admin opened, but ${failedSections.length} section${failedSections.length > 1 ? 's' : ''} could not load.`, 'warning');
      }
    } catch (requestError) {
      setOverview(null);
      setBilling(null);
      setCommunityOps({ communities: [], events: [], scheduledAnnouncements: [], activity: [] });
      setSystemStatus(null);
      setAnalytics(null);
      setRecentErrors([]);
      setAdminFeedback([]);
      setCategoryTools([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock(event) {
    event.preventDefault();
    const nextKey = draftKey.trim();
    if (nextKey === adminKey) {
      loadOverview(nextKey);
      return;
    }
    setAdminKey(nextKey);
  }

  async function handleReportStatus(reportId, status) {
    try {
      await updateReportStatus(getAdminAuth(), reportId, status);
      onToast?.('Report updated');
      await loadOverview();
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleFeedbackStatus(feedbackId, status) {
    try {
      await updateAdminFeedbackStatus(getAdminAuth(), feedbackId, status);
      onToast?.('Feedback updated');
      await loadOverview();
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleCategoryToolStatus(roomId, toolId, status) {
    try {
      await updateAdminCategoryToolStatus(getAdminAuth(), roomId, toolId, status);
      onToast?.('Category tool updated');
      await loadOverview();
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleCategoryToolDelete(roomId, toolId) {
    requestConfirmation({
      eyebrow: 'Category tools',
      title: 'Remove this category tool item?',
      body: 'This hides the tool item from the room and admin samples. Use this for abuse, spam, or unsafe content.',
      confirmLabel: 'Remove Tool',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminCategoryTool(getAdminAuth(), roomId, toolId);
        onToast?.('Category tool closed');
        await loadOverview();
      },
    });
  }

  async function handleDeleteRoom(roomId) {
    requestConfirmation({
      eyebrow: 'Admin room action',
      title: 'Close this room for everyone?',
      body: 'The room will be closed and hidden from normal use. This affects all current members.',
      confirmLabel: 'Close Room',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminRoom(getAdminAuth(), roomId);
        onToast?.('Room closed');
        await loadOverview();
      },
    });
  }

  async function handleClearReports() {
    requestConfirmation({
      eyebrow: 'Reports',
      title: 'Clear the currently loaded reports?',
      body: 'This will clear the sampled report queue visible here. Review anything important before continuing.',
      confirmLabel: 'Clear Reports',
      tone: 'danger',
      onConfirm: async () => {
        await clearAdminReports(getAdminAuth());
        onToast?.('Reports cleared');
        await loadOverview();
      },
    });
  }

  async function handleCleanupExpiredRooms() {
    try {
      const result = await cleanupExpiredAdminRooms(getAdminAuth());
      onToast?.(`${result.count || 0} expired temp rooms cleaned`);
      await loadOverview();
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleRunJobs() {
    requestConfirmation({
      eyebrow: 'Production operations',
      title: 'Run safe cleanup and scheduler jobs now?',
      body: 'This can expire temp rooms, publish due announcements, transition events, and run bounded cleanup tasks.',
      confirmLabel: 'Run Jobs',
      tone: 'safe',
      onConfirm: async () => {
        await runAdminJobs(getAdminAuth());
        onToast?.('Safe jobs completed');
        await loadOverview();
      },
    });
  }

  async function handleMembers(roomId) {
    try {
      const result = await fetchAdminRoomMembers(getAdminAuth(), roomId);
      setRoomMembers((current) => ({ ...current, [roomId]: result.members || [] }));
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleActivity(roomId) {
    try {
      const result = await fetchAdminRoomActivity(getAdminAuth(), roomId);
      setRoomActivity((current) => ({ ...current, [roomId]: result.activity || [] }));
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleRemoveAnnouncement(roomId, announcementId) {
    requestConfirmation({
      eyebrow: 'Announcement',
      title: 'Remove this room announcement?',
      body: 'The announcement will disappear from the room surface. Use this for incorrect or unsafe notices.',
      confirmLabel: 'Remove Announcement',
      tone: 'danger',
      onConfirm: async () => {
        await removeAdminAnnouncement(getAdminAuth(), roomId, announcementId);
        onToast?.('Announcement removed');
        await loadOverview();
      },
    });
  }

  async function handleRemoveMember(roomId, memberId) {
    requestConfirmation({
      eyebrow: 'Room moderation',
      title: 'Remove this member from the room?',
      body: 'They will be removed with a short cooldown. Use this for disruption, spam, or safety cleanup.',
      confirmLabel: 'Remove Member',
      tone: 'danger',
      onConfirm: async () => {
        await removeAdminRoomMember(getAdminAuth(), roomId, memberId);
        onToast?.('Member removed');
        await handleMembers(roomId);
        await loadOverview();
      },
    });
  }

  async function handleGrantEntitlement(event) {
    event.preventDefault();

    if (!grantUserId.trim()) {
      onToast?.('Enter a user ID before granting support access.', 'error');
      return;
    }

    try {
      await grantAdminEntitlement(getAdminAuth(), {
        userId: grantUserId.trim(),
        productId: grantProductId,
        reason: grantReason,
      });
      onToast?.('Test/support entitlement granted');
      setGrantReason('');
      await loadOverview();
    } catch (requestError) {
      onToast?.(requestError.message, 'error');
    }
  }

  async function handleRevokeEntitlement(userId, entitlementId) {
    requestConfirmation({
      eyebrow: 'Billing support',
      title: 'Revoke this test/support entitlement?',
      body: 'The user may lose access to premium features granted by this entitlement.',
      confirmLabel: 'Revoke Access',
      tone: 'danger',
      onConfirm: async () => {
        await revokeAdminEntitlement(getAdminAuth(), {
          userId,
          entitlementId,
          reason: 'Admin support revoke',
        });
        onToast?.('Entitlement revoked');
        await loadOverview();
      },
    });
  }

  async function handleDeleteCommunity(communityId) {
    requestConfirmation({
      eyebrow: 'Community action',
      title: 'Close this community and hide it from discovery?',
      body: 'Members may lose access to the community surface and related discovery entry.',
      confirmLabel: 'Close Community',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminCommunity(getAdminAuth(), communityId);
        onToast?.('Community closed');
        await loadOverview();
      },
    });
  }

  async function handleCancelEvent(eventId) {
    requestConfirmation({
      eyebrow: 'Event room',
      title: 'Cancel this event room?',
      body: 'The event will no longer open as scheduled, and eligible users may see it as cancelled.',
      confirmLabel: 'Cancel Event',
      tone: 'danger',
      onConfirm: async () => {
        await cancelAdminEvent(getAdminAuth(), eventId);
        onToast?.('Event cancelled');
        await loadOverview();
      },
    });
  }

  async function handleCancelScheduledAnnouncement(announcementId) {
    requestConfirmation({
      eyebrow: 'Scheduled announcement',
      title: 'Cancel this scheduled announcement?',
      body: 'It will not be published when its scheduled time arrives.',
      confirmLabel: 'Cancel Announcement',
      tone: 'danger',
      onConfirm: async () => {
        await cancelAdminScheduledAnnouncement(getAdminAuth(), announcementId);
        onToast?.('Scheduled announcement cancelled');
        await loadOverview();
      },
    });
  }

  function getAdminAuth(key = adminKey) {
    return {
      adminKey: key,
      idToken: authToken,
      sessionId,
    };
  }

  const visibleReports = (overview?.recentReports || []).filter(
    (report) => reportFilter === 'all' || report.status === reportFilter,
  );
  const visibleFeedback = adminFeedback.filter(
    (entry) => feedbackFilter === 'all' || entry.status === feedbackFilter || entry.type === feedbackFilter,
  );
  const visibleCategoryTools = categoryTools.filter((tool) => {
    const categoryMatch = toolCategoryFilter === 'all' || getCategorySlug(tool.categorySlug || tool.category) === toolCategoryFilter;
    const statusMatch = toolStatusFilter === 'all' || tool.status === toolStatusFilter;
    return categoryMatch && statusMatch;
  });
  const visibleRooms = (overview?.rooms || []).filter((room) =>
    roomCategoryFilter === 'all' || getCategorySlug(room.categorySlug || room.category) === roomCategoryFilter);
  const visibleCommunities = communityOps.communities.filter((community) =>
    communityCategoryFilter === 'all' || getCategorySlug(community.categorySlug || community.category) === communityCategoryFilter);
  const visibleEvents = communityOps.events.filter((event) =>
    eventCategoryFilter === 'all' || getCategorySlug(event.categorySlug || event.category) === eventCategoryFilter);

  return (
    <>
    <main className={cn('admin-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Safety dashboard</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Admin panel</h1>
          <p className={tw.subcopy}>MVP-grade local moderation view. Replace key access with real admin auth in a later phase.</p>
        </div>
        <div className="rooms-header__actions flex flex-wrap gap-3">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>
            Home
          </button>
          {(adminKey || authToken) && (
            <button className={cn('button button--soft', tw.buttonSoft)} type="button" onClick={() => loadOverview()}>
              Refresh
            </button>
          )}
        </div>
      </section>

      {!overview || error ? (
        <form className={cn('panel admin-key-card entrance-card', tw.glassSoft, 'mx-auto max-w-xl space-y-4 p-6')} onSubmit={handleUnlock}>
          <p className="eyebrow">Admin key</p>
          <h2>Enter safety key</h2>
          <p className="muted">Firebase admin email access is preferred. `ADMIN_KEY` is a local/dev fallback when the backend allows it.</p>
          {error && <div className="notice notice--error">{error}</div>}
          <label className="field">
            <span>ADMIN_KEY</span>
            <input
              value={draftKey}
              type="password"
              placeholder="Local admin key"
              onChange={(event) => setDraftKey(event.target.value)}
            />
          </label>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="submit" disabled={!draftKey.trim() || loading}>
            {loading ? 'Checking...' : 'Open Admin Panel'}
          </button>
        </form>
      ) : (
        <section className="admin-grid grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Overview</p>
            <div className="admin-metrics">
              <Metric label="Rooms" value={overview?.totalRooms || 0} />
              <Metric label="Online" value={overview?.totalOnlineUsers || 0} />
              <Metric label="Public" value={overview?.publicRooms || 0} />
              <Metric label="Private" value={overview?.privateRooms || 0} />
              <Metric label="Profiles" value={overview?.users?.totalUsers || 0} />
              <Metric label="Logged in" value={overview?.users?.loggedInUsers || 0} />
              <Metric label="Notices" value={overview?.notifications?.sampled || 0} />
              <Metric label="Feedback" value={overview?.feedback?.open || 0} />
              <Metric label="Tools" value={categoryTools.length} />
              <Metric label="Push users" value={overview?.push?.tokenUsers || systemStatus?.push?.tokenUsers || 0} />
              <Metric label="Unread sample" value={overview?.notifications?.unreadSample || 0} />
              <Metric label="Communities" value={communityOps.communities.length} />
              <Metric label="Events" value={communityOps.events.length} />
            </div>
            <p className="muted admin-persistence">
              Persistence: {overview?.persistence?.enabled ? 'Firestore connected' : 'memory fallback'} · Auth:{' '}
              {overview?.adminAuth?.method === 'firebase' ? 'Firebase admin' : 'Admin key'}
            </p>
          </div>

          <div className={cn('panel admin-card admin-card--wide', tw.glassSoft, 'p-5 lg:col-span-2 xl:col-span-3')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Production operations</p>
                <h2>System, jobs, Redis, and analytics</h2>
              </div>
              <button className="button button--soft button--small" type="button" onClick={handleRunJobs}>
                Run Safe Jobs
              </button>
            </div>
            <div className="admin-metrics">
              <Metric label="Redis" value={systemStatus?.redis?.state || overview?.redis?.state || 'fallback'} />
              <Metric label="Firestore" value={systemStatus?.persistence?.state || overview?.dbStatus || 'fallback'} />
              <Metric label="Jobs" value={systemStatus?.jobs?.enabled ? 'on' : 'off'} />
              <Metric label="Billing" value={systemStatus?.billing?.enabled ? 'on' : 'off'} />
              <Metric label="Analytics" value={analytics?.enabled ? 'on' : 'off'} />
              <Metric label="FCM" value={systemStatus?.push?.ready ? 'ready' : systemStatus?.push?.enabled ? 'waiting' : 'off'} />
              <Metric label="Errors" value={recentErrors.length} />
            </div>
            <div className="admin-status-grid">
              <StatusRow label="Last job" value={systemStatus?.jobs?.lastRun?.startedAt ? formatDateTime(systemStatus.jobs.lastRun.startedAt) : 'not run yet'} />
              <StatusRow label="Env mode" value={systemStatus?.env?.nodeEnv || 'production'} />
              <StatusRow label="Launch mode" value={systemStatus?.launch?.mode || overview?.launch?.mode || 'dev'} />
              <StatusRow label="Maintenance" value={systemStatus?.launch?.maintenanceMode ? 'enabled via env' : 'off'} />
              <StatusRow label="PWA shell" value={systemStatus?.pwa?.serviceWorker ? 'manifest + service worker' : 'browser shell only'} />
              <StatusRow label="Push delivery" value={systemStatus?.push?.ready ? `${systemStatus.push.sent || 0} sent / ${systemStatus.push.failed || 0} failed` : systemStatus?.push?.unavailableReason || 'off'} />
              <StatusRow label="Admin auth" value={systemStatus?.security?.adminEmailAuthConfigured ? 'Firebase emails configured' : 'Fallback/admin key mode'} />
              <StatusRow label="Redis provider" value={systemStatus?.redis?.provider || 'memory'} />
            </div>
            {recentErrors.length > 0 && (
              <div className="admin-list admin-list--compact">
                {recentErrors.slice(0, 3).map((entry) => (
                  <article className="admin-item" key={`${entry.time}-${entry.message}`}>
                    <strong>{entry.message}</strong>
                    <span>{entry.level} · {formatDateTime(entry.time)}</span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={cn('panel admin-card admin-billing-card', tw.glassSoft, 'p-5')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Billing operations</p>
                <h2>{billing?.billing?.enabled ? 'Razorpay ready' : 'Billing disabled'}</h2>
              </div>
              <span className="pill pill--muted">{billing?.billing?.testMode ? 'test mode' : billing?.billing?.state || 'disabled'}</span>
            </div>
            <p className="muted">
              Manual grants are for testing/support only. All actions are logged as billing moderation events.
            </p>
            <form className="admin-grant-form" onSubmit={handleGrantEntitlement}>
              <label className="field">
                <span>User ID</span>
                <input value={grantUserId} onChange={(event) => setGrantUserId(event.target.value)} placeholder="Firebase user ID" />
              </label>
              <label className="field">
                <span>Product</span>
                <select value={grantProductId} onChange={(event) => setGrantProductId(event.target.value)}>
                  {PRODUCT_CATALOG.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Reason</span>
                <input value={grantReason} onChange={(event) => setGrantReason(event.target.value)} placeholder="Support/test note" />
              </label>
              <button className="button button--soft button--wide" type="submit">
                Grant Test/Support Access
              </button>
            </form>
            <div className="admin-list admin-list--compact">
              {(billing?.entitlements || []).slice(0, 8).map((entitlement) => (
                <article className="admin-item" key={entitlement.entitlementId}>
                  <strong>{entitlement.productId}</strong>
                  <span>{entitlement.userId} · {entitlement.status}</span>
                  <div className="admin-actions">
                    <button
                      className="danger-link"
                      type="button"
                      onClick={() => handleRevokeEntitlement(entitlement.userId, entitlement.entitlementId)}
                    >
                      Revoke
                    </button>
                  </div>
                </article>
              ))}
              {(billing?.entitlements || []).length === 0 && <p className="muted">No active billing entitlements found.</p>}
            </div>
            <div className="admin-billing-shelves">
              <BillingShelf title="Recent payments" items={billing?.payments || []} empty="No payment records yet." />
              <BillingShelf title="Billing events" items={billing?.events || []} empty="No billing events yet." />
            </div>
          </div>

          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Recent reports</p>
                <h2>{overview?.recentReports?.length || 0} reports</h2>
              </div>
              <div className="admin-actions">
                <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)}>
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="actioned">Actioned</option>
                  <option value="dismissed">Dismissed</option>
                </select>
                <button className="button button--ghost button--small" type="button" onClick={handleClearReports}>
                  Clear
                </button>
              </div>
            </div>
            <div className="admin-list">
              {visibleReports.map((report) => (
                <article className="admin-item" key={report.reportId}>
                  <strong>{report.reason}</strong>
                  <span>{report.targetType} · {report.status}</span>
                  <p>{report.details || 'No details provided.'}</p>
                  <div className="admin-actions">
                    <button type="button" onClick={() => handleReportStatus(report.reportId, 'reviewed')}>Reviewed</button>
                    <button type="button" onClick={() => handleReportStatus(report.reportId, 'dismissed')}>Dismiss</button>
                    <button type="button" onClick={() => handleReportStatus(report.reportId, 'actioned')}>Actioned</button>
                  </div>
                </article>
              ))}
              {visibleReports.length === 0 && <p className="muted">No reports yet.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card admin-card--wide admin-feedback-card', tw.glassSoft, 'p-5 lg:col-span-2 xl:col-span-3')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Launch feedback</p>
                <h2>{adminFeedback.length} recent notes</h2>
              </div>
              <select value={feedbackFilter} onChange={(event) => setFeedbackFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="bug_report">Bugs</option>
                <option value="abuse_safety_concern">Safety</option>
                <option value="billing_issue">Billing</option>
              </select>
            </div>
            <div className="admin-list admin-feedback-list">
              {visibleFeedback.map((entry) => (
                <article className="admin-item feedback-admin-item" key={entry.feedbackId}>
                  <strong>{entry.title}</strong>
                  <span>{entry.type} · {entry.status} · {formatDateTime(entry.createdAt)}</span>
                  <p>{entry.message}</p>
                  <em>{entry.name || 'Guest'}{entry.email ? ` · ${entry.email}` : ''}{entry.page ? ` · ${entry.page}` : ''}</em>
                  <div className="admin-actions">
                    <button type="button" onClick={() => handleFeedbackStatus(entry.feedbackId, 'reviewed')}>Reviewed</button>
                    <button type="button" onClick={() => handleFeedbackStatus(entry.feedbackId, 'resolved')}>Resolve</button>
                    <button type="button" onClick={() => handleFeedbackStatus(entry.feedbackId, 'dismissed')}>Dismiss</button>
                  </div>
                </article>
              ))}
              {visibleFeedback.length === 0 && <p className="muted">No feedback matches this launch queue filter.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card admin-card--wide', tw.glassSoft, 'p-5 lg:col-span-2 xl:col-span-3')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Category tools</p>
                <h2>{categoryTools.length} active room tools sampled</h2>
              </div>
              <div className="admin-filter-actions">
                <select value={toolCategoryFilter} onChange={(event) => setToolCategoryFilter(event.target.value)} aria-label="Filter category tools by category">
                  {CATEGORY_FILTERS.map((item) => <option key={item} value={item}>{formatCategoryFilter(item)}</option>)}
                </select>
                <select value={toolStatusFilter} onChange={(event) => setToolStatusFilter(event.target.value)} aria-label="Filter category tools by status">
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="running">Running</option>
                  <option value="paused">Paused</option>
                  <option value="solved">Solved</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="admin-list admin-list--tools">
              {visibleCategoryTools.slice(0, 40).map((tool) => (
                <article className="admin-item" key={`${tool.roomId}_${tool.toolId}`}>
                  <strong>{tool.title}</strong>
                  <span><CategoryBadge category={tool.categorySlug} compact /> · {tool.toolType} · {tool.status}</span>
                  <p>{tool.body || tool.metadata?.topic || tool.metadata?.gameName || 'No body.'}</p>
                  <div className="admin-actions">
                    <button type="button" onClick={() => handleCategoryToolStatus(tool.roomId, tool.toolId, 'closed')}>Close</button>
                    <button type="button" onClick={() => handleCategoryToolStatus(tool.roomId, tool.toolId, 'dismissed')}>Dismiss</button>
                    <button className="danger-link" type="button" onClick={() => handleCategoryToolDelete(tool.roomId, tool.toolId)}>Remove</button>
                  </div>
                </article>
              ))}
              {visibleCategoryTools.length === 0 && <p className="muted">No category tool items match this filter.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <div className="admin-card__header">
              <p className="eyebrow">Active rooms</p>
              <div className="admin-filter-actions">
                <select value={roomCategoryFilter} onChange={(event) => setRoomCategoryFilter(event.target.value)} aria-label="Filter rooms by category">
                  {CATEGORY_FILTERS.map((item) => <option key={item} value={item}>{formatCategoryFilter(item)}</option>)}
                </select>
                <button className="button button--ghost button--small" type="button" onClick={handleCleanupExpiredRooms}>
                  Clean Expired
                </button>
              </div>
            </div>
            <div className="admin-list">
              {visibleRooms.map((room) => (
                <article className="admin-item" key={room.roomId}>
                  <strong>{room.title}</strong>
                  <span>{room.type} · <CategoryBadge category={room.categorySlug || room.category} compact /> · {room.memberCount} online</span>
                  <p>{room.messageCount} messages · {room.mutedCount} muted · {room.bannedCount || 0} banned</p>
                  <div className="admin-actions">
                    <button type="button" onClick={() => handleMembers(room.roomId)}>View Members</button>
                    <button type="button" onClick={() => handleActivity(room.roomId)}>Activity</button>
                    <button className="danger-link" type="button" onClick={() => handleDeleteRoom(room.roomId)}>Close Room</button>
                  </div>
                  {room.latestAnnouncement && (
                    <div className="admin-member-list">
                      <div className="moderation-row">
                        <div>
                          <strong>{room.latestAnnouncement.title}</strong>
                          <span>Latest announcement</span>
                        </div>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => handleRemoveAnnouncement(room.roomId, room.latestAnnouncement.announcementId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                  {(roomMembers[room.roomId] || []).length > 0 && (
                    <div className="admin-member-list">
                      {roomMembers[room.roomId].map((member) => (
                        <div className="moderation-row" key={member.memberId}>
                          <div>
                            <strong>{member.displayName}</strong>
                            <span>{member.role} · {member.bannedUntil ? 'banned' : member.mutedUntil ? 'muted' : 'member'}</span>
                          </div>
                          {member.role !== 'owner' && (
                            <button className="button button--ghost button--small" type="button" onClick={() => handleRemoveMember(room.roomId, member.memberId)}>
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(roomActivity[room.roomId] || []).length > 0 && (
                    <div className="activity-timeline activity-timeline--admin">
                      {roomActivity[room.roomId].map((activity) => (
                        <article className="activity-item" key={activity.activityId}>
                          <span aria-hidden="true" />
                          <div>
                            <strong>{activity.type}</strong>
                            <small>{activity.actorName} · {formatDateTime(activity.createdAt)}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {visibleRooms.length === 0 && <p className="muted">No active rooms match this category.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card admin-card--wide', tw.glassSoft, 'p-5 lg:col-span-2 xl:col-span-3')}>
            <div className="admin-card__header">
              <div>
                <p className="eyebrow">Communities</p>
                <h2>{communityOps.communities.length} community spaces</h2>
              </div>
              <select value={communityCategoryFilter} onChange={(event) => setCommunityCategoryFilter(event.target.value)} aria-label="Filter communities by category">
                {CATEGORY_FILTERS.map((item) => <option key={item} value={item}>{formatCategoryFilter(item)}</option>)}
              </select>
            </div>
            <div className="admin-list">
              {visibleCommunities.slice(0, 12).map((community) => (
                <article className="admin-item" key={community.communityId}>
                  <strong>{community.name}</strong>
                  <span><CategoryBadge category={community.categorySlug || community.category} compact /> · {community.visibility} · {community.memberCountSnapshot || 0} members</span>
                  <p>{community.description || 'No description.'}</p>
                  <div className="admin-actions">
                    <button className="danger-link" type="button" onClick={() => handleDeleteCommunity(community.communityId)}>
                      Close Community
                    </button>
                  </div>
                </article>
              ))}
              {visibleCommunities.length === 0 && <p className="muted">No communities match this category.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <div className="admin-card__header">
              <p className="eyebrow">Event rooms</p>
              <select value={eventCategoryFilter} onChange={(event) => setEventCategoryFilter(event.target.value)} aria-label="Filter event rooms by category">
                {CATEGORY_FILTERS.map((item) => <option key={item} value={item}>{formatCategoryFilter(item)}</option>)}
              </select>
            </div>
            <div className="admin-list">
              {visibleEvents.slice(0, 10).map((event) => (
                <article className="admin-item" key={event.eventId}>
                  <strong>{event.title}</strong>
                  <span>{event.status} · <CategoryBadge category={event.categorySlug || event.category} compact /> · {formatDateTime(event.startsAt)}</span>
                  <p>{event.description || 'No description.'}</p>
                  {event.status !== 'cancelled' && (
                    <div className="admin-actions">
                      <button className="danger-link" type="button" onClick={() => handleCancelEvent(event.eventId)}>
                        Cancel Event
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {visibleEvents.length === 0 && <p className="muted">No event rooms match this category.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Scheduled announcements</p>
            <div className="admin-list">
              {communityOps.scheduledAnnouncements.slice(0, 10).map((announcement) => (
                <article className="admin-item" key={announcement.announcementId}>
                  <strong>{announcement.title}</strong>
                  <span>{announcement.publishStatus} · {announcement.targetType}</span>
                  <p>{announcement.body || 'No body.'}</p>
                  {announcement.publishStatus === 'scheduled' && (
                    <div className="admin-actions">
                      <button className="danger-link" type="button" onClick={() => handleCancelScheduledAnnouncement(announcement.announcementId)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {communityOps.scheduledAnnouncements.length === 0 && <p className="muted">No scheduled announcements.</p>}
            </div>
          </div>

          <div className={cn('panel admin-card', tw.glassSoft, 'p-5')}>
            <p className="eyebrow">Moderation logs</p>
            <div className="admin-list">
              {(overview?.recentLogs || []).map((log) => (
                <article className="admin-item" key={log.logId}>
                  <strong>{log.actionType}</strong>
                  <span>{log.actorName} · {formatDateTime(log.createdAt)}</span>
                  <p>{log.reason || log.details || 'No details.'}</p>
                </article>
              ))}
              {overview?.recentLogs?.length === 0 && <p className="muted">No moderation actions yet.</p>}
            </div>
          </div>
        </section>
      )}
    </main>
    <ConfirmDialog
      confirmation={confirmation}
      onCancel={cancelConfirmation}
      onConfirm={confirmCurrentAction}
    />
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className={cn('metric-card', tw.cardCompact, 'min-h-[92px]')}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="moderation-row">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}

function BillingShelf({ title, items = [], empty }) {
  return (
    <div className="billing-shelf">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="admin-list admin-list--compact">
          {items.slice(0, 6).map((item) => (
            <article className="admin-item" key={item.paymentId || item.eventId || item.entitlementId}>
              <strong>{item.productId || item.type || 'Billing record'}</strong>
              <span>{item.status || 'received'} · {item.userId || item.source || 'system'}</span>
              {item.amount && <p>{item.currency} {Number(item.amount || 0) / 100}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCategoryFilter(value) {
  return value === 'all' ? 'All categories' : getCategoryConfig(value).label;
}

function formatDateTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return 'unscheduled';
  }

  return new Intl.DateTimeFormat([], {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
