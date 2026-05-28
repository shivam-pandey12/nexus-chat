import { getApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseAuthConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

export function isFirebaseMessagingConfigured() {
  return Boolean(isFirebaseAuthConfigured() && firebaseConfig.messagingSenderId && import.meta.env.VITE_FIREBASE_VAPID_KEY);
}

export function getFirebaseWebConfig() {
  return { ...firebaseConfig };
}

export async function signInWithGoogle() {
  if (!isFirebaseAuthConfigured()) {
    throw new Error('Google sign-in is not configured here yet.');
  }

  const auth = getAuth(getFirebaseApp());
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  const idToken = await credential.user.getIdToken();

  return {
    idToken,
    user: {
      userId: credential.user.uid,
      displayName: credential.user.displayName || '',
      email: credential.user.email || '',
      photoURL: credential.user.photoURL || '',
    },
  };
}

export function subscribeToFirebaseAuth(onChange) {
  if (!isFirebaseAuthConfigured()) {
    onChange(null);
    return () => {};
  }

  return onAuthStateChanged(getAuth(getFirebaseApp()), async (user) => {
    if (!user) {
      onChange(null);
      return;
    }

    onChange({
      idToken: await user.getIdToken(),
      user: {
        userId: user.uid,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
      },
    });
  });
}

export async function signOutFirebase() {
  if (!isFirebaseAuthConfigured()) {
    return;
  }

  await signOut(getAuth(getFirebaseApp()));
}

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
