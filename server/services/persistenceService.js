import { createFirestoreRepositories } from '../repositories/firestoreRepositories.js';
import { createNoopRepositories } from '../repositories/noopRepositories.js';

export async function createPersistenceService() {
  if (String(process.env.PERSISTENCE_ENABLED || '').toLowerCase() !== 'true') {
    console.warn('Persistence disabled, using in-memory store.');
    return createMemoryPersistence('disabled');
  }

  try {
    const serviceAccount = readServiceAccount();

    if (!serviceAccount) {
      console.warn('Firebase Admin env is missing. Persistence disabled, using in-memory store.');
      return createMemoryPersistence('firebase-admin-env-missing');
    }

    const [{ cert, getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
    ]);
    const app =
      getApps()[0] ||
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
      });
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });

    // One bounded read keeps startup failure explicit without attaching listeners.
    await db.collection('rooms').limit(1).get();
    console.log('Firebase persistence enabled.');

    return {
      adminApp: app,
      repositories: createFirestoreRepositories(db),
      async verifyIdToken(idToken) {
        return getAuth(app).verifyIdToken(idToken);
      },
      getStatus() {
        return {
          enabled: true,
          provider: 'firestore',
          state: 'connected',
        };
      },
    };
  } catch (error) {
    console.warn(
      `Persistence disabled, using in-memory store. Firebase persistence unavailable: ${
        error instanceof Error ? error.message : 'Firebase init failed.'
      }`,
    );
    return createMemoryPersistence('firebase-init-failed');
  }
}

function createMemoryPersistence(reason) {
  return {
    adminApp: null,
    repositories: createNoopRepositories(),
    async verifyIdToken(idToken) {
      return verifyIdTokenWithRest(idToken);
    },
    getStatus() {
      return {
        enabled: false,
        provider: 'memory',
        state: 'fallback',
        reason,
      };
    },
  };
}

async function verifyIdTokenWithRest(idToken) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;

  if (!apiKey || !idToken) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(data.users) || !data.users[0]?.localId) {
      return null;
    }

    const user = data.users[0];

    return {
      uid: user.localId,
      email: user.email || '',
      name: user.displayName || '',
      displayName: user.displayName || '',
      picture: user.photoUrl || '',
      email_verified: Boolean(user.emailVerified),
      firebase: {
        sign_in_provider: user.providerUserInfo?.[0]?.providerId || 'google.com',
      },
    };
  } catch (error) {
    console.warn(
      `Firebase REST token verification unavailable; continuing without account link. ${
        error instanceof Error ? error.message : 'Token lookup failed.'
      }`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}
