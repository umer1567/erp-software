
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const IDLE_TIMEOUT = 25 * 60 * 1000;
const ACTIVITY_SYNC_INTERVAL = 60 * 1000;
const ACTIVITY_STORAGE_KEY = "erp_last_user_activity";

export default function SessionActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Never track activity on login or other public pages.
    if (
      !pathname ||
      !(pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    ) {
      return;
    }

    let idleTimer = null;
    let lastSentAt = 0;
    let isLoggingOut = false;

    const getLastActivity = () => {
      const stored = Number(
        localStorage.getItem(ACTIVITY_STORAGE_KEY)
      );

      return Number.isFinite(stored) && stored > 0
        ? stored
        : Date.now();
    };

    const logout = async () => {
      if (isLoggingOut) return;

      isLoggingOut = true;
      clearTimeout(idleTimer);

      localStorage.removeItem(ACTIVITY_STORAGE_KEY);

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch (error) {
        console.error("Automatic logout error:", error);
      } finally {
        window.location.replace("/login?reason=session_expired");
      }
    };

    const scheduleIdleLogout = () => {
      clearTimeout(idleTimer);

      const elapsed = Date.now() - getLastActivity();
      const remaining = Math.max(0, IDLE_TIMEOUT - elapsed);

      idleTimer = setTimeout(() => {
        if (Date.now() - getLastActivity() >= IDLE_TIMEOUT) {
          logout();
        } else {
          scheduleIdleLogout();
        }
      }, remaining);
    };

    const renewServerActivity = async () => {
      const now = Date.now();

      if (now - lastSentAt < ACTIVITY_SYNC_INTERVAL) {
        return;
      }

      lastSentAt = now;

      try {
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (response.status === 401) {
          await logout();
        }
      } catch (error) {
        // Network errors do not renew the server-side session.
        console.error("Session activity request failed:", error);
      }
    };

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

    const handleStorage = (event) => {
      if (event.key === ACTIVITY_STORAGE_KEY) {
        scheduleIdleLogout();
      }

      if (event.key === null) {
        scheduleIdleLogout();
      }
    };

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

    return () => {
      clearTimeout(idleTimer);

      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  return null;
}
