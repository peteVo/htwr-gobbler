# Reminder behavior

In **Settings → Reminders**, choose a lead time (1 hour, 6 hours, 1 day, 2 days or 1 week), whether to receive deadline-change alerts, and quiet hours in Europe/Berlin. Enable foreground reminders and approve the browser's notification request. These preferences are account-scoped; notification permission and delivery markers belong to the current browser/origin. Existing accounts retain the previous 1-day lead time. Reminders are off by default.

Use **Send test notification** to check your device. A successful result means the browser accepted the request; it does not prove an OS banner was visible. Check the notification area, browser/site settings and Do Not Disturb. Tests run immediately, even during quiet hours, and use no academic record content.

## Automatic alerts

- Approaching alerts require an open, confirmed assignment with a known time that is still in the future and within the selected lead time. No timed alert is invented for date-only or unverified tasks. Completed, dismissed, elapsed and other item types are excluded.
- Deadline-change alerts cover open assignments whose stored deadline moved earlier or later. They include the module, previous/new dates, date-only/review warnings and stale-source warnings where relevant. A change that moved a deadline into the past can still need attention. Notifications use EN/DE/VI according to account language, with Berlin dates/times.
- Enabling reminders starts a browser-local change baseline; historical changes are not replayed. After that, available changes are eligible for seven days, including after quiet hours or an app restart. Only the latest change matching the item's current date is used. The workspace currently returns its latest 100 change records; changes displaced from that history cannot be alerted on.
- Each item/deadline or change is recorded after the browser accepts delivery. Reloading retains those markers; two tabs coordinate through Web Locks where supported. A change alert also covers an approaching alert due in that check. A deadline moved well before the chosen lead time can still receive a later approaching alert.
- Equal quiet-hour start/end pauses all automatic alerts. Quiet hours follow Berlin DST. If a deadline passes while alerts are paused, there is no late approaching notification; Tasks still shows it as overdue.
- A delivery/storage failure is explicit and retried while the app is open. Enabled reminders with blocked or unavailable browser permission show a warning. Clearing site storage clears delivery markers and can allow repeats. Web Locks fallback browsers do not have atomic coordination across simultaneous tabs.

## Opening an alert

Clicking an item alert opens its editor, after sign-in if needed. The service worker reuses an existing app window or opens the app at the same origin. The app resolves the item ID against the signed-in workspace; a missing or unavailable item produces a message rather than fetching another account's record. A test alert only returns to the app.

The delivery helper prefers the active service worker's [`showNotification`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), with a desktop Notification constructor fallback when no worker is active. The production app registers its service worker; local development uses the fallback. See [notification permission and platform behavior](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).

## Limits

Keep Gobbler open and the device awake. This is foreground scheduling, even when a service worker presents the alert. Browser suspension, sleep and OS settings can delay or suppress delivery. Windows startup source checks do not themselves send notifications. Background push or a native closed-browser notifier remains separate work; no push service, paid account or cloud deployment was added.

Browser automation simulates notification acceptance and errors; it does not verify a visible Windows/Android/Linux banner. A real test on the user's chosen browser remains necessary. Notifications contain the module, task title and dates; device notification privacy settings control where those details appear.
