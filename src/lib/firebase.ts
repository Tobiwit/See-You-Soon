"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase web config is *not* secret — it only identifies the project.
 * Access is enforced by Firestore security rules (see firestore.rules).
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

/** Local development only: talk to the Firebase emulators (see README). */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";
let emulatorsConnected = false;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function fb() {
  if (!firebaseConfigured) throw new Error("Firebase is not configured");
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    try {
      auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    } catch {
      auth = getAuth(app);
    }
    try {
      db = initializeFirestore(app, {
        // Offline cache: lets the app open without a connection and queues writes.
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: 150 * 1024 * 1024,
        }),
      });
    } catch {
      db = getFirestore(app);
    }
  }
  if (useEmulators && !emulatorsConnected) {
    emulatorsConnected = true;
    connectAuthEmulator(auth!, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db!, "127.0.0.1", 8080);
  }
  return { app: app!, auth: auth!, db: db! };
}
