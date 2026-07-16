function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function getSafeNavigator() {
  return typeof navigator !== "undefined" ? navigator : null;
}

export function getVapidPublicKey() {
  const key = typeof import.meta !== "undefined" ? import.meta.env?.VITE_VAPID_PUBLIC_KEY || null : null;

  return {
    key,
    exists: Boolean(key),
    error: key ? null : "VITE_VAPID_PUBLIC_KEY is not configured.",
  };
}

export function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== "string") {
    throw new Error("A valid base64 string is required.");
  }

  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const win = getSafeWindow();

  if (!win || typeof win.atob !== "function") {
    throw new Error("Base64 decoding is not supported in this environment.");
  }

  const rawData = win.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export async function getServiceWorkerRegistration() {
  const nav = getSafeNavigator();

  if (!nav || !("serviceWorker" in nav)) {
    return {
      registration: null,
      supported: false,
      error: "Service Worker API is not supported.",
    };
  }

  try {
    if (typeof nav.serviceWorker.getRegistration === "function") {
      const registration = await nav.serviceWorker.getRegistration();

      if (registration) {
        return {
          registration,
          supported: true,
          error: null,
        };
      }
    }

    if (nav.serviceWorker.ready) {
      const registration = await nav.serviceWorker.ready;

      return {
        registration: registration || null,
        supported: true,
        error: registration ? null : "Service worker registration was not found.",
      };
    }

    return {
      registration: null,
      supported: true,
      error: "Service worker registration was not found.",
    };
  } catch (error) {
    return {
      registration: null,
      supported: true,
      error: error instanceof Error ? error.message : "Failed to resolve service worker registration.",
    };
  }
}

export async function getExistingPushSubscription() {
  const win = getSafeWindow();

  if (!win || typeof win.PushManager === "undefined") {
    return {
      hasSubscription: false,
      subscription: null,
      error: "PushManager API is not supported.",
    };
  }

  const registrationResult = await getServiceWorkerRegistration();

  if (!registrationResult.registration) {
    return {
      hasSubscription: false,
      subscription: null,
      error: registrationResult.error,
    };
  }

  try {
    const subscription = await registrationResult.registration.pushManager.getSubscription();

    return {
      hasSubscription: Boolean(subscription),
      subscription: subscription || null,
      error: null,
    };
  } catch (error) {
    return {
      hasSubscription: false,
      subscription: null,
      error: error instanceof Error ? error.message : "Failed to read existing push subscription.",
    };
  }
}

export async function createPushSubscription() {
  const win = getSafeWindow();

  if (!win || typeof win.Notification === "undefined") {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: "Notification API is not supported.",
    };
  }

  if (win.Notification.permission !== "granted") {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: "Notification permission is not granted.",
    };
  }

  if (typeof win.PushManager === "undefined") {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: "PushManager API is not supported.",
    };
  }

  const vapidResult = getVapidPublicKey();
  if (!vapidResult.exists || !vapidResult.key) {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: vapidResult.error,
    };
  }

  const registrationResult = await getServiceWorkerRegistration();
  if (!registrationResult.registration) {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: registrationResult.error,
    };
  }

  const existingResult = await getExistingPushSubscription();
  if (existingResult.subscription) {
    return {
      success: true,
      subscription: existingResult.subscription,
      alreadyExisted: true,
      error: null,
    };
  }

  if (existingResult.error && existingResult.error !== "Service worker registration was not found.") {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: existingResult.error,
    };
  }

  try {
    // This helper must only be called after an explicit user action.
    // A checker/home or notification settings screen can call this later.
    const applicationServerKey = urlBase64ToUint8Array(vapidResult.key);
    const subscription = await registrationResult.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    return {
      success: true,
      subscription,
      alreadyExisted: false,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      subscription: null,
      alreadyExisted: false,
      error: error instanceof Error ? error.message : "Failed to create push subscription.",
    };
  }
}

export function serializePushSubscription(subscription) {
  if (!subscription || typeof subscription.toJSON !== "function") {
    throw new Error("A valid PushSubscription is required.");
  }

  const raw = subscription.toJSON();
  const endpoint = raw?.endpoint || subscription.endpoint || null;
  const p256dh = raw?.keys?.p256dh || null;
  const auth = raw?.keys?.auth || null;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Push subscription is missing required endpoint or key fields.");
  }

  return {
    endpoint,
    p256dh,
    auth,
    raw,
  };
}

export async function createAndSerializePushSubscription() {
  const subscriptionResult = await createPushSubscription();

  if (!subscriptionResult.success || !subscriptionResult.subscription) {
    return {
      success: false,
      subscription: null,
      serialized: null,
      alreadyExisted: subscriptionResult.alreadyExisted,
      error: subscriptionResult.error,
    };
  }

  try {
    const serialized = serializePushSubscription(subscriptionResult.subscription);

    return {
      success: true,
      subscription: subscriptionResult.subscription,
      serialized,
      alreadyExisted: subscriptionResult.alreadyExisted,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      subscription: subscriptionResult.subscription,
      serialized: null,
      alreadyExisted: subscriptionResult.alreadyExisted,
      error: error instanceof Error ? error.message : "Failed to serialize push subscription.",
    };
  }
}
