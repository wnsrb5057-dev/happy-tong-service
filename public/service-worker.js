self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const fallbackPayload = {
    title: "해피통서비스",
    body: "",
    url: "/",
  };

  let payload = fallbackPayload;

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed?.title || fallbackPayload.title,
        body: parsed?.body || fallbackPayload.body,
        url: parsed?.url || fallbackPayload.url,
      };
    } catch (_error) {
      const text = event.data.text();
      payload = {
        title: fallbackPayload.title,
        body: text || fallbackPayload.body,
        url: fallbackPayload.url,
      };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: {
        url: payload.url,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const matchingClient = clientList.find((client) => {
        try {
          return new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname;
        } catch (_error) {
          return false;
        }
      });

      if (matchingClient && typeof matchingClient.focus === "function") {
        return matchingClient.focus();
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
