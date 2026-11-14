
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const IDLE_TIMEOUT = 25 * 60 * 1000;
const ACTIVITY_SYNC_INTERVAL = 60 * 1000;
const ACTIVITY_CHECK_INTERVAL = 15 * 1000;
const ACTIVITY_STORAGE_KEY = "erp_last_user_activity";

export default function SessionActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      !pathname ||
      !(pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    ) {
      return;
    }

    let idleTimer = null;
    let activityInterval = null;
    let lastSentAt = 0;
    let isLoggingOut = false;
    let requestInProgress = false;

    // Read the saved activity timestamp.
    const getLastActivity = () => {
      const stored = Number(
        localStorage.getItem(ACTIVITY_STORAGE_KEY)
      );

      return Number.isFinite(stored) && stored > 0
        ? stored
        : 0;
    };

    // Redirect when the server confirms that the session has expired.
    const redirectToLogin = () => {
      if (isLoggingOut) return;

      isLoggingOut = true;

      clearTimeout(idleTimer);
      clearInterval(activityInterval);

      localStorage.removeItem(ACTIVITY_STORAGE_KEY);

      window.location.replace("/login?reason=session_expired");
    };

    // Calculate and schedule the remaining idle time.
    const scheduleIdleLogout = () => {
      clearTimeout(idleTimer);

      if (isLoggingOut) return;

      const lastActivity = getLastActivity();

      if (!lastActivity) {
        redirectToLogin();
        return;
      }

      const elapsed = Date.now() - lastActivity;
      const remaining = IDLE_TIMEOUT - elapsed;

      if (remaining <= 0) {
        redirectToLogin();
        return;
      }

      idleTimer = setTimeout(() => {
        scheduleIdleLogout();
      }, remaining);
    };

    // Renew the database session activity.
    const renewServerActivity = async () => {
      if (isLoggingOut || requestInProgress) return;

      const now = Date.now();
      const lastActivity = getLastActivity();

      // Never renew an idle session.
      if (
        !lastActivity ||
        now - lastActivity >= IDLE_TIMEOUT
      ) {
        scheduleIdleLogout();
        return;
      }

      // Do not send requests more frequently than necessary.
      if (now - lastSentAt < ACTIVITY_SYNC_INTERVAL) {
        return;
      }

      requestInProgress = true;

      try {
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          console.error(
            "Unable to renew session activity:",
            response.status
          );
          return;
        }

        lastSentAt = Date.now();
      } catch (error) {
        console.error(
          "Session activity request failed:",
          error
        );
      } finally {
        requestInProgress = false;
      }
    };

    // Record genuine user interaction.
    const handleActivity = () => {
      if (isLoggingOut) return;

      const now = Date.now();

      localStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        String(now)
      );

      scheduleIdleLogout();
      renewServerActivity();
    };

    // Synchronize activity between browser tabs.
    const handleStorage = (event) => {
      if (event.key === ACTIVITY_STORAGE_KEY) {
        if (event.newValue) {
          scheduleIdleLogout();
          renewServerActivity();
        } else {
          redirectToLogin();
        }
      }

      if (event.key === null) {
        redirectToLogin();
      }
    };

    // Recheck the session when the browser tab becomes active.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleIdleLogout();
        renewServerActivity();
      }
    };

    const handlePageShow = () => {
      scheduleIdleLogout();
      renewServerActivity();
    };

    // Do not reset an existing activity timestamp on refresh.
    // If no timestamp exists, initialize it once.
    if (!getLastActivity()) {
      localStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        String(Date.now())
      );
    }

    scheduleIdleLogout();

    const events = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, {
        passive: true,
      });
    });

    window.addEventListener("storage", handleStorage);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("pageshow", handlePageShow);

    // Check periodically and renew only if recent user activity exists.
    activityInterval = setInterval(() => {
      if (isLoggingOut) return;

      scheduleIdleLogout();
      renewServerActivity();
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(activityInterval);

      events.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          handleActivity
        );
      });

      window.removeEventListener("storage", handleStorage);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname]);

  return null;
}
