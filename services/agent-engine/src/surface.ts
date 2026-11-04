// Passive surface checks: response headers, cookie flags, and DOM accessibility
// signals. Safe by design (no probing, no payloads). Findings built from these
// are always labeled surface checks - never a penetration test.

import type { Page } from "playwright";

const WANTED_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
];

export function checkHeaders(headers: Record<string, string>, isHttps: boolean): { missing: string[]; weakCookies: string[] } {
  const missing = WANTED_HEADERS.filter((h) => !(h in headers));
  // Frame-ancestors in CSP covers X-Frame-Options.
  if (missing.includes("x-frame-options") && (headers["content-security-policy"] ?? "").includes("frame-ancestors")) {
    missing.splice(missing.indexOf("x-frame-options"), 1);
  }
  if (isHttps && !("strict-transport-security" in headers)) missing.push("strict-transport-security");

  const weakCookies: string[] = [];
  const setCookie = headers["set-cookie"];
  if (setCookie) {
    for (const chunk of setCookie.split(/,(?=[^;,]+=)/)) {
      const name = chunk.split(";")[0].split("=")[0].trim();
      const lower = chunk.toLowerCase();
      const lacking: string[] = [];
      if (!lower.includes("samesite")) lacking.push("SameSite");
      if (isHttps && !lower.includes("secure")) lacking.push("Secure");
      if (lacking.length > 0 && name) weakCookies.push(`${name} (missing ${lacking.join(", ")})`);
    }
  }
  return { missing, weakCookies };
}

export async function scanDom(page: Page): Promise<{ unlabeledInputs: number; imagesMissingAlt: number }> {
  return page.evaluate(() => {
    const imagesMissingAlt = [...document.querySelectorAll("img")]
      .filter((i) => !i.hasAttribute("alt")).length;
    const unlabeledInputs = [...document.querySelectorAll("input")].filter((el) => {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(t)) return false;
      if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
      if (el.closest("label")) return false;
      return true;
    }).length;
    return { unlabeledInputs, imagesMissingAlt };
  });
}
