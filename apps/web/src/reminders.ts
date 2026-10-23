import { useEffect, useState } from "react";
import type { Snapshot } from "../../../packages/core/index";
import {
  pendingReminders,
  reminderText,
} from "../../../packages/core/reminders";

export async function showNotification(
  title: string,
  body: string,
  tag: string,
  itemId?: string,
) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    throw new Error("Notifications are not permitted in this browser.");
  const registration =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined;
  if (registration?.active) {
    await registration.showNotification(title, {
      body,
      tag,
      icon: "/icon.svg",
      data: { itemId },
    });
  } else {
    const notification = new Notification(title, {
      body,
      tag,
      icon: "/icon.svg",
    });
    notification.onclick = () => {
      window.focus();
      if (itemId) window.location.hash = "item/" + encodeURIComponent(itemId);
      notification.close();
    };
  }
}

export function useReminders(email: string, data: Snapshot) {
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    if (!email || !data.preferences.reminders) return;
    let active = true,
      running = false;
    const deliver = async () => {
      if (!active) return;
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        setError(
          "Reminders are enabled in your account, but this browser cannot send them. Check notification permission in Settings.",
        );
        return;
      }
      const sinceKey = `reminder-changes-since:${email}`;
      const stored = localStorage.getItem(sinceKey);
      const since = stored ? Number(stored) : Date.now();
      if (!stored) localStorage.setItem(sinceKey, String(since));
      const now = new Date();
      const candidates = pendingReminders(data, now, since);
      const sent = new Set<string>();
      for (const reminder of candidates) {
        const key = `reminded:${email}:${reminder.key}`;
        if (!active || sent.has(reminder.item.id) || localStorage.getItem(key))
          continue;
        const text = reminderText(reminder, data, now);
        await showNotification(text.title, text.body, key, reminder.item.id);
        // A change alert includes the current deadline, so do not repeat it in the same check.
        for (const candidate of candidates.filter(
          (r) => r.item.id === reminder.item.id,
        ))
          localStorage.setItem(`reminded:${email}:${candidate.key}`, "1");
        sent.add(reminder.item.id);
      }
      if (active) setError("");
    };
    const check = async () => {
      if (running || !active) return;
      running = true;
      try {
        if (navigator.locks) {
          // Queue refreshes behind in-flight checks so a cancelled effect cannot starve delivery.
          await navigator.locks.request(
            `gobbler-reminders:${email}`,
            deliver,
          );
        } else {
          // shortcut: simultaneous tabs can race without Web Locks; add coordination before supporting those browsers.
          await deliver();
        }
      } catch {
        if (active)
          setError(
            "A reminder could not be sent or recorded. Check browser notifications and site storage; Gobbler will retry while open.",
          );
      } finally {
        running = false;
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [
    email,
    data.items,
    data.changes,
    data.courses,
    data.sources,
    data.preferences,
  ]);
  return error;
}
