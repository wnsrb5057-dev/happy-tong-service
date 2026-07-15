function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function getSafeNavigator() {
  return typeof navigator !== "undefined" ? navigator : null;
}

function getUserAgent() {
  const nav = getSafeNavigator();
  return nav?.userAgent || "";
}

function matchDisplayMode(mode) {
  const win = getSafeWindow();
  if (!win || typeof win.matchMedia !== "function") {
    return false;
  }

  try {
    return win.matchMedia(`(display-mode: ${mode})`).matches;
  } catch (_error) {
    return false;
  }
}

function buildRoleMessage(role, state) {
  if (state === "unsupported") {
    return "현재 브라우저에서는 알림 기능을 바로 사용할 수 없습니다.";
  }

  if (state === "subscription_error") {
    return "알림 연결 상태를 확인하는 중 문제가 발생했습니다.";
  }

  if (role === "checker") {
    if (state === "installable" || state === "browser_only") {
      return "체커 업무를 위해 홈 화면 설치와 알림 설정을 권장합니다.";
    }
    if (state === "installed_permission_default" || state === "installed_no_permission") {
      return "오늘 확인 기록 리마인드를 받으려면 알림 허용이 필요합니다.";
    }
    if (state === "installed_permission_denied") {
      return "알림이 차단되어 있어 미작성 기록 리마인드를 받을 수 없습니다.";
    }
    if (state === "subscription_missing") {
      return "알림 권한은 허용되었지만 기기 알림 연결이 아직 완료되지 않았습니다.";
    }
    if (state === "subscribed" || state === "installed_permission_granted") {
      return "오늘 확인 일정과 미작성 기록 알림을 받을 준비가 된 상태입니다.";
    }
  }

  if (role === "admin") {
    if (state === "installable" || state === "browser_only") {
      return "새 이상징후 접수 알림을 빠르게 확인하려면 설치와 알림 설정을 권장합니다.";
    }
    if (state === "installed_permission_default" || state === "installed_no_permission") {
      return "새 이상징후 접수 알림을 받으려면 알림 허용이 필요합니다.";
    }
    if (state === "installed_permission_denied") {
      return "알림이 차단되어 있어 새 이상징후 접수 알림을 받을 수 없습니다.";
    }
    if (state === "subscription_missing") {
      return "알림 권한은 허용되었지만 기기 알림 연결이 아직 완료되지 않았습니다.";
    }
    if (state === "subscribed" || state === "installed_permission_granted") {
      return "새 이상징후 접수 알림을 받을 준비가 된 상태입니다.";
    }
  }

  if (role === "super_admin") {
    return "총관리자 알림 기능은 이후 단계에서 별도로 검토할 예정입니다.";
  }

  if (state === "installable" || state === "browser_only") {
    return "홈 화면 설치와 알림 허용 상태를 먼저 확인해 주세요.";
  }
  if (state === "installed_permission_denied") {
    return "알림 권한이 차단되어 있습니다.";
  }
  if (state === "subscription_missing") {
    return "알림 연결이 아직 완료되지 않았습니다.";
  }
  if (state === "subscribed" || state === "installed_permission_granted") {
    return "알림을 받을 준비가 된 상태입니다.";
  }

  return "PWA 설치 및 알림 상태를 확인해 주세요.";
}

export function detectPwaDisplayMode() {
  const nav = getSafeNavigator();
  const standaloneByMedia = matchDisplayMode("standalone");
  const standaloneByNavigator = nav?.standalone === true;
  const isStandalone = standaloneByMedia || standaloneByNavigator;

  return {
    isStandalone,
    displayMode: isStandalone ? "standalone" : nav || getSafeWindow() ? "browser" : "unknown",
  };
}

export function detectDevicePlatform() {
  const nav = getSafeNavigator();
  const userAgent = getUserAgent();
  const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
  const ua = userAgent.toLowerCase();

  const isAndroid = /android/.test(ua);
  const isIPhone = /iphone/.test(ua);
  const isIPad = /ipad/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1);
  const isIOS = isIPhone || isIPad;
  const isMobile = isAndroid || isIOS || /mobile/.test(ua);
  const isChrome = /chrome|crios/.test(ua) && !/edg|opr|opera|samsungbrowser/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|android|edg|opr|opera/.test(ua);

  return {
    isIOS,
    isAndroid,
    isMobile,
    isChrome,
    isSafari,
    userAgent,
  };
}

export function detectNotificationPermission() {
  const win = getSafeWindow();
  if (!win || typeof win.Notification === "undefined") {
    return {
      isSupported: false,
      permission: "unsupported",
    };
  }

  const permission = typeof win.Notification.permission === "string"
    ? win.Notification.permission
    : "default";

  if (permission === "granted" || permission === "denied" || permission === "default") {
    return {
      isSupported: true,
      permission,
    };
  }

  return {
    isSupported: true,
    permission: "default",
  };
}

export function normalizeNotificationPermission(permission) {
  if (permission === "granted" || permission === "denied" || permission === "default") {
    return permission;
  }

  return "unsupported";
}

export function detectPushSupport() {
  const win = getSafeWindow();
  const nav = getSafeNavigator();

  const serviceWorkerSupported = Boolean(nav && "serviceWorker" in nav);
  const pushManagerSupported = Boolean(win && "PushManager" in win);
  const notificationSupported = Boolean(win && "Notification" in win);

  return {
    serviceWorkerSupported,
    pushManagerSupported,
    notificationSupported,
    isPushSupported: serviceWorkerSupported && pushManagerSupported && notificationSupported,
  };
}

export async function requestNotificationPermissionSafely() {
  const win = getSafeWindow();
  if (!win || typeof win.Notification === "undefined" || typeof win.Notification.requestPermission !== "function") {
    return {
      isSupported: false,
      permission: "unsupported",
      changed: false,
      error: "Notification API is not supported.",
    };
  }

  const beforePermission = normalizeNotificationPermission(win.Notification.permission);

  if (beforePermission === "granted" || beforePermission === "denied") {
    return {
      isSupported: true,
      permission: beforePermission,
      changed: false,
      error: null,
    };
  }

  try {
    // This helper must only be called from an explicit user click action.
    const requestedPermission = await win.Notification.requestPermission();
    const normalizedPermission = normalizeNotificationPermission(requestedPermission);

    return {
      isSupported: true,
      permission: normalizedPermission,
      changed: beforePermission !== normalizedPermission,
      error: null,
    };
  } catch (error) {
    return {
      isSupported: true,
      permission: beforePermission === "unsupported" ? "default" : beforePermission,
      changed: false,
      error: error instanceof Error ? error.message : "Notification permission request failed.",
    };
  }
}

export function detectInstallPromptSupport() {
  const platform = detectDevicePlatform();
  const displayMode = detectPwaDisplayMode();

  if (displayMode.isStandalone) {
    return {
      maySupportBeforeInstallPrompt: false,
      reason: "이미 설치형 PWA로 실행 중입니다.",
    };
  }

  if (platform.isIOS) {
    return {
      maySupportBeforeInstallPrompt: false,
      reason: "iOS Safari는 일반적으로 수동 설치 안내가 필요합니다.",
    };
  }

  if (platform.isAndroid && platform.isChrome) {
    return {
      maySupportBeforeInstallPrompt: true,
      reason: "Android Chrome 계열은 설치 프롬프트 이벤트 지원 가능성이 높습니다.",
    };
  }

  if (platform.isChrome) {
    return {
      maySupportBeforeInstallPrompt: true,
      reason: "Chromium 계열 브라우저는 환경에 따라 설치 프롬프트를 지원할 수 있습니다.",
    };
  }

  return {
    maySupportBeforeInstallPrompt: false,
    reason: "현재 환경에서는 자동 설치 프롬프트 지원 가능성이 낮습니다.",
  };
}

export async function getCurrentPushSubscription() {
  const pushSupport = detectPushSupport();
  if (!pushSupport.serviceWorkerSupported) {
    return {
      hasSubscription: false,
      subscription: null,
      error: null,
    };
  }

  const nav = getSafeNavigator();
  if (!nav?.serviceWorker) {
    return {
      hasSubscription: false,
      subscription: null,
      error: null,
    };
  }

  try {
    const registration = typeof nav.serviceWorker.getRegistration === "function"
      ? await nav.serviceWorker.getRegistration()
      : null;

    if (!registration) {
      return {
        hasSubscription: false,
        subscription: null,
        error: null,
      };
    }

    if (!registration?.pushManager || typeof registration.pushManager.getSubscription !== "function") {
      return {
        hasSubscription: false,
        subscription: null,
        error: null,
      };
    }

    const subscription = await registration.pushManager.getSubscription();
    return {
      hasSubscription: Boolean(subscription),
      subscription: subscription || null,
      error: null,
    };
  } catch (error) {
    return {
      hasSubscription: false,
      subscription: null,
      error: error instanceof Error ? error.message : "push subscription 확인 중 오류가 발생했습니다.",
    };
  }
}

export async function getPwaOnboardingState(role = null) {
  const platform = detectDevicePlatform();
  const displayMode = detectPwaDisplayMode();
  const permissionState = detectNotificationPermission();
  const pushSupport = detectPushSupport();
  const installPrompt = detectInstallPromptSupport();
  const canUseNotificationFlowInBrowser = !platform.isIOS && !platform.isMobile;

  let subscription = null;
  let state = "browser_only";
  let canUsePush = false;
  let shouldShowInstallGuide = false;
  let shouldShowNotificationGuide = false;

  if (!pushSupport.serviceWorkerSupported || !pushSupport.notificationSupported) {
    state = "unsupported";
  } else if (!displayMode.isStandalone && !canUseNotificationFlowInBrowser) {
    if (installPrompt.maySupportBeforeInstallPrompt || platform.isIOS) {
      state = "installable";
      shouldShowInstallGuide = true;
    } else {
      state = "browser_only";
      shouldShowInstallGuide = true;
    }
  } else if (!permissionState.isSupported) {
    state = "unsupported";
  } else if (permissionState.permission === "default") {
    state = "installed_permission_default";
    shouldShowNotificationGuide = true;
  } else if (permissionState.permission === "denied") {
    state = "installed_permission_denied";
  } else if (permissionState.permission === "granted") {
    canUsePush = pushSupport.isPushSupported;

    if (!pushSupport.pushManagerSupported) {
      state = "installed_permission_granted";
    } else {
      subscription = await getCurrentPushSubscription();

      if (subscription.error) {
        state = "subscription_error";
      } else if (subscription.hasSubscription) {
        state = "subscribed";
      } else {
        state = "subscription_missing";
        shouldShowNotificationGuide = true;
      }
    }
  } else {
    state = "installed_no_permission";
    shouldShowNotificationGuide = true;
  }

  return {
    state,
    role,
    canUsePush,
    shouldShowInstallGuide,
    shouldShowNotificationGuide,
    isStandalone: displayMode.isStandalone,
    permission: permissionState.permission,
    platform,
    pushSupport,
    subscription,
    message: buildRoleMessage(role, state),
  };
}

export function getNotificationCtaForRole(role, state) {
  if (state === "unsupported") {
    return {
      title: "현재 브라우저에서는 알림 기능을 바로 사용할 수 없습니다.",
      description: "다른 브라우저나 모바일 홈 화면 추가 후 다시 시도해 주세요.",
      primaryActionLabel: null,
      secondaryActionLabel: null,
      tone: "neutral",
    };
  }

  if (state === "installed_permission_denied") {
    return {
      title: "알림 권한이 차단되어 있습니다.",
      description: "브라우저 설정에서 알림 권한을 다시 허용해야 합니다.",
      primaryActionLabel: null,
      secondaryActionLabel: "설정 방법 보기",
      tone: "warning",
    };
  }

  if (role === "checker") {
    if (state === "installable" || state === "browser_only") {
      return {
        title: "해피통서비스를 홈 화면에 추가해 주세요.",
        description: "오늘 확인 일정과 미작성 기록을 놓치지 않도록 알림을 받을 수 있습니다.",
        primaryActionLabel: "앱 설치하기",
        secondaryActionLabel: "나중에 하기",
        tone: "info",
      };
    }

    if (state === "installed_permission_default" || state === "installed_no_permission" || state === "subscription_missing") {
      return {
        title: "알림을 허용해 주세요.",
        description: "오늘 확인 기록을 작성하지 않았을 때 알려드릴 수 있습니다.",
        primaryActionLabel: "알림 허용하기",
        secondaryActionLabel: null,
        tone: "warning",
      };
    }

    if (state === "subscribed" || state === "installed_permission_granted") {
      return {
        title: "알림 수신 준비가 완료되었습니다.",
        description: "오늘 확인 일정과 미작성 기록 알림을 받을 수 있습니다.",
        primaryActionLabel: null,
        secondaryActionLabel: null,
        tone: "success",
      };
    }
  }

  if (role === "admin") {
    if (state === "installable" || state === "browser_only") {
      return {
        title: "이상징후 알림을 더 빠르게 확인할 수 있습니다.",
        description: "해피통서비스를 설치하면 새 이상징후 접수 알림을 더 빠르게 확인할 수 있습니다.",
        primaryActionLabel: "앱 설치하기",
        secondaryActionLabel: null,
        tone: "info",
      };
    }

    if (state === "installed_permission_default" || state === "installed_no_permission" || state === "subscription_missing") {
      return {
        title: "이상징후 알림을 허용해 주세요.",
        description: "새 이상징후가 접수되면 바로 확인할 수 있도록 알림을 받을 수 있습니다.",
        primaryActionLabel: "알림 허용하기",
        secondaryActionLabel: null,
        tone: "warning",
      };
    }

    if (state === "subscribed" || state === "installed_permission_granted") {
      return {
        title: "이상징후 알림 수신 준비가 완료되었습니다.",
        description: "새 이상징후 접수 알림을 받을 수 있습니다.",
        primaryActionLabel: null,
        secondaryActionLabel: null,
        tone: "success",
      };
    }
  }

  if (role === "super_admin") {
    return {
      title: "알림 기능은 관리자와 체커 중심으로 준비 중입니다.",
      description: "총관리자 알림은 이후 운영 요약 기능과 함께 검토할 예정입니다.",
      primaryActionLabel: null,
      secondaryActionLabel: null,
      tone: "neutral",
    };
  }

  return {
    title: "PWA 설치 및 알림 상태를 확인해 주세요.",
    description: "현재 기기와 브라우저 상태에 따라 설치 또는 알림 설정이 필요할 수 있습니다.",
    primaryActionLabel: state === "installable" || state === "browser_only" ? "앱 설치하기" : null,
    secondaryActionLabel: state === "installed_permission_default" || state === "installed_no_permission" ? "알림 허용하기" : null,
    tone: "info",
  };
}
