// Store selector: Firestore in prod (PORTAL_STORE=firestore), JSON files
// locally. Both adapters share one async interface; callers just await.

import { fileStore } from "./store-file";
import { firestoreStore } from "./store-firestore";

export { OWNER, uid } from "./uid";
/** Kept for existing callers - the human author name on messages/approvals. */
export { OWNER as DEMO_USER } from "./uid";

export type Store = typeof fileStore;

function select(): Store {
  if (process.env.PORTAL_STORE === "firestore") return firestoreStore as Store;
  return fileStore;
}

export const store: Store = select();
