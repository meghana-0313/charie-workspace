// GhostQA service worker: push alerts + offline shell for installed PWA.
self.addEventListener("push", (event) => {
  let data = { title: "GhostQA", body: "Something needs you.", url: "/guardian" };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/guardian";
  event.waitUntil(clients.openWindow(url));
});
