// Shared firebase-admin app (single init — calling initializeApp twice throws).
// Credentials are ADC: attached service account on Cloud Run, user login locally.

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

export function adminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCP_PROJECT_ID,
    storageBucket: process.env.GCS_BUCKET,
  });
}
