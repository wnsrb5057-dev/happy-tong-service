function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return {
      supported: false,
      registered: false,
      registration: null,
      error: "Service Worker API is not supported.",
    };
  }

  const canRegister = window.isSecureContext || isLocalhost(window.location.hostname);
  if (!canRegister) {
    return {
      supported: true,
      registered: false,
      registration: null,
      error: "Service worker registration requires a secure context.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js");

    return {
      supported: true,
      registered: true,
      registration,
      error: null,
    };
  } catch (error) {
    return {
      supported: true,
      registered: false,
      registration: null,
      error: error instanceof Error ? error.message : "Service worker registration failed.",
    };
  }
}
