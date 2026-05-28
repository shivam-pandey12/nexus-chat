import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import nexusLogoUrl from '../logo.png';
import AdminPanel from './components/AdminPanel.jsx';
import ChatRoom from './components/ChatRoom.jsx';
import BillingPage from './components/BillingPage.jsx';
import {
  CommunityHome,
  CommunitySettings,
  CreateCommunity,
  DiscoverCommunities,
  EventEditor,
  EventLobby,
  ScheduledAnnouncementManager,
} from './components/CommunityPages.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import CreateRoom from './components/CreateRoom.jsx';
import ExploreRooms from './components/ExploreRooms.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';
import GuestEntry from './components/GuestEntry.jsx';
import Icon from './components/Icon.jsx';
import LandingPage from './components/LandingPage.jsx';
import { LaunchPage, MaintenancePage, StatusPage, UnavailablePage, UpdatesPage } from './components/LaunchPages.jsx';
import MyRooms from './components/MyRooms.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import OnboardingCoach from './components/OnboardingCoach.jsx';
import PricingPage from './components/PricingPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import ReportModal from './components/ReportModal.jsx';
import StorePage from './components/StorePage.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import ToastStack from './components/ToastStack.jsx';
import { cn } from './components/ui/premium.js';
import SidePanelTrigger, { SIDE_PANEL_TRIGGER_VARIANTS } from '../reusable/side-panel-triggers/SidePanelTrigger.jsx';
import {
  createPaymentOrder,
  banCommunityMember,
  createMyBlock,
  cancelEvent,
  cancelScheduledAnnouncement,
  createCommunity,
  createCommunityRoom,
  createEvent,
  createFeedback,
  createReport,
  createScheduledAnnouncement,
  fetchCommunities,
  fetchCommunity,
  fetchEvents,
  fetchEvent,
  favoriteCommunity,
  joinCommunity,
  leaveCommunity,
  deleteMyBlock,
  fetchBillingCatalog,
  fetchBillingEntitlements,
  fetchMyNotifications,
  fetchMyBlocks,
  fetchMyProfile,
  fetchMyRooms,
  fetchPublicProfile,
  fetchPublicRooms,
  fetchStatus,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markRoomRead,
  updateNotificationPreferences,
  updateRoomNotifications,
  setFavoriteRoom,
  setEventRsvp,
  updateCommunity,
  updateCommunityRole,
  updateMyProfile,
  verifyPayment,
} from './services/api.js';
import { isFirebaseAuthConfigured, signInWithGoogle, signOutFirebase, subscribeToFirebaseAuth } from './services/firebaseClient.js';
import {
  disablePushNotifications,
  dismissInstallPrompt,
  enablePushNotifications,
  getInitialPwaState,
  getPushCapability,
  getStoredPushTokenId,
  promptInstall,
  registerNexusServiceWorker,
  watchForegroundMessages,
  watchInstallPrompt,
  watchNetwork,
} from './services/pwaClient.js';
import { createNexusSocket } from './services/socketClient.js';
import { loadBlockedUsers, saveBlockedUsers } from './utils/blockedUsers.js';
import { clearCurrentRoom, loadCurrentRoom, saveCurrentRoom } from './utils/currentRoom.js';
import { createLinkedProfile, loadProfile, loadTheme, saveProfile, saveTheme } from './utils/profile.js';
import { openRazorpayCheckout } from './utils/razorpayCheckout.js';
import { loadGuestRooms, markGuestRoomRead, rememberGuestRoom, setGuestFavorite, setGuestRoomNotificationState } from './utils/roomRelationships.js';
import {
  addLocalNotification,
  getLocalUnreadCount,
  loadLocalNotificationPreferences,
  loadLocalNotifications,
  markAllLocalNotificationsRead,
  saveLocalNotificationPreferences,
  updateLocalNotification,
} from './utils/localNotifications.js';

const LEGAL_VIEWS = new Set(['privacy', 'terms', 'refund-policy', 'safety', 'contact']);
const COMMUNITY_VIEWS = new Set(['communities', 'community-home', 'create-community', 'community-settings', 'event-lobby', 'event-editor', 'announcement-manager']);
const VIEW_PATHS = {
  landing: '/',
  explore: '/explore',
  communities: '/communities',
  create: '/create',
  pricing: '/pricing',
  store: '/store',
  billing: '/billing',
  'my-rooms': '/my-rooms',
  profile: '/profile',
  admin: '/admin',
  status: '/status',
  privacy: '/privacy',
  terms: '/terms',
  'refund-policy': '/refund-policy',
  safety: '/safety',
  contact: '/contact',
  updates: '/updates',
  guest: '/guest',
};
const DEFAULT_LAUNCH_STATUS = {
  mode: 'dev',
  maintenanceMode: false,
  signupsEnabled: true,
  guestChatEnabled: true,
  communitiesEnabled: true,
  storeEnabled: true,
};

const SIDE_PANEL_TRIGGER_STORAGE_KEY = 'nexusChat.sideTriggerVariant.v2';
const LEGACY_SIDE_PANEL_TRIGGER_STORAGE_KEY = 'nexusChat.sideTriggerVariant';
const DEFAULT_SIDE_PANEL_TRIGGER_VARIANT = 'infinity';

const DEFAULT_PWA_STATUS = {
  enabled: true,
  manifest: true,
  serviceWorker: false,
  offlineShell: false,
  fcm: {
    enabled: false,
    ready: false,
    state: 'disabled',
    unavailableReason: 'fcm_disabled',
    vapidKeyConfigured: false,
  },
};

const initialInviteCode = getInviteCodeFromPath();
const initialPathView = getViewFromPath(window.location.pathname);
const isAdminPath = initialPathView === 'admin';

export default function App() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [authToken, setAuthToken] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [theme, setTheme] = useState(() => loadTheme());
  const sidePanelTriggerVariant = useMemo(resolveSidePanelTriggerVariant, []);
  const [view, setView] = useState(() => {
    if (initialPathView && !initialInviteCode) {
      return initialPathView;
    }

    if (isAdminPath) {
      return 'admin';
    }

    if (!initialInviteCode) {
      return 'landing';
    }

    return loadProfile() ? 'loading-link' : 'guest';
  });
  const [pendingView, setPendingView] = useState(initialInviteCode ? 'join-link' : 'explore');
  const [createDefaultType, setCreateDefaultType] = useState('public');
  const [createCommunityMode, setCreateCommunityMode] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [notice, setNotice] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const [joiningLink, setJoiningLink] = useState(Boolean(initialInviteCode));
  const [socketReadyKey, setSocketReadyKey] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState(() => loadBlockedUsers());
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const [accountProfile, setAccountProfile] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [myRooms, setMyRooms] = useState(() => loadGuestRooms());
  const [myRoomsLoading, setMyRoomsLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState({ enabled: false, provider: 'razorpay', state: 'disabled' });
  const [billingSummary, setBillingSummary] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [busyProductId, setBusyProductId] = useState('');
  const [notifications, setNotifications] = useState(() => loadLocalNotifications());
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(() => getLocalUnreadCount());
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(() => loadLocalNotificationPreferences());
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communityDetails, setCommunityDetails] = useState(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [appReportTarget, setAppReportTarget] = useState(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [launchStatus, setLaunchStatus] = useState(DEFAULT_LAUNCH_STATUS);
  const [launchStatusError, setLaunchStatusError] = useState('');
  const [pwaStatus, setPwaStatus] = useState(DEFAULT_PWA_STATUS);
  const [pwaState, setPwaState] = useState(() => getInitialPwaState());
  const [pushState, setPushState] = useState(() => ({
    supported: false,
    state: 'checking',
    reason: '',
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    tokenRegistered: Boolean(getStoredPushTokenId()),
    tokenId: getStoredPushTokenId(),
    loading: false,
  }));
  const socketRef = useRef(null);
  const consumedInviteRef = useRef(false);
  const restoreAttemptedRef = useRef(false);
  const activeRoomRef = useRef('');
  const profileRef = useRef(profile);
  const authTokenRef = useRef(authToken);

  useEffect(() => {
    const handlePopState = () => {
      const nextView = getViewFromPath(window.location.pathname);

      if (nextView) {
        setView(nextView);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setSidePanelOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    activeRoomRef.current = roomState?.room?.roomId || '';
  }, [roomState?.room?.roomId]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  useEffect(
    () =>
      subscribeToFirebaseAuth((session) => {
        setAuthToken(session?.idToken || '');

        if (!session?.user?.userId) {
          setAccountProfile(null);
          setProfile((current) =>
            current?.userId
              ? saveProfile({
          ...current,
          userId: null,
          authProvider: null,
          profileRingId: '',
          badgeIds: [],
          photoMode: 'avatar',
          photoURL: '',
          googlePhotoURL: '',
          email: '',
        })
              : current,
          );
          return;
        }

        setProfile((current) =>
          createLinkedProfile({
            sessionId: current?.sessionId,
            displayName: current?.displayName || session.user.displayName,
            avatar: current?.avatar,
            handle: current?.handle,
            status: current?.status,
            userId: session.user.userId,
            photoMode: current?.authProvider === 'google' ? current?.photoMode || 'google' : 'google',
            photoURL: current?.authProvider === 'google' && current?.photoMode === 'avatar' ? '' : session.user.photoURL,
            googlePhotoURL: session.user.photoURL || current?.googlePhotoURL || '',
            email: session.user.email,
          }),
        );
      }),
    [],
  );

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      window.setTimeout(() => dismissToast(id), 3200);
    },
    [dismissToast],
  );

  const requestConfirmation = useCallback((options) => {
    setConfirmation({
      tone: 'danger',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options,
      busy: false,
    });
  }, []);

  const cancelConfirmation = useCallback(() => {
    setConfirmation((current) => (current?.busy ? current : null));
  }, []);

  const confirmCurrentAction = useCallback(async () => {
    const current = confirmation;

    if (!current || current.busy) {
      return;
    }

    setConfirmation({ ...current, busy: true });
    try {
      await current.onConfirm?.();
      setConfirmation(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Action failed.', 'error');
      setConfirmation(null);
    }
  }, [addToast, confirmation]);

  useEffect(() => {
    fetchBillingCatalog()
      .then((data) => setBillingStatus(data.billing || { enabled: false, provider: 'razorpay', state: 'disabled' }))
      .catch(() => setBillingStatus({ enabled: false, provider: 'razorpay', state: 'disabled' }));
  }, []);

  useEffect(() => {
    let alive = true;

    fetchStatus()
      .then((data) => {
        if (alive) {
          setLaunchStatus({ ...DEFAULT_LAUNCH_STATUS, ...(data.launch || {}) });
          setPwaStatus({ ...DEFAULT_PWA_STATUS, ...(data.pwa || {}) });
          setLaunchStatusError('');
        }
      })
      .catch(() => {
        if (alive) {
          setLaunchStatusError('Launch status is unavailable. Live rooms may reconnect when the server returns.');
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const stopNetworkWatch = watchNetwork(({ online, lastTransition }) => {
      setPwaState((current) => ({ ...current, online, lastTransition }));

      if (lastTransition === 'offline') {
        addToast('You are offline. Live chat will resume after reconnecting.', 'error');
      }

      if (lastTransition === 'online') {
        addToast('Back online. Reconnecting Nexus Chat.');
        const activeSocket = socketRef.current;

        if (activeSocket && !activeSocket.connected && !activeSocket.active) {
          activeSocket.connect?.();
        }
      }
    });
    const stopInstallWatch = watchInstallPrompt((updates) => {
      setPwaState((current) => ({ ...current, ...updates }));
    });

    registerNexusServiceWorker({ onMessage: handlePwaMessage })
      .then(({ supported, registration }) => {
        if (!alive) {
          return;
        }

        setPwaState((current) => ({
          ...current,
          serviceWorkerSupported: supported,
          serviceWorkerReady: Boolean(registration),
        }));
      })
      .catch(() => {
        if (alive) {
          setPwaState((current) => ({ ...current, serviceWorkerReady: false }));
        }
      });

    return () => {
      alive = false;
      stopNetworkWatch?.();
      stopInstallWatch?.();
    };
  }, [addToast]);

  useEffect(() => {
    let alive = true;

    getPushCapability(pwaStatus)
      .then((capability) => {
        if (alive) {
          setPushState((current) => ({
            ...current,
            ...capability,
            tokenRegistered: Boolean(capability.tokenRegistered || getStoredPushTokenId()),
            tokenId: capability.tokenId || getStoredPushTokenId(),
            loading: false,
          }));
        }
      })
      .catch(() => {
        if (alive) {
          setPushState((current) => ({
            ...current,
            supported: false,
            state: 'unsupported',
            reason: 'browser_unsupported',
            loading: false,
          }));
        }
      });

    if (authToken && profile?.userId) {
      watchForegroundMessages((payload) => {
        const title = payload?.notification?.title || payload?.data?.title || 'Nexus Chat update';
        addToast(title);
      });
    }

    return () => {
      alive = false;
    };
  }, [pwaStatus, authToken, profile?.userId, addToast]);

  useEffect(() => {
    if (!profile) {
      setConnectionState('idle');
      return undefined;
    }

    const nextSocket = createNexusSocket(profile);
    const manager = nextSocket.io;
    let disposed = false;
    socketRef.current = nextSocket;
    setConnectionState('connecting');

    const logSocketDebug = (event, details = {}) => {
      if (import.meta.env.DEV) {
        console.debug(`[nexus:socket] ${event}`, details);
      }
    };

    const announceReady = () => {
      const latestProfile = profileRef.current;
      const latestToken = authTokenRef.current;

      if (!latestProfile || disposed || !nextSocket.connected) {
        return;
      }

      nextSocket.auth = {
        profile: latestProfile,
        sessionId: latestProfile.sessionId || '',
        userId: latestProfile.userId || '',
      };

      nextSocket.emit('guest:ready', { ...latestProfile, idToken: latestToken || undefined }, (response) => {
        if (disposed) {
          return;
        }

        if (response?.ok && response.profile) {
          setProfile((current) => mergeSocketProfile(current || latestProfile, response.profile, latestToken));
          setSocketReadyKey((current) => current + 1);
          return;
        }

        if (response?.error) {
          setConnectionState('disconnected');
          addToast(response.error, 'error');
        }
      });
    };

    const handleConnect = () => {
      if (disposed) {
        return;
      }

      setConnectionState('connected');
      logSocketDebug('connected', {
        id: nextSocket.id,
        transport: nextSocket.io.engine?.transport?.name || 'unknown',
      });
      announceReady();
    };

    const handleDisconnect = (reason) => {
      if (disposed) {
        return;
      }

      restoreAttemptedRef.current = false;
      setConnectionState(nextSocket.active ? 'reconnecting' : 'disconnected');
      logSocketDebug('disconnected', { reason, willReconnect: nextSocket.active });
    };

    const handleConnectError = (error) => {
      if (disposed) {
        return;
      }

      setConnectionState(nextSocket.active ? 'reconnecting' : 'disconnected');
      logSocketDebug('connect_error', { message: error?.message || 'connection failed' });
    };

    const handleReconnectAttempt = (attempt) => {
      if (disposed) {
        return;
      }

      setConnectionState('reconnecting');
      logSocketDebug('reconnect_attempt', { attempt });
    };

    const handleReconnect = (attempt) => {
      if (disposed) {
        return;
      }

      setConnectionState('connected');
      logSocketDebug('reconnected', { attempt });
    };

    const handleReconnectFailed = () => {
      if (disposed) {
        return;
      }

      setConnectionState('disconnected');
      addToast('Reconnect failed. Check your connection.', 'error');
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', handleConnectError);
    manager.on('reconnect_attempt', handleReconnectAttempt);
    manager.on('reconnect', handleReconnect);
    manager.on('reconnect_failed', handleReconnectFailed);

    nextSocket.on('rooms:update', ({ rooms: nextRooms }) => {
      setRooms(nextRooms || []);
    });

    nextSocket.on('community:update', ({ community }) => {
      if (!community) {
        return;
      }

      setCommunities((current) => [community, ...current.filter((item) => item.communityId !== community.communityId)]);
      setCommunityDetails((current) =>
        current?.community?.communityId === community.communityId ? { ...current, community } : current,
      );
    });

    nextSocket.on('community:announcement', ({ communityId, announcement }) => {
      setCommunityDetails((current) =>
        current?.community?.communityId === communityId
          ? { ...current, announcements: [announcement, ...(current.announcements || [])] }
          : current,
      );
    });

    nextSocket.on('community:activity', ({ communityId, activity }) => {
      setCommunityDetails((current) =>
        current?.community?.communityId === communityId ? { ...current, activity: [activity, ...(current.activity || [])] } : current,
      );
    });

    nextSocket.on('event:update', ({ event }) => {
      if (event?.eventId) {
        setActiveEvent((current) => (current?.eventId === event.eventId ? event : current));
      }
    });

    nextSocket.on('room:joined', (state) => {
      const latestProfile = profileRef.current;
      const latestToken = authTokenRef.current;
      setRoomState(state);
      setView('room');
      setJoiningLink(false);
      setNotice('');
      restoreAttemptedRef.current = true;

      if (state?.room?.roomId) {
        saveCurrentRoom(state.room);
        handleRoomRead(state.room.roomId, state.messages?.at(-1)?.messageId || '');

        if (latestProfile?.userId && latestToken) {
          refreshMyRooms();
        } else {
          setMyRooms(rememberGuestRoom(state.room, state?.currentUser?.role || 'member'));
        }
      }

      if (state?.room?.inviteCode) {
        window.history.replaceState(null, '', `/room/${state.room.inviteCode}`);
      }
    });

    nextSocket.on('room:state', (state) => {
      setRoomState(state);

      if (state?.room?.roomId) {
        saveCurrentRoom(state.room);
      }
    });

    nextSocket.on('message:new', (message) => {
      const latestProfile = profileRef.current;
      const latestToken = authTokenRef.current;
      upsertMessage(message);

      if (message.roomId === activeRoomRef.current && message.senderSessionId !== latestProfile?.sessionId) {
        handleRoomRead(message.roomId, message.messageId);
      }

      if (!(latestProfile?.userId && latestToken) && message.senderSessionId !== latestProfile?.sessionId) {
        const mentioned = (message.mentions || []).some((mention) => mention.sessionId === latestProfile?.sessionId);

        if (mentioned) {
          const next = addLocalNotification({
            type: 'mention',
            title: `${message.senderName} mentioned you`,
            body: message.content,
            roomId: message.roomId,
            targetView: 'room',
          });
          setNotifications(next);
          setNotificationUnreadCount(getLocalUnreadCount(next));
        }
      }
    });
    nextSocket.on('message:updated', upsertMessage);
    nextSocket.on('message:deleted', upsertMessage);

    nextSocket.on('notification:new', (notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item.notificationId !== notification.notificationId)].slice(0, 50));
      setNotificationUnreadCount((current) => current + (notification.readAt || notification.dismissedAt ? 0 : 1));
      addToast(notification.title || 'New notification');
    });

    nextSocket.on('notifications:unread', ({ unreadCount }) => {
      setNotificationUnreadCount(Number(unreadCount || 0));
    });

    nextSocket.on('room:announcement', ({ roomId, announcement }) => {
      setRoomState((current) => {
        if (!current?.room || current.room.roomId !== roomId) {
          return current;
        }

        const announcements = [
          announcement,
          ...(current.announcements || []).filter((item) => item.announcementId !== announcement.announcementId),
        ].filter((item) => item.active !== false);

        return {
          ...current,
          announcements,
          room: { ...current.room, latestAnnouncement: announcements[0] || null },
        };
      });
    });

    nextSocket.on('categoryTool:updated', ({ roomId, tools }) => {
      setRoomState((current) => {
        if (!current?.room || current.room.roomId !== roomId) {
          return current;
        }

        return {
          ...current,
          categoryTools: Array.isArray(tools) ? tools : current.categoryTools || [],
        };
      });
    });

    nextSocket.on('room:activity', ({ roomId, activity }) => {
      setRoomState((current) => {
        if (!current?.room || current.room.roomId !== roomId) {
          return current;
        }

        return { ...current, activity: [activity, ...(current.activity || [])].slice(0, 50) };
      });
    });

    nextSocket.on('users:update', (users) => {
      setRoomState((current) => (current ? { ...current, users } : current));
    });

    nextSocket.on('typing:update', ({ roomId, typingUsers }) => {
      setRoomState((current) => {
        if (!current?.room || current.room.roomId !== roomId) {
          return current;
        }

        return { ...current, typingUsers: typingUsers || [] };
      });
    });

    nextSocket.on('room:error', ({ message }) => {
      const error = message || 'Something went wrong.';
      setNotice(error);
      setJoiningLink(false);
      addToast(error, 'error');
    });

    nextSocket.on('room:closed', ({ reason }) => {
      clearCurrentRoom();
      setNotice(reason || 'Room closed.');
      setRoomState(null);
      setView('explore');
      window.history.replaceState(null, '', '/');
      addToast(reason || 'Room closed.', 'error');
    });

    nextSocket.on('room:kicked', ({ reason }) => {
      clearCurrentRoom();
      setNotice(reason || 'You were removed from the room.');
      setRoomState(null);
      setView('explore');
      window.history.replaceState(null, '', '/');
      addToast(reason || 'You were removed from the room.', 'error');
    });

    nextSocket.connect();

    return () => {
      disposed = true;
      manager.off('reconnect_attempt', handleReconnectAttempt);
      manager.off('reconnect', handleReconnect);
      manager.off('reconnect_failed', handleReconnectFailed);
      if (typeof nextSocket.removeAllListeners === 'function') {
        nextSocket.removeAllListeners();
      } else {
        nextSocket.off();
      }
      nextSocket.disconnect();
      if (socketRef.current === nextSocket) {
        socketRef.current = null;
      }
    };
  }, [profile?.sessionId, profile?.userId, addToast]);

  useEffect(() => {
    const activeSocket = socketRef.current;

    if (!profile || !activeSocket?.connected || socketReadyKey === 0) {
      return;
    }

    if (initialInviteCode && !consumedInviteRef.current) {
      consumedInviteRef.current = true;
      setJoiningLink(true);
      emitWithNotice('room:join', { code: initialInviteCode });
      return;
    }

    const storedRoom = loadCurrentRoom();

    if (!storedRoom || restoreAttemptedRef.current || (view !== 'room' && !roomState?.room)) {
      return;
    }

    restoreAttemptedRef.current = true;
    emitWithNotice('room:restore', storedRoom);
  }, [profile, socketReadyKey, view, roomState?.room?.roomId]);

  useEffect(() => {
    if (view !== 'explore') {
      return;
    }

    setRoomsLoading(true);
    fetchPublicRooms()
      .then(setRooms)
      .catch((error) => {
        setNotice(error.message);
        addToast(error.message, 'error');
      })
      .finally(() => setRoomsLoading(false));
  }, [view, addToast]);

  useEffect(() => {
    if (view === 'my-rooms') {
      refreshMyRooms();
    }
  }, [view, authToken, profile?.userId]);

  useEffect(() => {
    if (view !== 'communities') {
      return;
    }

    setCommunitiesLoading(true);
    fetchCommunities()
      .then((data) => setCommunities(data.communities || []))
      .catch((error) => addToast(error.message, 'error'))
      .finally(() => setCommunitiesLoading(false));
  }, [view, addToast]);

  useEffect(() => {
    if (!authToken || !profile?.userId) {
      setBlockedProfiles([]);
      setBillingSummary(null);
      const localNotifications = loadLocalNotifications();
      setNotifications(localNotifications);
      setNotificationUnreadCount(getLocalUnreadCount(localNotifications));
      setNotificationPreferences(loadLocalNotificationPreferences());
      return;
    }

    fetchMyProfile(authToken, profile.sessionId)
      .then(({ profile: nextProfile }) => {
        setAccountProfile(nextProfile);
        setNotificationPreferences(nextProfile?.settings?.notificationPreferences || {});
      })
      .catch((error) => addToast(error.message, 'error'));
    fetchMyBlocks(authToken, profile.sessionId)
      .then(({ blocks }) => {
        const nextBlocks = blocks || [];
        setBlockedProfiles(nextBlocks);
        setBlockedUsers(nextBlocks.map((block) => block.blockedId));
      })
      .catch((error) => addToast(error.message, 'error'));
    fetchMyRooms(authToken, profile.sessionId)
      .then(({ rooms: nextRooms }) => setMyRooms(nextRooms || []))
      .catch((error) => addToast(error.message, 'error'));
    refreshNotifications();
    refreshBillingSummary();
  }, [authToken, profile?.userId, profile?.sessionId, addToast]);

  const appClass = useMemo(() => `app app--${view}`, [view]);
  const isLoggedIn = Boolean(profile?.userId && authToken);
  const favoriteRoomIds = useMemo(
    () => myRooms.filter((relationship) => relationship.isFavorite).map((relationship) => relationship.roomId),
    [myRooms],
  );

  function upsertMessage(message) {
    setRoomState((current) => {
      if (!current?.room || current.room.roomId !== message.roomId) {
        return current;
      }

      const index = current.messages.findIndex((item) => item.messageId === message.messageId);

      if (index === -1) {
        return {
          ...current,
          messages: [...current.messages, message],
        };
      }

      const messages = [...current.messages];
      messages[index] = message;
      return { ...current, messages };
    });
  }

  function requireProfile(nextView, fallback = nextView) {
    setNotice('');

    if (!profile) {
      setPendingView(fallback);
      pushViewPath('guest');
      setView('guest');
      return false;
    }

    pushViewPath(nextView);
    setView(nextView);
    return true;
  }

  function handleProfileComplete(nextProfile) {
    setProfile(nextProfile);
    setView(pendingView === 'join-link' ? 'loading-link' : pendingView);
  }

  async function refreshMyRooms() {
    if (!profile?.userId || !authToken) {
      setMyRooms(loadGuestRooms());
      return;
    }

    setMyRoomsLoading(true);

    try {
      const data = await fetchMyRooms(authToken, profile.sessionId);
      setMyRooms(data.rooms || []);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setMyRoomsLoading(false);
    }
  }

  async function refreshNotifications() {
    if (!profile?.userId || !authToken) {
      const localNotifications = loadLocalNotifications();
      setNotifications(localNotifications);
      setNotificationUnreadCount(getLocalUnreadCount(localNotifications));
      return;
    }

    setNotificationsLoading(true);

    try {
      const data = await fetchMyNotifications(authToken, profile.sessionId);
      setNotifications(data.notifications || []);
      setNotificationUnreadCount(Number(data.unreadCount || 0));
      const preferences =
        accountProfile?.settings?.notificationPreferences ||
        data.preferences ||
        notificationPreferences;
      setNotificationPreferences(preferences || {});
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function handleNotificationRead(notificationId) {
    if (profile?.userId && authToken) {
      try {
        await markNotificationRead(authToken, profile.sessionId, notificationId);
        setNotifications((current) =>
          current.map((notification) =>
            notification.notificationId === notificationId
              ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
              : notification,
          ),
        );
        setNotificationUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        addToast(error.message, 'error');
      }
      return;
    }

    const next = updateLocalNotification(notificationId, { readAt: new Date().toISOString() });
    setNotifications(next);
    setNotificationUnreadCount(getLocalUnreadCount(next));
  }

  async function handleNotificationDismiss(notificationId) {
    if (profile?.userId && authToken) {
      try {
        await dismissNotification(authToken, profile.sessionId, notificationId);
        setNotifications((current) =>
          current.map((notification) =>
            notification.notificationId === notificationId
              ? { ...notification, dismissedAt: notification.dismissedAt || new Date().toISOString() }
              : notification,
          ),
        );
        setNotificationUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        addToast(error.message, 'error');
      }
      return;
    }

    const next = updateLocalNotification(notificationId, { dismissedAt: new Date().toISOString() });
    setNotifications(next);
    setNotificationUnreadCount(getLocalUnreadCount(next));
  }

  async function handleNotificationsReadAll() {
    if (profile?.userId && authToken) {
      try {
        await markAllNotificationsRead(authToken, profile.sessionId);
        setNotifications((current) =>
          current.map((notification) =>
            notification.dismissedAt ? notification : { ...notification, readAt: notification.readAt || new Date().toISOString() },
          ),
        );
        setNotificationUnreadCount(0);
      } catch (error) {
        addToast(error.message, 'error');
      }
      return;
    }

    const next = markAllLocalNotificationsRead();
    setNotifications(next);
    setNotificationUnreadCount(getLocalUnreadCount(next));
  }

  function handleNotificationActivate(notification) {
    if (notification?.targetView === 'billing') {
      setView('billing');
      return;
    }

    if (notification?.targetView === 'my-rooms') {
      setView('my-rooms');
      return;
    }

    if (notification?.roomId) {
      requireProfile('explore');
      emitWithNotice('room:join', { roomId: notification.roomId });
    }
  }

  function handlePwaMessage(message = {}) {
    if (message.type !== 'nexus-notification-click') {
      return;
    }

    if (message.targetView === 'billing') {
      navigateView('billing');
      return;
    }

    if (message.targetView === 'my-rooms') {
      navigateView('my-rooms');
      return;
    }

    if (message.targetView === 'profile') {
      navigateView('profile');
      return;
    }

    if (message.roomId && profile) {
      requireProfile('explore');
      emitWithNotice('room:join', { roomId: message.roomId });
      return;
    }

    const nextView = getViewFromPath(new URL(message.targetUrl || '/', window.location.origin).pathname);
    if (nextView) {
      navigateView(nextView);
    }
  }

  async function handleInstallApp() {
    try {
      const result = await promptInstall();

      if (result.installed) {
        setPwaState((current) => ({ ...current, installed: true, installAvailable: false, installDismissed: true }));
        addToast('Nexus Chat installed');
        return;
      }

      if (result.unavailable) {
        addToast('Install prompt is not available in this browser yet.');
        return;
      }

      addToast('Install prompt dismissed.');
    } catch {
      addToast('Could not open the install prompt.', 'error');
    }
  }

  function handleDismissInstall() {
    dismissInstallPrompt();
    setPwaState((current) => ({ ...current, installDismissed: true, installAvailable: false }));
  }

  async function handleEnablePush() {
    if (!profile?.userId || !authToken) {
      addToast('Login with Google to enable push notifications.', 'error');
      handleDirectLogin('profile');
      return;
    }

    setPushState((current) => ({ ...current, loading: true }));

    try {
      const next = await enablePushNotifications({
        idToken: authToken,
        sessionId: profile.sessionId,
        deviceLabel: navigator.userAgent?.includes('Mobile') ? 'Mobile browser' : 'Desktop browser',
        publicPwaStatus: pwaStatus,
        onForegroundMessage: (payload) => addToast(payload?.notification?.title || payload?.data?.title || 'Nexus push update'),
      });
      const nextPreferences = { ...notificationPreferences, pushEnabled: true };
      await handleNotificationPreferences(nextPreferences);
      setPushState((current) => ({ ...current, ...next, loading: false }));
      addToast('Push notifications enabled');
    } catch (error) {
      setPushState((current) => ({
        ...current,
        loading: false,
        state: current.permission === 'denied' ? 'denied' : current.state,
        reason: error instanceof Error ? error.message : current.reason,
      }));
      addToast(error instanceof Error ? error.message : 'Could not enable push notifications.', 'error');
    }
  }

  async function handleDisablePush() {
    setPushState((current) => ({ ...current, loading: true }));

    try {
      const next = await disablePushNotifications({ idToken: authToken, sessionId: profile?.sessionId });
      const nextPreferences = { ...notificationPreferences, pushEnabled: false };
      await handleNotificationPreferences(nextPreferences);
      setPushState((current) => ({ ...current, ...next, loading: false }));
      addToast('Push notifications disabled for this browser.');
    } catch (error) {
      setPushState((current) => ({ ...current, loading: false }));
      addToast(error instanceof Error ? error.message : 'Could not disable push notifications.', 'error');
    }
  }

  async function handleRoomRead(roomId, lastReadMessageId = '') {
    if (!roomId) {
      return;
    }

    if (profile?.userId && authToken) {
      emitQuiet('room:read', { roomId, lastReadMessageId });
      try {
        await markRoomRead(authToken, profile.sessionId, roomId, { lastReadMessageId });
        await refreshMyRooms();
      } catch {
        // Socket read state is enough for the live room; REST retry happens on next refresh.
      }
      return;
    }

    setMyRooms(markGuestRoomRead(roomId));
  }

  async function handleNotificationPreferences(nextPreferences) {
    setNotificationPreferences(nextPreferences);

    if (profile?.userId && authToken) {
      try {
        await updateNotificationPreferences(authToken, profile.sessionId, nextPreferences);
      } catch (error) {
        addToast(error.message, 'error');
      }
      return;
    }

    saveLocalNotificationPreferences(nextPreferences);
  }

  async function handleRoomNotificationState(roomId, payload) {
    if (!roomId) {
      return;
    }

    if (profile?.userId && authToken) {
      try {
        await updateRoomNotifications(authToken, profile.sessionId, roomId, payload);
        await refreshMyRooms();
        addToast(payload.notificationsMuted ? 'Room notifications muted' : 'Room notifications restored');
      } catch (error) {
        addToast(error.message, 'error');
      }
      return;
    }

    setMyRooms(setGuestRoomNotificationState(roomId, payload));
    addToast(payload.notificationsMuted ? 'Room notifications muted locally' : 'Room notifications restored locally');
  }

  async function refreshBillingSummary() {
    if (!profile?.userId || !authToken) {
      setBillingSummary(null);
      return null;
    }

    setBillingLoading(true);

    try {
      const data = await fetchBillingEntitlements(authToken, profile.sessionId);
      setBillingSummary(data);

      if (data.billing) {
        setBillingStatus(data.billing);
      }

      return data;
    } catch (error) {
      addToast(error.message, 'error');
      return null;
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleGoogleSignIn(draftProfile, nextViewOverride = '') {
    if (launchStatus.signupsEnabled === false) {
      addToast('Google login is paused for this launch mode.', 'error');
      return;
    }

    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle();
      const linkedProfile = createLinkedProfile({
        sessionId: profile?.sessionId,
        displayName: draftProfile.displayName || result.user.displayName,
        avatar: draftProfile.avatar,
        userId: result.user.userId,
        photoMode: profile?.authProvider === 'google' ? profile?.photoMode || 'google' : 'google',
        photoURL: profile?.authProvider === 'google' && profile?.photoMode === 'avatar' ? '' : result.user.photoURL,
        googlePhotoURL: result.user.photoURL || profile?.googlePhotoURL || '',
        email: result.user.email,
      });
      setAuthToken(result.idToken);
      if (nextViewOverride) {
        setProfile(linkedProfile);
        setView(nextViewOverride);
      } else {
        handleProfileComplete(linkedProfile);
      }
      addToast('Google profile linked for this session');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Google sign-in failed.', 'error');
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleLoginToBuy() {
    const returnView = ['pricing', 'billing', 'store'].includes(view) ? view : 'billing';

    if (!profile) {
      setPendingView(returnView);
      setView('guest');
      return;
    }

    handleGoogleSignIn(profile, returnView);
  }

  function handleDirectLogin(nextViewOverride = view) {
    handleGoogleSignIn(profile || { displayName: '', avatar: 'nexus' }, nextViewOverride || 'profile');
  }

  async function handleLogout() {
    try {
      if (authToken && pushState.tokenRegistered) {
        await disablePushNotifications({ idToken: authToken, sessionId: profile?.sessionId }).catch(() => {});
        setPushState((current) => ({ ...current, tokenRegistered: false, tokenId: '', state: 'available' }));
      }
      await signOutFirebase();
      setAuthToken('');
      setAccountProfile(null);
      setBillingSummary(null);
      setProfile((current) =>
        current
          ? saveProfile({
              ...current,
              userId: null,
              authProvider: null,
              profileRingId: '',
              badgeIds: [],
              photoMode: 'avatar',
              photoURL: '',
              googlePhotoURL: '',
              email: '',
            })
          : current,
      );
      addToast('Logged out. Guest chat stays ready.');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Logout failed.', 'error');
    }
  }

  function requestLogout() {
    requestConfirmation({
      eyebrow: 'Account action',
      title: 'Logout from Nexus?',
      body: 'Your Google session will be disconnected on this browser. Guest chat will stay available so you can keep using Nexus quickly.',
      confirmLabel: 'Logout',
      cancelLabel: 'Stay logged in',
      tone: 'danger',
      onConfirm: handleLogout,
    });
  }

  function handleCreateRoom(payload) {
    emitWithNotice('room:create', payload, { success: 'Room created' });
  }

  async function handleCreateCommunity(payload) {
    if (!isLoggedIn) {
      addToast('Login with Google to create a community.', 'error');
      handleDirectLogin('create-community');
      return;
    }

    try {
      const result = await createCommunity(authToken, profile.sessionId, payload);
      addToast('Community created');
      await openCommunity(result.community);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not create community.', 'error');
    }
  }

  async function handleBuyProduct(productId) {
    if (!profile?.userId || !authToken) {
      addToast('Login with Google to buy Nexus premium access.');
      handleLoginToBuy();
      return;
    }

    setBusyProductId(productId);

    try {
      const order = await createPaymentOrder(authToken, profile.sessionId, productId);
      const checkoutResult = await openRazorpayCheckout({ order, profile });
      const verified = await verifyPayment(authToken, profile.sessionId, {
        productId,
        ...checkoutResult,
      });
      setBillingSummary(verified.summary || (await refreshBillingSummary()));
      await Promise.all([refreshMyRooms(), fetchBillingCatalog().then((data) => setBillingStatus(data.billing || billingStatus))]);
      addToast('Premium access updated');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Checkout could not be completed.', 'error');
    } finally {
      setBusyProductId('');
    }
  }

  function handleApplyRoomTheme(themeId) {
    if (!roomState?.room) {
      addToast('Join a room before applying a room theme.', 'error');
      return;
    }

    emitWithNotice(
      'room:theme',
      {
        roomId: roomState.room.roomId,
        themeId,
      },
      { success: 'Room theme applied' },
    );
  }

  async function handleApplyProfileCosmetic(cosmetic) {
    if (!cosmetic) {
      return;
    }

    const currentProfile = accountProfile || profile;
    const nextPayload = {
      displayName: currentProfile?.displayName || profile?.displayName,
      avatar: currentProfile?.avatar || profile?.avatar,
      handle: currentProfile?.handle || '',
      status: currentProfile?.status || '',
      profileRingId: currentProfile?.profileRingId || '',
      badgeIds: currentProfile?.badgeIds || [],
    };

    if (cosmetic.type === 'profileRing') {
      nextPayload.profileRingId = cosmetic.cosmeticId;
    }

    if (cosmetic.type === 'badge') {
      nextPayload.badgeIds = [...new Set([...(nextPayload.badgeIds || []), cosmetic.cosmeticId])];
    }

    await handleProfileSave(nextPayload);
  }

  function handleJoinRoom(payload) {
    emitWithNotice('room:join', payload);
  }

  function navigateHome() {
    pushViewPath('landing');
    setView('landing');
    setSidePanelOpen(false);
    setOpenNavMenu('');
  }

  function navigateView(nextView) {
    pushViewPath(nextView);
    setView(nextView);
    setSidePanelOpen(false);
    setOpenNavMenu('');
  }

  function navigateExplore() {
    setSidePanelOpen(false);
    setOpenNavMenu('');
    requireProfile('explore');
  }

  function navigateCreate() {
    setCreateCommunityMode(false);
    setSidePanelOpen(false);
    setOpenNavMenu('');
    requireProfile('create', 'create');
  }

  async function openCommunity(community) {
    if (!community?.communityId && !community?.slug) {
      return;
    }

    setCommunityLoading(true);

    try {
      const details = await fetchCommunity(community.slug || community.communityId, authToken, profile?.sessionId);
      setCommunityDetails(details);
      setView('community-home');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not open community.', 'error');
    } finally {
      setCommunityLoading(false);
    }
  }

  async function reloadActiveCommunity() {
    if (!communityDetails?.community) {
      return null;
    }

    const details = await fetchCommunity(
      communityDetails.community.slug || communityDetails.community.communityId,
      authToken,
      profile?.sessionId,
    );
    setCommunityDetails(details);
    return details;
  }

  async function handleJoinCommunity() {
    if (!isLoggedIn) {
      handleDirectLogin('community-home');
      return;
    }

    try {
      const result = await joinCommunity(authToken, profile.sessionId, communityDetails.community.communityId);
      setCommunityDetails((current) => ({ ...current, ...result }));
      addToast('Community joined');
      await reloadActiveCommunity();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not join community.', 'error');
    }
  }

  async function handleLeaveCommunity() {
    if (!communityDetails?.community) {
      return;
    }

    requestConfirmation({
      eyebrow: 'Community action',
      title: `Leave ${communityDetails.community.name}?`,
      body: 'You will lose member access until you join again. Public communities can be joined again if they remain available.',
      confirmLabel: 'Leave Community',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await leaveCommunity(authToken, profile.sessionId, communityDetails.community.communityId);
          addToast('Community left');
          await reloadActiveCommunity();
        } catch (error) {
          addToast(error instanceof Error ? error.message : 'Could not leave community.', 'error');
        }
      },
    });
  }

  async function handleFavoriteCommunity() {
    if (!isLoggedIn) {
      handleDirectLogin('community-home');
      return;
    }

    try {
      await favoriteCommunity(authToken, profile.sessionId, communityDetails.community.communityId, true);
      addToast('Community pinned');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not pin community.', 'error');
    }
  }

  async function handleCommunitySettingsSave(payload) {
    try {
      const result = await updateCommunity(authToken, profile.sessionId, communityDetails.community.communityId, payload);
      setCommunityDetails((current) => ({ ...current, community: result.community }));
      setView('community-home');
      addToast('Community updated');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update community.', 'error');
    }
  }

  async function handleCommunityRoleChange(member, role) {
    try {
      await updateCommunityRole(authToken, profile.sessionId, communityDetails.community.communityId, member.memberId, role);
      addToast('Community role updated');
      await reloadActiveCommunity();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update role.', 'error');
    }
  }

  async function handleCommunityBan(member) {
    if (!communityDetails?.community || !member?.memberId) {
      return;
    }

    requestConfirmation({
      eyebrow: 'Community moderation',
      title: `Ban ${member.displayName || 'this member'} for 24 hours?`,
      body: 'They will be blocked from this community and its rooms during the ban. Use this for abuse, spam, or safety issues.',
      confirmLabel: 'Ban Member',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await banCommunityMember(authToken, profile.sessionId, communityDetails.community.communityId, member.memberId, {
            duration: '24h',
            reason: 'Community moderation',
          });
          addToast('Community member banned');
          await reloadActiveCommunity();
        } catch (error) {
          addToast(error instanceof Error ? error.message : 'Could not ban member.', 'error');
        }
      },
    });
  }

  async function handleCreateCommunityRoom(payload) {
    try {
      const result = await createCommunityRoom(authToken, profile.sessionId, communityDetails.community.communityId, payload);
      addToast('Community room created');
      handleJoinRoom({ roomId: result.room.roomId });
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not create community room.', 'error');
    }
  }

  async function handleCreateEvent(payload) {
    try {
      const result = await createEvent(authToken, profile.sessionId, payload);
      setActiveEvent(result.event);
      addToast('Event room scheduled');
      setView('event-lobby');
      await reloadActiveCommunity();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not create event.', 'error');
    }
  }

  async function openEvent(event) {
    try {
      const result = await fetchEvent(event.eventId);
      setActiveEvent(result.event);
      setView('event-lobby');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not open event.', 'error');
    }
  }

  async function handleEventRsvp(status) {
    try {
      await setEventRsvp(authToken, profile.sessionId, activeEvent.eventId, status);
      addToast('RSVP updated');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update RSVP.', 'error');
    }
  }

  async function handleScheduleAnnouncement(payload) {
    try {
      await createScheduledAnnouncement(authToken, profile.sessionId, payload);
      addToast('Announcement scheduled');
      setView(communityDetails?.community ? 'community-home' : 'my-rooms');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not schedule announcement.', 'error');
    }
  }

  function handleSend(content, replyTarget, options = {}) {
    if (!content.trim() || !roomState?.room) {
      return;
    }

    if (!pwaState.online) {
      const message = 'You are offline. Reconnect before sending messages.';
      setNotice(message);
      addToast(message, 'error');
      return;
    }

    emitWithNotice('message:send', {
      roomId: roomState.room.roomId,
      content,
      replyToMessageId: replyTarget?.messageId || '',
      messageType: options.messageType || 'text',
      categoryToolType: options.categoryToolType || '',
      categoryToolId: options.categoryToolId || '',
      metadata: options.metadata || {},
      secretWarningAccepted: Boolean(options.secretWarningAccepted),
    });
  }

  function handleCategoryToolAction(eventName, payload = {}, options = {}) {
    if (!roomState?.room) {
      return;
    }

    emitWithNotice(
      eventName,
      {
        roomId: roomState.room.roomId,
        ...payload,
      },
      options,
    );
  }

  function handleSendCardMessage(messageType, content, metadata = {}, categoryToolType = '', categoryToolId = '') {
    handleSend(content, null, {
      messageType,
      categoryToolType,
      categoryToolId,
      metadata,
    });
  }

  function handleReact(messageId, emoji) {
    if (!roomState?.room) {
      return;
    }

    emitWithNotice('message:react', {
      roomId: roomState.room.roomId,
      messageId,
      emoji,
    });
  }

  function handleDeleteMessage(messageId) {
    if (!roomState?.room) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Message action',
      title: 'Delete this message?',
      body: 'The message will be hidden for everyone in this room. This cannot be undone from the chat UI.',
      confirmLabel: 'Delete Message',
      tone: 'danger',
      onConfirm: () =>
        emitWithNotice(
          'message:delete',
          {
            roomId,
            messageId,
          },
          { success: 'Message deleted' },
        ),
    });
  }

  function handleTypingStart() {
    if (!roomState?.room) {
      return;
    }

    emitQuiet('typing:start', { roomId: roomState.room.roomId });
  }

  function handleTypingStop() {
    if (!roomState?.room) {
      return;
    }

    emitQuiet('typing:stop', { roomId: roomState.room.roomId });
  }

  function handleLeave() {
    if (!roomState?.room) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Room action',
      title: `Leave ${roomState.room.title || 'this room'}?`,
      body: 'You will exit the live room. Public rooms can be joined again from Explore, and private rooms need their invite.',
      confirmLabel: 'Leave Room',
      tone: 'safe',
      onConfirm: () => {
        emitWithNotice('room:leave', { roomId });
        clearCurrentRoom();
        setRoomState(null);
        setView('explore');
        window.history.replaceState(null, '', '/');
      },
    });
  }

  function handleDeleteRoom() {
    if (!roomState?.room) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Owner action',
      title: 'Close this room for everyone?',
      body: 'Everyone will be removed and the room will no longer be available. This is a destructive room owner action.',
      confirmLabel: 'Close Room',
      tone: 'danger',
      onConfirm: () => emitWithNotice('room:delete', { roomId }, { success: 'Room closed' }),
    });
  }

  function handleReport(payload) {
    emitWithNotice('moderation:report', payload, { success: 'Report sent' });
  }

  async function handleAppReportSubmit(payload) {
    try {
      await createReport(
        {
          ...payload,
          reporterName: profile?.displayName || 'Guest',
        },
        authToken,
        profile?.sessionId,
      );
      setAppReportTarget(null);
      addToast('Report sent');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not send report.', 'error');
    }
  }

  function openCommunityReport() {
    if (!profile) {
      requireProfile('community-home');
      return;
    }

    if (!communityDetails?.community) {
      return;
    }

    setAppReportTarget({
      targetType: 'community',
      targetId: communityDetails.community.communityId,
      roomId: '',
      label: communityDetails.community.name,
    });
  }

  function handleMuteUser(targetSessionId) {
    emitWithNotice(
      'moderation:mute',
      { roomId: roomState.room.roomId, targetSessionId },
      { success: 'User muted' },
    );
  }

  function handleUnmuteUser(targetSessionId) {
    emitWithNotice(
      'moderation:unmute',
      { roomId: roomState.room.roomId, targetSessionId },
      { success: 'User unmuted' },
    );
  }

  function handleKickUser(targetSessionId) {
    if (!roomState?.room || !targetSessionId) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Moderation action',
      title: 'Remove this user from the room?',
      body: 'They will be kicked out with a short cooldown. Use this for disruption or unsafe behavior.',
      confirmLabel: 'Kick User',
      tone: 'danger',
      onConfirm: () =>
        emitWithNotice(
          'moderation:kick',
          { roomId, targetSessionId },
          { success: 'User removed' },
        ),
    });
  }

  function handleClearRecentMessages() {
    if (!roomState?.room) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Moderation action',
      title: 'Clear the latest 50 messages?',
      body: 'Recent chat history will be removed from this room view for everyone. Use this only during spam or safety cleanup.',
      confirmLabel: 'Clear Messages',
      tone: 'danger',
      onConfirm: () => emitWithNotice('moderation:clear_recent', { roomId }, { success: 'Recent messages cleared' }),
    });
  }

  function handleBanUser(targetSessionId) {
    if (!roomState?.room || !targetSessionId) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Moderation action',
      title: 'Ban this user for 24 hours?',
      body: 'They will be removed and blocked from rejoining during the ban. This should be used for serious spam or safety issues.',
      confirmLabel: 'Ban User',
      tone: 'danger',
      onConfirm: () =>
        emitWithNotice(
          'moderation:ban',
          { roomId, targetSessionId, duration: '24h' },
          { success: 'User banned' },
        ),
    });
  }

  function handleUnbanUser(targetMemberId) {
    if (!roomState?.room || !targetMemberId) {
      return;
    }

    const roomId = roomState.room.roomId;
    requestConfirmation({
      eyebrow: 'Moderation action',
      title: 'Remove this ban?',
      body: 'The user will be allowed to join again if the room rules permit it.',
      confirmLabel: 'Unban User',
      tone: 'safe',
      onConfirm: () =>
        emitWithNotice(
          'moderation:unban',
          { roomId, targetMemberId },
          { success: 'Ban removed' },
        ),
    });
  }

  function handleSetRole(targetSessionId, role) {
    emitWithNotice(
      'room:role',
      { roomId: roomState.room.roomId, targetSessionId, role },
      { success: role === 'moderator' ? 'Moderator promoted' : 'Moderator removed' },
    );
  }

  function handleSaveRules(rules) {
    emitWithNotice('room:rules', { roomId: roomState.room.roomId, rules }, { success: 'Room rules saved' });
  }

  async function handleBlockUser(target) {
    if (!target?.blockedId) {
      return;
    }

    setBlockedUsers((current) => [...new Set([...current, target.blockedId])]);

    if (profile?.userId && authToken) {
      try {
        const { block } = await createMyBlock(authToken, profile.sessionId, target);
        setBlockedProfiles((current) => [block, ...current.filter((item) => item.blockedId !== block.blockedId)]);
      } catch (error) {
        addToast(error.message, 'error');
      }
    } else {
      setBlockedUsers(saveBlockedUsers([...blockedUsers, target.blockedId]));
    }

    addToast(`${target.displayName || 'User'} blocked`);
  }

  async function handleUnblockUser(blockedId, name = 'User') {
    setBlockedUsers((current) => current.filter((item) => item !== blockedId));

    if (profile?.userId && authToken) {
      try {
        await deleteMyBlock(authToken, profile.sessionId, blockedId);
        setBlockedProfiles((current) => current.filter((item) => item.blockedId !== blockedId));
      } catch (error) {
        addToast(error.message, 'error');
      }
    } else {
      setBlockedUsers(saveBlockedUsers(blockedUsers.filter((item) => item !== blockedId)));
    }

    addToast(`${name} unblocked`);
  }

  async function handleToggleFavorite(room, isFavorite) {
    if (!room?.roomId) {
      return;
    }

    if (profile?.userId && authToken) {
      try {
        await setFavoriteRoom(authToken, profile.sessionId, room.roomId, isFavorite);
        await refreshMyRooms();
      } catch (error) {
        addToast(error.message, 'error');
        return;
      }
    } else {
      if (isFavorite && !favoriteRoomIds.includes(room.roomId) && favoriteRoomIds.length >= 10) {
        addToast('Free guest favorite limit reached. Login and upgrade for more room pins.', 'error');
        return;
      }

      setMyRooms(setGuestFavorite(room, isFavorite));
    }

    addToast(isFavorite ? 'Room pinned' : 'Room unpinned');
  }

  async function handleProfileSave(payload) {
    setProfileSaving(true);

    try {
      if (profile?.userId && authToken) {
        const { profile: nextAccountProfile } = await updateMyProfile(authToken, profile.sessionId, payload);
        setAccountProfile(nextAccountProfile);
        setProfile(saveProfile({ ...profile, ...payload, ...nextAccountProfile }));
      } else {
        setProfile(saveProfile({ ...profile, ...payload }));
      }

      addToast('Profile saved');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleFeedbackSubmit(payload) {
    try {
      await createFeedback(payload, authToken, profile?.sessionId || getFeedbackSessionId());
      addToast('Feedback sent. Thank you for shaping the launch.');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Feedback could not be sent.', 'error');
      throw error;
    }
  }

  async function handleOnboardingComplete(version) {
    if (!profile?.userId || !authToken) {
      return;
    }

    const settings = {
      ...(accountProfile?.settings || {}),
      onboardingVersion: version,
      onboardingCompletedAt: new Date().toISOString(),
      notificationPreferences,
    };

    try {
      const payload = {
        displayName: accountProfile?.displayName || profile.displayName,
        avatar: accountProfile?.avatar || profile.avatar,
        handle: accountProfile?.handle || profile.handle || '',
        status: accountProfile?.status || profile.status || '',
        photoMode: profile.photoMode,
        photoURL: profile.photoMode === 'google' ? profile.googlePhotoURL || profile.photoURL || '' : '',
        profileRingId: accountProfile?.profileRingId || profile.profileRingId || '',
        badgeIds: accountProfile?.badgeIds || profile.badgeIds || [],
        settings,
      };
      const { profile: nextAccountProfile } = await updateMyProfile(authToken, profile.sessionId, payload);
      setAccountProfile(nextAccountProfile);
    } catch {
      // The onboarding coach already stored a local fallback completion marker.
    }
  }

  function emitQuiet(event, payload) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit(event, payload);
  }

  function emitWithNotice(event, payload, options = {}) {
    setNotice('');

    if (!pwaState.online) {
      const message = 'You are offline. Reconnect before using live room actions.';
      setNotice(message);
      addToast(message, 'error');
      return;
    }

    if (!socketRef.current?.connected) {
      const message = 'Socket is reconnecting. Try again in a moment.';
      setNotice(message);
      addToast(message, 'error');
      return;
    }

    socketRef.current.emit(event, payload, (response) => {
      if (!response?.ok && response?.error) {
        setNotice(response.error);
        addToast(response.error, 'error');
        return;
      }

      if (options.success) {
        addToast(options.success);
      }

      options.onSuccess?.(response);
    });
  }

  let screen = null;

  if (launchStatus.maintenanceMode && !['admin', 'status', 'contact', 'safety'].includes(view)) {
    screen = <MaintenancePage onNavigate={navigateView} />;
  } else if (LEGAL_VIEWS.has(view)) {
    screen = <LaunchPage pageKey={view} onNavigate={navigateView} onFeedback={() => setFeedbackOpen(true)} />;
  } else if (view === 'updates') {
    screen = <UpdatesPage onNavigate={navigateView} onFeedback={() => setFeedbackOpen(true)} />;
  } else if (view === 'status') {
    screen = <StatusPage onNavigate={navigateView} />;
  } else if (view === 'admin') {
    screen = (
      <AdminPanel
        authToken={authToken}
        sessionId={profile?.sessionId}
        onBack={() => { window.history.replaceState(null, '', '/'); setView('landing'); }}
        onToast={addToast}
      />
    );
  } else if (view === 'landing') {
    screen = (
      <LandingPage
        onStart={() => requireProfile('explore')}
        onExplore={() => requireProfile('explore')}
        onNavigate={navigateView}
        onFeedback={() => setFeedbackOpen(true)}
        onCreatePrivate={() => {
          setCreateDefaultType('private');
          requireProfile('create', 'create');
        }}
      />
    );
  } else if (view === 'guest') {
    screen = (
      <GuestEntry
        onComplete={handleProfileComplete}
        onGoogleSignIn={handleGoogleSignIn}
        googleEnabled={isFirebaseAuthConfigured()}
        googleLoading={googleLoading}
        guestEnabled={launchStatus.guestChatEnabled !== false}
        signupsEnabled={launchStatus.signupsEnabled !== false}
      />
    );
  } else if (view === 'pricing') {
    screen = (
      <PricingPage
        billingStatus={billingStatus}
        billingSummary={billingSummary}
        isLoggedIn={isLoggedIn}
        busyProductId={busyProductId}
        onBuy={handleBuyProduct}
        onLogin={handleLoginToBuy}
        onBack={() => setView(profile ? 'explore' : 'landing')}
      />
    );
  } else if (view === 'billing') {
    screen = (
      <BillingPage
        billingStatus={billingStatus}
        billingSummary={billingSummary}
        isLoggedIn={isLoggedIn}
        loading={billingLoading}
        busyProductId={busyProductId}
        onRefresh={refreshBillingSummary}
        onBuy={handleBuyProduct}
        onLogin={handleLoginToBuy}
        onBack={() => setView(profile ? 'explore' : 'landing')}
      />
    );
  } else if (view === 'store' && launchStatus.storeEnabled === false) {
    screen = (
      <UnavailablePage
        title="Store is paused for this launch mode."
        body="Pricing stays readable while room cosmetics and purchase entry are held until MH Horizon enables the store."
        onNavigate={navigateView}
      />
    );
  } else if (view === 'store') {
    screen = (
      <StorePage
        billingStatus={billingStatus}
        billingSummary={billingSummary}
        profile={profile}
        room={roomState?.room}
        isRoomOwner={Boolean(roomState?.currentUser?.isOwner || roomState?.room?.ownerSessionId === profile?.sessionId)}
        isLoggedIn={isLoggedIn}
        busyProductId={busyProductId}
        onBuy={handleBuyProduct}
        onApplyRoomTheme={handleApplyRoomTheme}
        onApplyProfileCosmetic={handleApplyProfileCosmetic}
        onLogin={handleLoginToBuy}
        onBack={() => setView(roomState?.room ? 'room' : profile ? 'explore' : 'landing')}
      />
    );
  } else if (COMMUNITY_VIEWS.has(view) && launchStatus.communitiesEnabled === false) {
    screen = (
      <UnavailablePage
        title="Communities are warming up."
        body="Standalone Nexus rooms remain available while lightweight communities and event rooms are held by launch mode."
        onNavigate={navigateView}
      />
    );
  } else if (view === 'communities') {
    screen = (
      <DiscoverCommunities
        communities={communities}
        loading={communitiesLoading}
        isLoggedIn={isLoggedIn}
        onBack={() => setView('explore')}
        onCreate={() => setView('create-community')}
        onOpen={openCommunity}
        onLogin={() => handleDirectLogin('communities')}
      />
    );
  } else if (view === 'create-community') {
    screen = (
      <CreateCommunity
        billingSummary={billingSummary}
        onSubmit={handleCreateCommunity}
        onBack={() => setView('communities')}
      />
    );
  } else if (view === 'community-home') {
    screen = (
      <CommunityHome
        details={communityDetails}
        isLoggedIn={isLoggedIn}
        onBack={() => setView('communities')}
        onJoin={handleJoinCommunity}
        onLeave={handleLeaveCommunity}
        onFavorite={handleFavoriteCommunity}
        onCreateRoom={() => {
          setCreateCommunityMode(true);
          setCreateDefaultType('public');
          setView('create');
        }}
        onCreateEvent={() => setView('event-editor')}
        onScheduleAnnouncement={() => setView('announcement-manager')}
        onOpenRoom={(room) => handleJoinRoom({ roomId: room.roomId })}
        onOpenEvent={openEvent}
        onSettings={() => setView('community-settings')}
        onReport={openCommunityReport}
      />
    );
  } else if (view === 'community-settings') {
    screen = (
      <CommunitySettings
        details={communityDetails}
        onBack={() => setView('community-home')}
        onSave={handleCommunitySettingsSave}
        onRoleChange={handleCommunityRoleChange}
        onBanMember={handleCommunityBan}
      />
    );
  } else if (view === 'event-editor') {
    screen = (
      <EventEditor
        community={communityDetails?.community}
        onBack={() => setView(communityDetails?.community ? 'community-home' : 'communities')}
        onSubmit={handleCreateEvent}
      />
    );
  } else if (view === 'event-lobby') {
    screen = (
      <EventLobby
        event={activeEvent}
        isLoggedIn={isLoggedIn}
        onBack={() => setView(communityDetails?.community ? 'community-home' : 'communities')}
        onJoinRoom={() => activeEvent?.roomId && handleJoinRoom({ roomId: activeEvent.roomId })}
        onRsvp={handleEventRsvp}
        onLogin={() => handleDirectLogin('event-lobby')}
      />
    );
  } else if (view === 'announcement-manager') {
    screen = (
      <ScheduledAnnouncementManager
        communities={communityDetails?.community ? [communityDetails.community] : communities}
        rooms={myRooms}
        onBack={() => setView(communityDetails?.community ? 'community-home' : 'my-rooms')}
        onSubmit={handleScheduleAnnouncement}
      />
    );
  } else if (view === 'create') {
    screen = (
      <CreateRoom
        defaultType={createDefaultType}
        billingSummary={billingSummary}
        onCreate={createCommunityMode ? handleCreateCommunityRoom : handleCreateRoom}
        onBack={() => {
          setCreateCommunityMode(false);
          setView(createCommunityMode && communityDetails?.community ? 'community-home' : 'explore');
        }}
      />
    );
  } else if (view === 'explore') {
    screen = (
      <ExploreRooms
        rooms={rooms}
        loading={roomsLoading}
        favoriteRoomIds={favoriteRoomIds}
        roomRelationships={myRooms}
        onJoin={handleJoinRoom}
        onToggleFavorite={handleToggleFavorite}
        onCreate={(type) => {
          setCreateCommunityMode(false);
          setCreateDefaultType(type);
          setView('create');
        }}
        onBack={() => setView('landing')}
      />
    );
  } else if (view === 'my-rooms') {
    screen = (
      <MyRooms
        rooms={myRooms}
        loading={myRoomsLoading}
        isLoggedIn={isLoggedIn}
        onJoin={handleJoinRoom}
        onToggleFavorite={handleToggleFavorite}
        onBack={() => setView('explore')}
      />
    );
  } else if (view === 'profile') {
    screen = (
      <ProfilePage
        profile={profile}
        accountProfile={accountProfile}
        saving={profileSaving}
        isLoggedIn={isLoggedIn}
        billingSummary={billingSummary}
        blockedUsers={profile?.userId && authToken ? blockedProfiles : blockedUsers}
        notificationPreferences={notificationPreferences}
        pwaState={pwaState}
        pushState={pushState}
        pwaStatus={pwaStatus}
        onInstallApp={handleInstallApp}
        onDismissInstall={handleDismissInstall}
        onEnablePush={handleEnablePush}
        onDisablePush={handleDisablePush}
        onNotificationPreferences={handleNotificationPreferences}
        onLogin={() => handleDirectLogin('profile')}
        onLogout={requestLogout}
        onFeedback={() => setFeedbackOpen(true)}
        onSave={handleProfileSave}
        onUnblock={handleUnblockUser}
        onBack={() => setView(roomState?.room ? 'room' : 'explore')}
      />
    );
  } else if (view === 'room') {
    screen = (
      <ChatRoom
        state={roomState}
        profile={profile}
        connectionState={connectionState}
        error={notice}
        onSend={handleSend}
        onLeave={handleLeave}
        onRename={(title) =>
          emitWithNotice('room:rename', { roomId: roomState.room.roomId, title }, { success: 'Room renamed' })
        }
        onLock={(isLocked) =>
          emitWithNotice(
            'room:lock',
            { roomId: roomState.room.roomId, isLocked },
            { success: isLocked ? 'Room locked' : 'Room unlocked' },
          )
        }
        onDelete={handleDeleteRoom}
        onReact={handleReact}
        onDeleteMessage={handleDeleteMessage}
        onReport={handleReport}
        onMuteUser={handleMuteUser}
        onUnmuteUser={handleUnmuteUser}
        onKickUser={handleKickUser}
        onBanUser={handleBanUser}
        onUnbanUser={handleUnbanUser}
        onSetRole={handleSetRole}
        onSaveRules={handleSaveRules}
        onCreateAnnouncement={(payload) =>
          emitWithNotice(
            'room:announcement:create',
            { roomId: roomState.room.roomId, ...payload },
            { success: 'Announcement posted' },
          )
        }
        onUpdateRoomNotifications={(payload) => handleRoomNotificationState(roomState.room.roomId, payload)}
        onClearRecentMessages={handleClearRecentMessages}
        onCategoryToolAction={handleCategoryToolAction}
        onSendCardMessage={handleSendCardMessage}
        billingSummary={billingSummary}
        onApplyRoomTheme={handleApplyRoomTheme}
        onOpenStore={() => setView('store')}
        isFavorite={favoriteRoomIds.includes(roomState.room.roomId)}
        onToggleFavorite={handleToggleFavorite}
        onLoadProfile={fetchPublicProfile}
        blockedUsers={blockedUsers}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        onToast={addToast}
      />
    );
  } else {
    screen = (
      <main className="form-page">
        <div className="empty-state">
          <h1>{joiningLink ? 'Joining room...' : 'Preparing Nexus Chat...'}</h1>
          <p>{notice || 'Connecting to the room link.'}</p>
          {notice && (
            <button className="button button--primary" type="button" onClick={() => setView('explore')}>
              Explore Rooms
            </button>
          )}
        </div>
      </main>
    );
  }

  const headerNavGroups = [
    {
      id: 'main',
      label: 'Main',
      icon: 'home',
      active: ['landing', 'explore', 'communities', 'create', 'room', 'community-home', 'community-settings'].includes(view),
      items: [
        { id: 'landing', label: 'Home', description: 'Nexus launch overview', icon: 'home', active: view === 'landing', action: navigateHome },
        { id: 'explore', label: 'Explore Rooms', description: 'Find public rooms and live chats', icon: 'rooms', active: view === 'explore', action: navigateExplore },
        ...(launchStatus.communitiesEnabled !== false
          ? [
              {
                id: 'communities',
                label: 'Communities',
                description: 'Discover MH Horizon circles',
                icon: 'badge',
                active: ['communities', 'community-home', 'community-settings'].includes(view),
                action: () => navigateView('communities'),
              },
            ]
          : []),
        { id: 'create', label: 'Create Room', description: 'Start public, private, or temp chat', icon: 'sparkle', active: view === 'create', action: navigateCreate },
        ...(roomState?.room
          ? [
              {
                id: 'room',
                label: 'Active Chat',
                description: roomState.room.title,
                icon: 'bell',
                active: view === 'room',
                action: () => navigateView('room'),
              },
            ]
          : []),
      ],
    },
    {
      id: 'account',
      label: 'Account',
      icon: 'user',
      active: ['my-rooms', 'profile'].includes(view),
      items: [
        {
          id: 'my-rooms',
          label: 'My Rooms',
          description: 'Created, joined, favorites, recent',
          icon: 'book',
          active: view === 'my-rooms',
          action: () => navigateView(profile ? 'my-rooms' : 'guest'),
        },
        {
          id: 'profile',
          label: 'Profile',
          description: profile ? profile.displayName : 'Choose your Nexus identity',
          icon: 'user',
          active: view === 'profile',
          action: () => navigateView(profile ? 'profile' : 'guest'),
        },
      ],
    },
    {
      id: 'premium',
      label: 'Premium',
      icon: 'pricing',
      active: ['pricing', 'store', 'billing'].includes(view),
      items: [
        { id: 'pricing', label: 'Pricing', description: 'Free, Plus, Pro, Community', icon: 'pricing', active: view === 'pricing', action: () => navigateView('pricing') },
        ...(launchStatus.storeEnabled !== false
          ? [
              {
                id: 'store',
                label: 'Store',
                description: 'Themes, rings, badges, cosmetics',
                icon: 'store',
                active: view === 'store',
                action: () => navigateView('store'),
              },
            ]
          : []),
        {
          id: 'billing',
          label: 'Billing',
          description: isLoggedIn ? 'Entitlements and purchases' : 'Login required for purchases',
          icon: 'shield',
          active: view === 'billing',
          action: () => navigateView(profile ? 'billing' : 'pricing'),
        },
      ],
    },
    {
      id: 'ops',
      label: 'Ops',
      icon: 'shield',
      active: ['status', 'admin', 'safety'].includes(view),
      items: [
        { id: 'status', label: 'System Status', description: 'Safe public readiness signals', icon: 'shield', active: view === 'status', action: () => navigateView('status') },
        { id: 'admin', label: 'Admin Ops', description: 'Safety, billing, jobs, analytics', icon: 'badge', active: view === 'admin', action: () => navigateView('admin') },
        { id: 'safety', label: 'Safety Center', description: 'Warnings, reports, safety rules', icon: 'help', active: view === 'safety', action: () => navigateView('safety') },
        {
          id: 'feedback',
          label: 'Feedback',
          description: 'Bugs, billing, safety, ideas',
          icon: 'sparkle',
          active: false,
          action: () => {
            setOpenNavMenu('');
            setSidePanelOpen(false);
            setFeedbackOpen(true);
          },
        },
      ],
    },
    {
      id: 'pages',
      label: 'Pages',
      icon: 'book',
      active: ['privacy', 'terms', 'refund-policy', 'contact', 'updates'].includes(view),
      items: [
        { id: 'privacy', label: 'Privacy', description: 'Data and localStorage draft', icon: 'shield', active: view === 'privacy', action: () => navigateView('privacy') },
        { id: 'terms', label: 'Terms', description: 'Use rules placeholder', icon: 'book', active: view === 'terms', action: () => navigateView('terms') },
        { id: 'refund-policy', label: 'Refund Policy', description: 'Billing support placeholder', icon: 'pricing', active: view === 'refund-policy', action: () => navigateView('refund-policy') },
        { id: 'contact', label: 'Contact', description: 'MH Horizon support', icon: 'help', active: view === 'contact', action: () => navigateView('contact') },
        { id: 'updates', label: 'Updates', description: 'Launch notes and limits', icon: 'download', active: view === 'updates', action: () => navigateView('updates') },
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className={`${appClass} ambient-shell`}>
      <nav className="topbar mx-auto mt-3 flex w-[calc(100%_-_1.5rem)] max-w-[1540px] items-center gap-3 rounded-[2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3 shadow-[var(--shadow)] backdrop-blur-2xl sm:mt-4 sm:w-[calc(100%_-_2rem)] sm:px-4" aria-label="Nexus Chat navigation">
        <div className="topbar__aura" aria-hidden="true" />
        <button className="brand" type="button" onClick={navigateHome}>
          <span className="brand__mark brand__mark--image">
            <img src={nexusLogoUrl} alt="" />
          </span>
          <span className="brand__copy">
            <strong>Nexus Chat</strong>
            <em>MH Horizon</em>
          </span>
        </button>
        <div className="topbar-dropdowns topbar-nav-groups" aria-label="Nexus navigation groups">
          {headerNavGroups.map((group) => (
            <HeaderNavDropdown
              group={group}
              key={group.id}
              open={openNavMenu === group.id}
              onOpen={() => setOpenNavMenu(group.id)}
              onClose={() => setOpenNavMenu((current) => (current === group.id ? '' : current))}
            />
          ))}
        </div>
        <div className="topbar__quick-actions ml-auto flex items-center gap-2">
          {!isLoggedIn && isFirebaseAuthConfigured() && launchStatus.signupsEnabled !== false && (
            <button className="account-button account-button--login rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-4 py-3 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5" type="button" onClick={() => handleDirectLogin('profile')}>
              <span className="account-button__icon">
                <Icon name="login" size={19} />
              </span>
              <span className="account-button__copy">
                <strong>Login</strong>
                <em>Google account</em>
              </span>
            </button>
          )}
          {profile && (
            <NotificationCenter
              notifications={notifications}
              unreadCount={notificationUnreadCount}
              loading={notificationsLoading}
              isLoggedIn={isLoggedIn}
              onOpen={refreshNotifications}
              onMarkRead={handleNotificationRead}
              onDismiss={handleNotificationDismiss}
              onMarkAllRead={handleNotificationsReadAll}
              onActivate={handleNotificationActivate}
            />
          )}
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
          {profile && (
            <div className="topbar-profile-cluster">
              <button className="account-button topbar-profile rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" type="button" onClick={() => navigateView('profile')}>
                <ProfileAvatar profile={mergeDisplayProfile(accountProfile, profile)} />
                <span className="account-button__copy">
                  <strong>{isLoggedIn ? 'Profile' : mergeDisplayProfile(accountProfile, profile).displayName}</strong>
                  <em>{isLoggedIn ? 'Google profile' : 'Guest profile'}</em>
                </span>
              </button>
              {isLoggedIn && (
                <button className="topbar-logout" type="button" onClick={requestLogout} aria-label="Logout">
                  <Icon name="logout" size={20} />
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
      <div
        className={`side-nav-backdrop ${sidePanelOpen ? 'is-open' : ''}`}
        aria-hidden="true"
        onClick={() => setSidePanelOpen(false)}
      />
      <SidePanelTrigger
        variant={sidePanelTriggerVariant}
        open={sidePanelOpen}
        onClick={() => setSidePanelOpen((current) => !current)}
      />
      <aside className={`floating-side-nav ${sidePanelOpen ? 'is-open' : ''} border border-[var(--line)] bg-[var(--surface-strong)] shadow-[var(--shadow-lg)] backdrop-blur-2xl`} aria-label="Main navigation">
        <div className="floating-side-nav__glow" aria-hidden="true" />
        <div className="floating-side-nav__header">
          <div>
            <p className="eyebrow">Nexus command</p>
            <h2>{getViewLabel(view)}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close navigation panel" onClick={() => setSidePanelOpen(false)}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="side-nav-section">
          <span>Main</span>
          <button className={sideNavClass(view, 'landing')} type="button" onClick={navigateHome}>
            <strong>Home</strong>
            <em>Landing and product overview</em>
          </button>
          <button className={sideNavClass(view, 'explore')} type="button" onClick={navigateExplore}>
            <strong>Explore Rooms</strong>
            <em>Find public rooms and live chats</em>
          </button>
          {launchStatus.communitiesEnabled !== false && (
            <button className={sideNavClass(view, 'communities')} type="button" onClick={() => navigateView('communities')}>
              <strong>Communities</strong>
              <em>Discover small MH Horizon circles</em>
            </button>
          )}
          <button className={sideNavClass(view, 'create')} type="button" onClick={navigateCreate}>
            <strong>Create Room</strong>
            <em>Start a public, private, or temp room</em>
          </button>
          {roomState?.room && (
            <button className={sideNavClass(view, 'room')} type="button" onClick={() => navigateView('room')}>
              <strong>Active Chat</strong>
              <em>{roomState.room.title}</em>
            </button>
          )}
        </div>
        <div className="side-nav-section">
          <span>Account and premium</span>
          <button className={sideNavClass(view, 'my-rooms')} type="button" onClick={() => navigateView(profile ? 'my-rooms' : 'guest')}>
            <strong>My Rooms</strong>
            <em>Created, joined, favorites, and recent rooms</em>
          </button>
          <button className={sideNavClass(view, 'profile')} type="button" onClick={() => navigateView(profile ? 'profile' : 'guest')}>
            <strong>Profile</strong>
            <em>{profile ? profile.displayName : 'Choose your Nexus identity'}</em>
          </button>
          <button className={sideNavClass(view, 'pricing')} type="button" onClick={() => navigateView('pricing')}>
            <strong>Pricing</strong>
            <em>Free, Plus, Pro, and Community plans</em>
          </button>
          {launchStatus.storeEnabled !== false && (
            <button className={sideNavClass(view, 'store')} type="button" onClick={() => navigateView('store')}>
              <strong>Store</strong>
              <em>Room themes, rings, badges, and cosmetics</em>
            </button>
          )}
          <button className={sideNavClass(view, 'billing')} type="button" onClick={() => navigateView(profile ? 'billing' : 'pricing')}>
            <strong>Billing</strong>
            <em>{isLoggedIn ? 'Manage entitlements and purchases' : 'Login required for purchases'}</em>
          </button>
        </div>
        <div className="side-nav-section">
          <span>Launch and operations</span>
          <button className={sideNavClass(view, 'status')} type="button" onClick={() => navigateView('status')}>
            <strong>System Status</strong>
            <em>Safe public readiness signals</em>
          </button>
          <button className={sideNavClass(view, 'admin')} type="button" onClick={() => navigateView('admin')}>
            <strong>Admin Ops</strong>
            <em>Safety, billing, jobs, and analytics</em>
          </button>
          <button className={sideNavClass(view, 'safety')} type="button" onClick={() => navigateView('safety')}>
            <strong>Safety Center</strong>
            <em>Personal info warnings and tools</em>
          </button>
        </div>
        <div className="side-nav-section">
          <span>Launch pages</span>
          <button className={sideNavClass(view, 'privacy')} type="button" onClick={() => navigateView('privacy')}>
            <strong>Privacy</strong>
            <em>Data and localStorage draft</em>
          </button>
          <button className={sideNavClass(view, 'terms')} type="button" onClick={() => navigateView('terms')}>
            <strong>Terms</strong>
            <em>Use rules launch placeholder</em>
          </button>
          <button className={sideNavClass(view, 'refund-policy')} type="button" onClick={() => navigateView('refund-policy')}>
            <strong>Refund Policy</strong>
            <em>Billing support placeholder</em>
          </button>
          <button className={sideNavClass(view, 'contact')} type="button" onClick={() => navigateView('contact')}>
            <strong>Contact</strong>
            <em>MH Horizon support placeholder</em>
          </button>
          <button className={sideNavClass(view, 'updates')} type="button" onClick={() => navigateView('updates')}>
            <strong>Updates</strong>
            <em>Launch notes and known limits</em>
          </button>
          <button className="side-nav-link side-nav-link--feedback" type="button" onClick={() => { setSidePanelOpen(false); setFeedbackOpen(true); }}>
            <strong>Feedback</strong>
            <em>Bugs, safety, billing, and ideas</em>
          </button>
        </div>
        <div className="side-nav-footer">
          {isLoggedIn ? (
            <button className="button button--ghost button--wide account-chip--logout" type="button" onClick={() => { setSidePanelOpen(false); requestLogout(); }}>
              <Icon name="logout" size={18} />
              Logout
            </button>
          ) : isFirebaseAuthConfigured() && launchStatus.signupsEnabled !== false ? (
            <button className="button button--primary button--wide" type="button" onClick={() => { setSidePanelOpen(false); handleDirectLogin('profile'); }}>
              <Icon name="login" size={18} />
              Login with Google
            </button>
          ) : (
            <span>Guest mode active</span>
          )}
        </div>
      </aside>
      {!pwaState.online && (
        <div className="pwa-status-banner pwa-status-banner--offline" role="status">
          <Icon name="wifiOff" size={18} />
          <span>You are offline. Live chat, billing, admin, and room actions resume after reconnecting.</span>
        </div>
      )}
      {pwaState.online && pwaState.lastTransition === 'online' && (
        <div className="pwa-status-banner pwa-status-banner--online" role="status">
          <Icon name="sparkle" size={18} />
          <span>Back online. Nexus Chat is reconnecting your live session.</span>
        </div>
      )}
      {profile && pwaState.installAvailable && !pwaState.installDismissed && !pwaState.installed && (
        <PwaInstallPrompt onInstall={handleInstallApp} onDismiss={handleDismissInstall} />
      )}
      {launchStatusError && <div className="notice launch-status-notice">{launchStatusError}</div>}
      {notice && view !== 'room' && <div className="notice">{notice}</div>}
      {screen}
      <OnboardingCoach
        profile={profile}
        accountProfile={accountProfile}
        isLoggedIn={isLoggedIn}
        onComplete={handleOnboardingComplete}
        onFeedback={() => setFeedbackOpen(true)}
      />
      <ReportModal
        reportTarget={appReportTarget}
        onClose={() => setAppReportTarget(null)}
        onSubmit={handleAppReportSubmit}
      />
      <FeedbackModal
        open={feedbackOpen}
        profile={mergeDisplayProfile(accountProfile, profile)}
        page={view}
        roomId={roomState?.room?.roomId || ''}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
      <ConfirmDialog
        confirmation={confirmation}
        onCancel={cancelConfirmation}
        onConfirm={confirmCurrentAction}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function getInviteCodeFromPath() {
  const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)$/);
  return match?.[1]?.toUpperCase() || '';
}

function resolveSidePanelTriggerVariant() {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDE_PANEL_TRIGGER_VARIANT;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('sideTrigger') || params.get('navTrigger');
  window.localStorage.removeItem(LEGACY_SIDE_PANEL_TRIGGER_STORAGE_KEY);
  const requested = fromQuery || DEFAULT_SIDE_PANEL_TRIGGER_VARIANT;
  const safeVariant = SIDE_PANEL_TRIGGER_VARIANTS.includes(requested) ? requested : DEFAULT_SIDE_PANEL_TRIGGER_VARIANT;

  if (fromQuery && safeVariant === fromQuery) {
    window.localStorage.setItem(SIDE_PANEL_TRIGGER_STORAGE_KEY, safeVariant);
  }

  return safeVariant;
}

function HeaderNavDropdown({ group, open, onOpen, onClose }) {
  return (
    <div
      className={`topbar-dropdown ${open ? 'is-open' : ''}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        className={cn(`topbar-nav-item topbar-dropdown__trigger ${group.active || open ? 'is-active' : ''}`)}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? onClose() : onOpen())}
        onFocus={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <span className="topbar-dropdown__trigger-icon" aria-hidden="true">
          <Icon name={group.icon || 'sparkle'} size={17} />
        </span>
        <strong>{group.label}</strong>
        <Icon name="chevronDown" size={15} />
      </button>
      {open && (
        <div className="topbar-dropdown__stage" role="menu" aria-label={`${group.label} navigation`}>
          <div className="nav-dropdown-panel topbar-dropdown__panel">
            <span className="topbar-dropdown__beam" aria-hidden="true" />
            {group.items.map((item, index) => (
              <button
                className={`nav-dropdown-link topbar-dropdown__link ${item.active ? 'is-active' : ''}`}
                key={item.id}
                type="button"
                role="menuitem"
                style={{ animationDelay: `${index * 42}ms` }}
                onClick={() => {
                  item.action();
                  onClose();
                }}
              >
                <span className="topbar-dropdown__icon" aria-hidden="true">
                  <Icon name={item.icon} size={19} />
                </span>
                <span className="topbar-dropdown__copy">
                  <strong>{item.label}</strong>
                  <em>{item.description}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PwaInstallPrompt({ onInstall, onDismiss }) {
  return (
    <aside className="pwa-install-card" role="dialog" aria-label="Install Nexus Chat">
      <span className="pwa-install-card__icon" aria-hidden="true">
        <Icon name="download" size={20} />
      </span>
      <div>
        <strong>Install Nexus Chat</strong>
        <p>Open rooms faster with a mobile-friendly app shell and cleaner reconnects.</p>
      </div>
      <div className="pwa-install-card__actions">
        <button className="button button--soft button--small" type="button" onClick={onInstall}>
          Install
        </button>
        <button className="icon-button" type="button" onClick={onDismiss} aria-label="Dismiss install prompt">
          <Icon name="close" size={17} />
        </button>
      </div>
    </aside>
  );
}

function ProfileAvatar({ profile }) {
  const photoURL = profile?.photoURL || '';

  return (
    <span className="account-avatar" aria-hidden="true">
      {photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={21} />}
    </span>
  );
}

function mergeDisplayProfile(accountProfile, localProfile) {
  return {
    ...(localProfile || {}),
    ...(accountProfile || {}),
    photoURL: accountProfile?.photoURL || localProfile?.photoURL || '',
    googlePhotoURL: localProfile?.googlePhotoURL || accountProfile?.photoURL || localProfile?.photoURL || '',
    photoMode: localProfile?.photoMode || accountProfile?.photoMode || 'avatar',
    email: accountProfile?.email || localProfile?.email || '',
  };
}

function getViewFromPath(pathname) {
  const cleanPath = String(pathname || '/').replace(/\/+$/, '') || '/';
  const match = Object.entries(VIEW_PATHS).find(([, path]) => path === cleanPath);
  return match?.[0] || '';
}

function pushViewPath(view) {
  const path = VIEW_PATHS[view] || '/';

  if (window.location.pathname !== path) {
    window.history.pushState({ view }, '', path);
  }
}

function getFeedbackSessionId() {
  const key = 'nexusChat.feedbackSession.v10';
  const current = localStorage.getItem(key);

  if (current) {
    return current;
  }

  const entropy =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID().replace(/-/g, '').slice(0, 28)
      : String(Date.now());
  const next = `feedback_${entropy}`;
  localStorage.setItem(key, next);
  return next;
}

function navClass(currentView, targetView) {
  return `profile-chip nav-chip ${currentView === targetView ? 'is-active' : ''}`;
}

function sideNavClass(currentView, targetView) {
  return `side-nav-link ${currentView === targetView ? 'is-active' : ''}`;
}

function getViewLabel(view) {
  const labels = {
    landing: 'Home',
    explore: 'Explore Rooms',
    communities: 'Communities',
    'create-community': 'Create Community',
    'community-home': 'Community Home',
    'community-settings': 'Community Settings',
    create: 'Create Room',
    room: 'Active Chat',
    pricing: 'Pricing',
    store: 'Store',
    billing: 'Billing',
    'my-rooms': 'My Rooms',
    profile: 'Profile',
    admin: 'Admin',
    status: 'System Status',
    privacy: 'Privacy',
    terms: 'Terms',
    'refund-policy': 'Refund Policy',
    safety: 'Safety',
    contact: 'Contact',
    updates: 'Updates',
  };

  return labels[view] || 'Nexus Chat';
}

function mergeSocketProfile(currentProfile, serverProfile, authToken) {
  const shouldPreserveAccount =
    authToken &&
    currentProfile?.userId &&
    (!serverProfile?.userId || serverProfile.userId === currentProfile.userId);

  const mergedProfile = shouldPreserveAccount
    ? {
        ...serverProfile,
        ...currentProfile,
        sessionId: serverProfile?.sessionId || currentProfile.sessionId,
        displayName: currentProfile.displayName || serverProfile?.displayName,
        avatar: currentProfile.avatar || serverProfile?.avatar,
        photoURL: currentProfile.photoURL || serverProfile?.photoURL || '',
        googlePhotoURL: currentProfile.googlePhotoURL || currentProfile.photoURL || serverProfile?.photoURL || '',
        photoMode: currentProfile.photoMode || serverProfile?.photoMode || 'avatar',
        email: currentProfile.email || serverProfile?.email || '',
        authProvider: 'google',
      }
    : authToken && serverProfile?.userId
      ? {
          ...currentProfile,
          ...serverProfile,
          authProvider: 'google',
        }
      : {
          ...currentProfile,
          ...serverProfile,
          userId: null,
          authProvider: null,
          profileRingId: '',
          badgeIds: [],
          photoMode: 'avatar',
          photoURL: '',
          googlePhotoURL: '',
          email: '',
        };

  return saveProfile(mergedProfile);
}
