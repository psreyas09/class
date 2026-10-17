"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BL6beoPR-UqUenGX5ZkwFG1FliiSuXuIvn4mJf58kqJvLu92bjg90ShWSbbfgi_nR6dpI0koxL0p7CghEeqpMmI";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    ) {
      setSupported(true);
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.pushManager.getSubscription();
        })
        .then((subscription) => {
          setIsSubscribed(!!subscription);
        })
        .catch(() => {
          // Service worker not ready or in private browsing
        });
    }
  }, []);

  async function handleToggle() {
    if (!supported || loading) return;

    setLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }
        setIsSubscribed(false);
      } else {
        // Request permission and subscribe
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm !== "granted") {
          setLoading(false);
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        const subJson = subscription.toJSON();

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          }),
        });

        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("Push subscription toggle error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || permission === "denied"}
      title={
        permission === "denied"
          ? "Notifications blocked in browser settings"
          : isSubscribed
          ? "Task alerts active (Click to turn off)"
          : "Turn on browser & phone task alerts"
      }
      className={`relative w-7 h-7 rounded border flex items-center justify-center transition-colors ${
        isSubscribed
          ? "border-amber-300 dark:border-amber-800 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {permission === "denied" ? (
        <BellOff className="w-3.5 h-3.5 text-zinc-400" />
      ) : isSubscribed ? (
        <>
          <BellRing className="w-3.5 h-3.5" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
        </>
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
