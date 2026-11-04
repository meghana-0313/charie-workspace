// Shared identity helpers for both store adapters.

export const OWNER = "owner";

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
