// Browser Firebase client: Google sign-in, config from /api/auth/config.
// Client-only module (never imported by server code).

"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

export interface WebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

let app: FirebaseApp | null = null;

async function firebaseApp(): Promise<FirebaseApp> {
  if (app) return app;
  const r = await fetch("/api/auth/config", { cache: "no-store" });
  const j = (await r.json()) as { configured: boolean; webConfig?: WebConfig };
  if (!j.configured || !j.webConfig) throw new Error("auth-not-configured");
  app = getApps().length > 0 ? getApp() : initializeApp(j.webConfig);
  return app;
}

/** Google popup sign-in. Resolves with the Firebase ID token. */
export async function signInWithGoogle(): Promise<string> {
  const a = await firebaseApp();
  const cred = await signInWithPopup(getAuth(a), new GoogleAuthProvider());
  return cred.user.getIdToken();
}

export async function signOutGoogle(): Promise<void> {
  if (getApps().length === 0) return;
  await signOut(getAuth(getApp())).catch(() => {});
}
