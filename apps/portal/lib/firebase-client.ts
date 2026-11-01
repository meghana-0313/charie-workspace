// Browser Firebase client: Google sign-in, config from /api/auth/config.
// Client-only module (never imported by server code).

"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

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

/** Google redirect sign-in (fallback when the popup is blocked). */
export async function signInWithGoogleRedirect(): Promise<void> {
  const a = await firebaseApp();
  await signInWithRedirect(getAuth(a), new GoogleAuthProvider());
}

/** After a redirect back: the ID token, or null when no redirect happened. */
export async function completeGoogleRedirect(): Promise<string | null> {
  const a = await firebaseApp();
  const cred = await getRedirectResult(getAuth(a));
  if (!cred) return null;
  return cred.user.getIdToken();
}

/** Email + password sign-in. Resolves with the Firebase ID token. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const a = await firebaseApp();
  const cred = await signInWithEmailAndPassword(getAuth(a), email, password);
  return cred.user.getIdToken();
}

/** Create an email + password account. Resolves with the Firebase ID token. */
export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const a = await firebaseApp();
  const cred = await createUserWithEmailAndPassword(getAuth(a), email, password);
  return cred.user.getIdToken();
}

/** Send the Firebase password-reset email. */
export async function sendReset(email: string): Promise<void> {
  const a = await firebaseApp();
  await sendPasswordResetEmail(getAuth(a), email);
}

export async function signOutGoogle(): Promise<void> {
  if (getApps().length === 0) return;
  await signOut(getAuth(getApp())).catch(() => {});
}
