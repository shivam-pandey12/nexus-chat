import { io } from 'socket.io-client';

export function createNexusSocket(profile) {
  return io(import.meta.env.VITE_SOCKET_URL || undefined, {
    autoConnect: false,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.35,
    timeout: 12000,
    upgrade: true,
    rememberUpgrade: true,
    auth: {
      profile,
      sessionId: profile?.sessionId || '',
      userId: profile?.userId || '',
    },
  });
}
