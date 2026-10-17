/* Hallmark · component critique: P4 H4 E4 S5 R5 V4 · existing settings controls */
import { useEffect, useState } from "react";
import type { Preferences } from "../../../packages/core/index";
import { showNotification } from "./reminders";

const permission = () =>
  "Notification" in window ? Notification.permission : "unsupported";

export function ReminderSettings({
  email,
  prefs,
  busy,
  needAccount,
  save,
}: {
  email: string;
  prefs: Preferences;
  busy: boolean;
  needAccount: () => boolean;
  save: (prefs: Preferences) => Promise<void>;
}) {
  const [allowed, setAllowed] = useState(permission),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    const refresh = () => setAllowed(permission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return (
    <section aria-label="Reminder settings">
      <h2>Reminders</h2>
      <p className="muted">
        Keep Gobbler open for reminders. Approaching alerts cover open,
        confirmed assignments with a known time. Date-only deadlines stay
        visible in Tasks. Click an alert to open its item.
      </p>
      <p className="small muted" role="status">
        {allowed === "unsupported"
          ? "This browser does not support notifications."
          : allowed === "denied"
            ? "Notifications are blocked in this browser. Allow them in site settings to receive alerts."
            : allowed === "granted"
              ? `Browser permission granted. Reminders ${prefs.reminders ? "enabled" : "disabled"}.`
              : "Browser permission has not been granted yet."}
      </p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="small muted" role="status">
          {notice}
        </p>
      )}
      <button
        className="secondary"
        disabled={
          busy || testing || (!prefs.reminders && allowed === "unsupported")
        }
        onClick={async () => {
          if (needAccount()) return;
          setError("");
          setNotice("");
          try {
            if (!prefs.reminders) {
              if (!("Notification" in window))
                throw new Error("This browser does not support notifications.");
              const next = await Notification.requestPermission();
              setAllowed(next);
              if (next !== "granted")
                throw new Error(
                  "Notification permission was not granted. Your deadlines remain visible in Tasks.",
                );
              localStorage.setItem(
                "reminder-changes-since:" + email,
                String(Date.now()),
              );
            }
            await save({ ...prefs, reminders: !prefs.reminders });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {prefs.reminders ? "Disable reminders" : "Enable foreground reminders"}
      </button>
      <label>
        Remind me before a deadline
        <select
          value={prefs.reminder_hours ?? 24}
          disabled={busy || testing}
          onChange={(e) => {
            if (!needAccount())
              void save({ ...prefs, reminder_hours: Number(e.target.value) });
          }}
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>1 day</option>
          <option value={48}>2 days</option>
          <option value={168}>1 week</option>
        </select>
      </label>
      <label>
        Deadline-change alerts
        <select
          value={String(prefs.deadline_changes ?? true)}
          disabled={busy || testing}
          onChange={(e) => {
            if (!needAccount())
              void save({
                ...prefs,
                deadline_changes: e.target.value === "true",
              });
          }}
        >
          <option value="true">Notify when a deadline moves</option>
          <option value="false">Off</option>
        </select>
      </label>
      <p className="small muted">
        Changes since reminders were enabled in this browser are eligible for
        seven days. Alerts show old and new dates, including review warnings.
        Quiet hours delay alerts; missed or completed deadlines do not trigger
        approaching reminders.
      </p>
      <div className="field-row">
        {(
          [
            ["quiet_start", "Quiet from (Berlin)"],
            ["quiet_end", "Until (Berlin)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={prefs[key]}
              disabled={busy || testing}
              onChange={(e) => {
                if (!needAccount())
                  void save({ ...prefs, [key]: Number(e.target.value) });
              }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="small muted">
        Equal quiet-hour times pause all automatic alerts. Choices are saved to
        your account; browser permission and duplicate suppression are specific
        to this browser.
      </p>
      <button
        className="secondary"
        disabled={busy || testing || allowed !== "granted"}
        onClick={async () => {
          if (needAccount()) return;
          setTesting(true);
          setError("");
          setNotice("");
          try {
            await showNotification(
              "htwr-gobbler · Test notification",
              "Your browser accepted this test. Automatic reminders require Gobbler to stay open.",
              "gobbler-test",
            );
            setNotice(
              "Test accepted by the browser. Check your device's notification area and Do Not Disturb settings.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setTesting(false);
          }
        }}
      >
        {testing ? "Sending…" : "Send test notification"}
      </button>
      <p className="small muted">
        Tests are sent immediately, including during quiet hours. Device
        settings can silence or hide browser notifications. Closing Gobbler
        stops automatic reminders; scheduled source checks alone do not send
        alerts.
      </p>
    </section>
  );
}
