import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;

export const db = app
  ? (() => {
      try {
        return initializeFirestore(app, {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        return getFirestore(app);
      }
    })()
  : null;

export function observeAuth(callback: (user: User | null) => void) {
  if (!auth) {
    queueMicrotask(() => callback(null));
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function login(
  email: string,
  password: string,
  remember: boolean,
) {
  if (!auth) throw new Error("Firebase не настроен");
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  if (auth) await signOut(auth);
}

export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (
    [
      "auth/invalid-credential",
      "auth/invalid-email",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(code)
  )
    return "Неверная почта или пароль";
  if (code === "auth/too-many-requests")
    return "Слишком много попыток. Попробуйте немного позже";
  if (code === "auth/configuration-not-found")
    return "В Firebase ещё не включён вход по Email/Password";
  if (code === "auth/network-request-failed")
    return "Нет соединения с интернетом";
  return error instanceof Error ? error.message : "Не удалось войти";
}

export type { User };
