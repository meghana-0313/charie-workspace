/* Charie web SDK (drop-in): reports client errors to your workspace.
 * Usage:
 *   <script src="https://<portal>/charie.js"
 *     data-portal="https://<portal>" data-key="chp_..."></script>
 * Sends: window errors, unhandled rejections, failed fetches (5xx/network).
 * Batches every 5s, max 20 events per batch. No cookies, no fingerprinting,
 * no PII beyond the URLs and messages your own app already shows.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var portal = (s.getAttribute("data-portal") || "").replace(/\/$/, "");
  var key = s.getAttribute("data-key") || "";
  if (!portal || !key) return;

  var queue = [];
  function push(kind, endpoint, extra) {
    queue.push(Object.assign({
      id: "sdk_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36),
      ts: new Date().toISOString(),
      kind: kind,
      endpoint: String(endpoint || location.pathname).slice(0, 300),
      outcome: "failure",
    }, extra || {}));
    if (queue.length >= 20) flush();
  }
  function flush() {
    if (!queue.length) return;
    var batch = queue.splice(0, 20);
    fetch(portal + "/api/guardian/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-charie-key": key },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(function () {});
  }
  setInterval(flush, 5000);
  addEventListener("pagehide", flush);

  addEventListener("error", function (e) {
    push("api", location.pathname, { actor: "web-sdk" });
  });
  addEventListener("unhandledrejection", function (e) {
    var msg = e.reason && e.reason.message ? e.reason.message : "unhandled rejection";
    push("api", location.pathname, { actor: "web-sdk:" + String(msg).slice(0, 120) });
  });
  if (window.fetch) {
    var raw = window.fetch;
    window.fetch = function (input, init) {
      return raw(input, init).then(function (res) {
        if (res.status >= 500) {
          var url = typeof input === "string" ? input : (input && input.url) || "";
          push("api", url, { bytes: res.status });
        }
        return res;
      }, function (err) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        push("infra", url, { actor: "network-error" });
        throw err;
      });
    };
  }
})();
