import { LanguageContext, translate, useText, useLocale } from "./text";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Unplug,
  X,
  MessageSquare,
} from "lucide-react";
import {
  calendarDates,
  shiftCalendarPeriod,
  type CalendarView,
  berlinDay,
  briefing,
  defaultPreferences,
  type Course,
  type Item,
  type Snapshot,
  type Preferences,
  type Change,
} from "../../../packages/core/index";
import { demo } from "./demo";
import {
  extractExplicitDeadlines,
  type DeadlineCandidate,
  type DocumentPage,
} from "../../../packages/core/deadlines";
import { messages } from "./i18n";
import { Actions } from "./Actions";
import { SearchResults } from "./SearchResults";
import { ReminderSettings } from "./ReminderSettings";
import { useReminders } from "./reminders";
import { Restore } from "./Restore";
import { Assistant } from "./Assistant";
import "./styles.css";

async function api<T = Record<string, any>>(
  path: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(value.error || "Request failed");
  return value as T;
}
type Page =
  | "today"
  | "tasks"
  | "calendar"
  | "courses"
  | "sources"
  | "assistant"
  | "settings";
const navigation = [
  ["today", LayoutDashboard],
  ["tasks", ListTodo],
  ["calendar", CalendarDays],
  ["courses", BookOpen],
  ["sources", Unplug],
  ["assistant", MessageSquare],
  ["settings", Settings2],
] as const;
const blank = {
  title: "",
  description: "",
  kind: "assignment",
  starts_at: "",
  ends_at: null,
  all_day: false,
  course_id: null,
  status: "open",
  verification: "confirmed",
  source_url: "",
  evidence: "",
};
function App() {
  const [clock, setClock] = useState(new Date());
  const [data, setData] = useState<Snapshot>(demo),
    [email, setEmail] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState<Page>("today"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("open"),
    [courseFilter, setCourseFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState("assignment");
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<
      "auth" | "item" | "course" | "import" | "feed" | "ai" | null
    >(null),
    [editing, setEditing] = useState<Item | null>(null),
    [editingCourse, setEditingCourse] = useState<Course | null>(null),
    [mobile, setMobile] = useState(false);
  const [view, setView] = useState<CalendarView>("week"),
    [anchor, setAnchor] = useState(new Date()),
    [online, setOnline] = useState(navigator.onLine),
    [install, setInstall] = useState<any>(null),
    [mcpToken, setMcpToken] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const searching = Boolean(search.trim());
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const prefs = data.preferences,
    t = messages[prefs.language],
    locale = { en: "en-GB", de: "de-DE", vi: "vi-VN" }[prefs.language];
  const tx = (text: string, ...values: unknown[]) =>
    translate(prefs.language, text, ...values);
  const reminderError = useReminders(email, data);
  const urgentChange = (change: Change) =>
    Number(
      change.kind === "deadline_earlier" &&
        Date.parse(change.created_at) > clock.getTime() - 7 * 86400000 &&
        data.items.some((i) => i.id === change.item_id && i.status === "open"),
    );
  const recentChanges = [...data.changes].sort(
    (a, b) => urgentChange(b) - urgentChange(a),
  );
  const stamp = (
    date: string,
    options: Intl.DateTimeFormatOptions = {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Berlin",
      ...options,
    }).format(new Date(date));
  async function load() {
    const next = await api<Snapshot>("/data");
    setData(next);
  }
  useEffect(() => {
    (async () => {
      try {
        const me = await api("/me");
        setEmail(me.email);
        await load();
      } catch (e) {
        if (!String(e).includes("Sign in")) setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    const on = () => setOnline(navigator.onLine),
      installPrompt = (e: Event) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", installPrompt);
    const clockTimer = window.setInterval(() => setClock(new Date()), 60000);
    return () => {
      window.clearInterval(clockTimer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", installPrompt);
    };
  }, []);
  useEffect(() => {
    if (!email || modal || busy) return;
    let active = true;
    const refresh = async () => {
      if (document.hidden || !navigator.onLine) return;
      try {
        const next = await api<Snapshot>("/data");
        if (active) setData(next);
      } catch {
        if (active)
          setError(
            "Could not refresh your workspace. Displayed source checks may be outdated.",
          );
      }
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [email, modal, busy]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !modal &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      ) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [modal]);
  useEffect(() => {
    document.documentElement.lang = prefs.language;
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs]);
  useEffect(() => {
    if (page !== "today") setSelectedAction("");
  }, [page]);
  useEffect(() => {
    if (page === "sources" && !searching && selectedSource) {
      document.getElementById("source-" + selectedSource)?.focus();
      setSelectedSource("");
    }
  }, [page, searching, selectedSource]);
  useEffect(() => {
    if (modal) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [modal]);
  useEffect(() => {
    if (!email || loading || modal === "auth") return;
    const openNotificationItem = () => {
      if (!location.hash.startsWith("#item/")) return;
      const item = data.items.find(
        (i) => "#item/" + encodeURIComponent(i.id) === location.hash,
      );
      history.replaceState(null, "", location.pathname + location.search);
      if (item) {
        setEditing(item);
        setModal("item");
      } else
        setError("This notification's item is no longer in your workspace.");
    };
    openNotificationItem();
    window.addEventListener("hashchange", openNotificationItem);
    return () => window.removeEventListener("hashchange", openNotificationItem);
  }, [email, loading, data.items, modal]);
  const summary = briefing(data.items, data.sources, clock),
    course = (id: string | null) => data.courses.find((c) => c.id === id),
    isDemo = !email;
  const items = data.items.filter(
    (i) =>
      (!courseFilter || i.course_id === courseFilter) &&
      (page !== "tasks" || !typeFilter || i.kind === typeFilter),
  );
  const deadlines = items
    .filter((i) => i.kind === "assignment")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  function needAccount() {
    if (isDemo) {
      setModal("auth");
      return true;
    }
    return false;
  }
  async function act(fn: () => Promise<unknown>, message = tx("Saved")) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      setNotice(message);
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
      // A failed import/check may have changed source health on the server.
      try {
        await load();
      } catch {
        /* Keep the visible records and failure message. */
      }
    } finally {
      setBusy(false);
    }
  }
  const edit = (item?: Item) => {
    if (needAccount()) return;
    setEditing(item || null);
    setModal("item");
  };
  const changePrefs = async (next: Preferences) => {
    if (isDemo) {
      setData({ ...data, preferences: next });
      return;
    }
    await act(() => api("/preferences", "PUT", next), "Preferences saved");
  };
  function TaskRow({ item }: { item: Item }) {
    const tx = useText();
    const c = course(item.course_id),
      outdated =
        item.source_id &&
        data.sources.some(
          (s) =>
            s.id === item.source_id &&
            (s.status !== "connected" ||
              !s.last_success ||
              Date.now() - new Date(s.last_success).getTime() > 3600000),
        );
    return (
      <div className={`task-row ${item.status === "done" ? "completed" : ""}`}>
        <button
          className="check-button"
          aria-label={`${item.status === "done" ? tx("Reopen") : tx("Complete")} ${item.title}`}
          disabled={busy}
          onClick={() => {
            if (!needAccount())
              act(
                () =>
                  api("/items/" + item.id, "PUT", {
                    ...item,
                    status: item.status === "done" ? "open" : "done",
                  }),
                "Task updated. Completion does not mean submitted.",
              );
          }}
        >
          {item.status === "done" && <Check size={15} />}
        </button>
        <button className="task-content" onClick={() => edit(item)}>
          <span className="course-label">
            <i className={`dot ${c?.color || "sage"}`} />
            {c?.name ||
              (item.source_id ? tx("Module not provided") : tx("Personal"))}
          </span>
          <strong>{item.title}</strong>
          <span className="task-meta">
            <Clock3 size={12} />
            {stamp(
              item.starts_at,
              item.all_day ? { dateStyle: "medium" } : undefined,
            )}
            {item.all_day &&
              (item.kind === "assignment"
                ? tx(" · date only; verify cutoff")
                : tx(" · all day"))}
            <span
              className={`verification ${item.verification === "needs_review" || outdated ? "review" : ""}`}
            >
              {outdated ? (
                tx("Source outdated")
              ) : item.verification === "needs_review" ? (
                t.review
              ) : (
                <>
                  <ShieldCheck size={11} />{" "}
                  {isDemo ? tx("Demo verified") : tx("Confirmed")}
                </>
              )}
            </span>
          </span>
        </button>
        {item.source_url && (
          <a
            className="icon-button source-link"
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            aria-label={tx("Open original source for {0}", item.title)}
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    );
  }
  const sourceCurrent = (s: Snapshot["sources"][number]) =>
    s.status === "connected" &&
    !!s.last_success &&
    clock.getTime() - new Date(s.last_success).getTime() < 3600000;
  const sourceHealth = (
    <>
      <div className="section-heading">
        <h2>{t.connections}</h2>
        <button className="text-button" onClick={() => setPage("sources")}>
          {t.viewall}
          <ArrowRight size={14} />
        </button>
      </div>
      <p className="muted small">
        {summary.healthy} {tx("of")} {summary.total}{" "}
        {tx("sources checked within the last hour.")}
      </p>
      {data.sources.map((s) => (
        <div className="health-row" key={s.id}>
          <span
            className={`health-dot ${sourceCurrent(s) ? "ok" : "warning"}`}
          />
          <div>
            <strong>{s.name}</strong>
            <span>
              {s.last_success
                ? tx("Last success ") + stamp(s.last_success)
                : tx("Never checked")}
            </span>
          </div>
          <span
            className={`source-state ${sourceCurrent(s) ? "" : "warning-text"}`}
          >
            {s.status === "connected" && !sourceCurrent(s)
              ? tx("Check outdated")
              : t[s.status as keyof typeof t] || s.status}
          </span>
        </div>
      ))}
      {!data.sources.length && (
        <p className="muted">
          {tx("Connect a calendar to check its published events.")}
        </p>
      )}
      <div className="coverage-note">
        <CircleAlert size={15} />
        <span>
          {tx(
            "Calendar coverage only. PDFs, announcements and submissions have not been checked.",
          )}
        </span>
      </div>
    </>
  );
  return (
    <LanguageContext.Provider value={prefs.language}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          {tx("Skip to content")}
        </a>
        <aside
          id="workspace-navigation"
          className={`sidebar ${mobile ? "mobile-open" : ""}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMobile(false);
              document.getElementById("navigation-toggle")?.focus();
            }
          }}
        >
          <a href="#today" className="brand" onClick={() => setPage("today")}>
            <img src="/icon.svg" width="35" height="35" alt="" />
            <span>
              htwr<span className="brand-dash">–</span>gobbler
              <small>{tx("YOUR ACADEMIC SPACE")}</small>
            </span>
          </a>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobile(false)}
            aria-label={tx("Close navigation")}
          >
            <X />
          </button>
          <div className="workspace">
            <span className="university-mark">rwth</span>
            <div>
              <strong>RWTH Aachen</strong>
              <small>{tx("Winter semester 26/27")}</small>
            </div>
          </div>
          <span className="nav-caption">{tx("WORKSPACE")}</span>
          <nav aria-label={tx("Main navigation")}>
            {navigation.map(([key, Icon]) => (
              <button
                key={key}
                aria-current={page === key ? "page" : undefined}
                className={page === key ? "active" : ""}
                onClick={() => {
                  setPage(key);
                  setMobile(false);
                  setSearch("");
                  setSelectedAction("");
                  setCourseFilter("");
                  setTypeFilter("assignment");
                  requestAnimationFrame(() =>
                    document.getElementById("main")?.focus(),
                  );
                }}
              >
                <Icon size={19} />
                {t[key]}
                {key === "tasks" && (
                  <span className="nav-count">
                    {
                      data.items.filter(
                        (i) => i.kind === "assignment" && i.status === "open",
                      ).length
                    }
                  </span>
                )}
                {key === "sources" && summary.healthy < summary.total && (
                  <i className="alert-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <p>
              {tx("A clearer head.")}
              <br />
              {tx("A little more headspace.")}
            </p>
            <div className="account">
              <span className="avatar">
                {email ? email[0].toUpperCase() : "G"}
              </span>
              <div>
                <strong>{email || tx("Explore the demo")}</strong>
                <small>
                  {email
                    ? tx("Personal workspace")
                    : tx("No real university data")}
                </small>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() =>
                email
                  ? act(async () => {
                      await api("/logout", "POST");
                      setEmail("");
                      setData(demo);
                      window.location.reload();
                    }, "Signed out")
                  : setModal("auth")
              }
            >
              {email ? t.signout : t.signin}
              <ArrowRight size={14} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="mobile-toggle icon-button"
              id="navigation-toggle"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              aria-label={tx("Open navigation")}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              {tx("Workspace")}
              <span>/</span>
              <strong>{searching ? t.results : t[page]}</strong>
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label={t.search}
                placeholder={t.search}
                type="search"
                maxLength={200}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedAction("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
              />
              <kbd>/</kbd>
            </label>
            <span className="timezone">Europe / Berlin</span>
          </header>
          <main id="main" tabIndex={-1}>
            <div className="demo-strip">
              {isDemo ? (
                <>
                  <span className="demo-label">{tx("DEMO WORKSPACE")}</span>
                  <span>
                    {tx(
                      "Sample data. Your university accounts are not connected.",
                    )}
                  </span>
                  <button onClick={() => setModal("auth")}>
                    {t.signin}
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="demo-label">{tx("PERSONAL WORKSPACE")}</span>
                  <span>
                    {tx(
                      "Calendar imports cover published events, not every university instruction.",
                    )}
                  </span>
                </>
              )}
            </div>
            {!online && (
              <div className="alert" role="status">
                {tx(
                  "You’re offline. Visible records may be outdated. Reconnect to save or check sources.",
                )}
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {tx(error)}
                <button
                  aria-label={tx("Dismiss error")}
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {reminderError && (
              <div className="alert error" role="alert">
                {tx(reminderError)}
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {tx(notice)}
                <button
                  aria-label={tx("Dismiss notice")}
                  onClick={() => setNotice("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {page === "today"
                    ? new Intl.DateTimeFormat(locale, {
                        dateStyle: "full",
                        timeZone: "Europe/Berlin",
                      }).format(new Date())
                    : tx("YOUR ACADEMIC SPACE")}
                </p>
                <h1>
                  {searching
                    ? t.results
                    : page === "today"
                      ? t.headline
                      : t[page]}
                </h1>
                <p>
                  {searching
                    ? `“${search.trim()}”`
                    : page === "today"
                      ? t.sub
                      : page === "tasks"
                        ? tx(
                            "Keep track here. Submit through your course system.",
                          )
                        : page === "sources"
                          ? tx(
                              "Know what was checked, and what still needs your attention.",
                            )
                          : tx("One place for the details of your semester.")}
                </p>
              </div>
              {page !== "assistant" && (
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() =>
                    searching
                      ? setSearch("")
                      : page === "sources"
                        ? needAccount() || setModal("import")
                        : page === "courses"
                          ? needAccount() ||
                            (setEditingCourse(null), setModal("course"))
                          : edit()
                  }
                >
                  {searching ? <X size={17} /> : <Plus size={17} />}
                  {searching
                    ? t.clearSearch
                    : page === "sources"
                      ? t.import
                      : page === "courses"
                        ? t.newcourse
                        : t.add}
                </button>
              )}
            </div>
            {loading ? (
              <div className="empty">
                <LoaderCircle className="spin" />
                {tx("Opening your workspace…")}
              </div>
            ) : searching ? (
              <SearchResults
                data={data}
                query={search}
                stamp={stamp}
                open={(result) => {
                  if (result.type === "item") {
                    edit(result.record);
                    return;
                  }
                  setSearch("");
                  if (result.type === "action") {
                    setSelectedAction(result.record.id);
                    setPage("today");
                  } else if (result.type === "course") {
                    setCourseFilter(result.record.id);
                    setTypeFilter("");
                    setFilter("all");
                    setPage("tasks");
                  } else {
                    setSelectedSource(result.record.id);
                    setPage("sources");
                  }
                }}
              />
            ) : (
              <>
                {page === "today" && (
                  <>
                    <section className="briefing">
                      <div className="briefing-icon">
                        <BookOpen size={25} />
                      </div>
                      <div>
                        <p className="eyebrow">{t.briefing}</p>
                        <h2>
                          {summary.overdue
                            ? tx(
                                summary.overdue === 1
                                  ? "1 overdue task needs a look."
                                  : "{0} overdue tasks need a look.",
                                summary.overdue,
                              )
                            : summary.week
                              ? tx(
                                  summary.week === 1
                                    ? "1 assignment due in the next 7 days."
                                    : "{0} assignments due in the next 7 days.",
                                  summary.week,
                                )
                              : tx("A little room to plan ahead.")}
                        </h2>
                        <p>
                          {summary.today}{" "}
                          {tx("open items on today’s calendar.")}{" "}
                          {summary.total
                            ? tx(
                                summary.total - summary.healthy === 1
                                  ? "1 source needs a fresh check."
                                  : "{0} sources need a fresh check.",
                                summary.total - summary.healthy,
                              )
                            : tx(
                                "No university sources have been checked yet.",
                              )}{" "}
                          {data.items.some(
                            (i) => i.verification === "needs_review",
                          )
                            ? tx("Some dates still need your review.")
                            : ""}
                        </p>
                      </div>
                      <span className="briefing-art" aria-hidden="true">
                        g.
                      </span>
                    </section>
                    <div className="overview-line">
                      <div>
                        <span className="metric">
                          {summary.week.toString().padStart(2, "0")}
                        </span>
                        <span>
                          {t.week}
                          <small>{tx("assignments due")}</small>
                        </span>
                      </div>
                      <div>
                        <span className="metric">
                          {summary.today.toString().padStart(2, "0")}
                        </span>
                        <span>
                          {t.today}
                          <small>{tx("scheduled items")}</small>
                        </span>
                      </div>
                      <div>
                        <span className="metric warm">
                          {data.items
                            .filter(
                              (i) =>
                                i.status === "open" &&
                                i.verification === "needs_review",
                            )
                            .length.toString()
                            .padStart(2, "0")}
                        </span>
                        <span>
                          {t.review}
                          <small>{tx("verify the original")}</small>
                        </span>
                      </div>
                    </div>
                    <div className="dashboard-grid">
                      <section className="deadline-section">
                        <div className="section-heading">
                          <h2>{t.upcoming}</h2>
                          <button
                            className="text-button"
                            onClick={() => setPage("tasks")}
                          >
                            {t.viewall}
                            <ArrowRight size={14} />
                          </button>
                        </div>
                        <div className="task-list">
                          {deadlines
                            .filter((i) => i.status === "open")
                            .slice(0, 4)
                            .map((i) => (
                              <TaskRow item={i} key={i.id} />
                            ))}
                          {!deadlines.some((i) => i.status === "open") && (
                            <Empty
                              text={tx(
                                "No assignments stored. This does not mean your university has no deadlines.",
                              )}
                            />
                          )}
                        </div>
                        <div className="small muted list-footnote">
                          <ShieldCheck size={14} />
                          {tx(
                            "Dates keep their source and verification state.",
                          )}
                        </div>
                      </section>
                      {!isDemo && (
                        <Actions
                          key={selectedAction || "actions"}
                          initialAction={data.actions?.find(
                            (a) => a.id === selectedAction,
                          )}
                          actions={data.actions ?? []}
                          courses={data.courses}
                          busy={busy}
                          save={async (method, id, value) => {
                            setBusy(true);
                            try {
                              await api(
                                "/actions" + (id ? "/" + id : ""),
                                method,
                                value,
                              );
                              await load();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                      )}
                      <section className="schedule-section">
                        <div className="section-heading">
                          <h2>{t.schedule}</h2>
                          <span className="tiny-label">{tx("TODAY")}</span>
                        </div>
                        {items
                          .filter(
                            (i) =>
                              berlinDay(i.starts_at) ===
                                berlinDay(new Date()) &&
                              i.kind !== "assignment",
                          )
                          .map((i) => (
                            <button
                              key={i.id}
                              className="schedule-row"
                              onClick={() => edit(i)}
                            >
                              <time>
                                {i.all_day
                                  ? tx("All day")
                                  : stamp(i.starts_at, {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                              </time>
                              <span>
                                <strong>{i.title}</strong>
                                <small>{i.description || i.kind}</small>
                              </span>
                            </button>
                          ))}
                        {!items.some(
                          (i) =>
                            berlinDay(i.starts_at) === berlinDay(new Date()) &&
                            i.kind !== "assignment",
                        ) && (
                          <Empty
                            text={tx("No scheduled events stored for today.")}
                          />
                        )}
                        <button
                          className="text-button schedule-footer"
                          onClick={() => setPage("calendar")}
                        >
                          {tx("Open calendar")}
                          <ArrowRight size={15} />
                        </button>
                      </section>
                      <section className="activity-section">
                        <div className="section-heading">
                          <h2>{t.activity}</h2>
                          <span className="tiny-label">
                            {tx("RECENT ACTIVITY")}
                          </span>
                        </div>
                        {recentChanges.slice(0, 4).map((c) => (
                          <div className="activity-row" key={c.id}>
                            <span className="activity-symbol">
                              {c.kind === "added" ? (
                                <Plus size={14} />
                              ) : (
                                <RefreshCw size={13} />
                              )}
                            </span>
                            <div>
                              <strong>{c.title}</strong>
                              <small>
                                {
                                  data.courses.find(
                                    (course) =>
                                      course.id ===
                                      data.items.find((i) => i.id === c.item_id)
                                        ?.course_id,
                                  )?.name
                                }
                              </small>
                              {c.previous_starts_at &&
                                c.next_starts_at &&
                                c.previous_starts_at !== c.next_starts_at && (
                                  <span
                                    className={
                                      c.kind === "deadline_earlier"
                                        ? "warning-text"
                                        : ""
                                    }
                                  >
                                    {c.kind === "deadline_earlier"
                                      ? tx("Deadline moved earlier")
                                      : c.kind === "deadline_later"
                                        ? tx("Deadline moved later")
                                        : tx("Schedule changed")}
                                    :{" "}
                                    {stamp(c.previous_starts_at, {
                                      dateStyle: "medium",
                                      ...(c.previous_all_day
                                        ? {}
                                        : { timeStyle: "short" as const }),
                                    })}{" "}
                                    →{" "}
                                    {stamp(c.next_starts_at, {
                                      dateStyle: "medium",
                                      ...(c.next_all_day
                                        ? {}
                                        : { timeStyle: "short" as const }),
                                    })}
                                  </span>
                                )}
                              <span>
                                {c.kind === "added"
                                  ? tx("Added to your workspace")
                                  : tx("Information updated")}{" "}
                                ·{" "}
                                {stamp(c.created_at, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {!data.changes.length && (
                          <Empty
                            text={tx(
                              "Changes will appear here after your first import.",
                            )}
                          />
                        )}
                      </section>
                      <section className="sources-section">
                        {sourceHealth}
                      </section>
                    </div>
                  </>
                )}
                {page === "tasks" && (
                  <>
                    <div className="filterbar">
                      <div className="tabs">
                        {["open", "done", "all"].map((v) => (
                          <button
                            key={tx(v)}
                            className={filter === v ? "selected" : ""}
                            onClick={() => setFilter(v)}
                          >
                            {t[v as "open"]}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label={tx("Filter course")}
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                      >
                        <option value="">{tx("All courses")}</option>
                        {data.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={tx("Filter type")}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="">{tx("All types")}</option>
                        {[
                          "assignment",
                          "lecture",
                          "tutorial",
                          "exam",
                          "study",
                          "announcement",
                          "material",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {tx(v)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <section className="wide-list">
                      {items
                        .filter((i) => filter === "all" || i.status === filter)
                        .map((i) => (
                          <TaskRow item={i} key={i.id} />
                        ))}
                      {!items.filter(
                        (i) => filter === "all" || i.status === filter,
                      ).length && <Empty text={t.empty} />}
                    </section>
                  </>
                )}
                {page === "courses" && (
                  <div className="course-grid">
                    {data.courses
                      .filter(
                        (c) =>
                          !search ||
                          c.name.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <article className="course-card" key={c.id}>
                          <div className="section-heading">
                            <span className={`course-monogram ${c.color}`}>
                              {c.code.split(" ")[0] || c.name.slice(0, 2)}
                            </span>
                            <BookOpen size={22} />
                          </div>
                          <p className="eyebrow">
                            {c.code || tx("PERSONAL COURSE")}
                          </p>
                          <h2>{c.name}</h2>
                          <p className="muted">
                            {
                              data.items.filter(
                                (i) =>
                                  i.course_id === c.id &&
                                  i.status === "open" &&
                                  i.kind === "assignment",
                              ).length
                            }{" "}
                            {tx("open assignments")}
                          </p>
                          <div className="course-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setCourseFilter(c.id);
                                setTypeFilter("");
                                setFilter("all");
                                setPage("tasks");
                              }}
                            >
                              {tx("View coursework")}
                              <ArrowRight size={15} />
                            </button>
                            <button
                              className="text-button"
                              onClick={() => {
                                if (!needAccount()) {
                                  setEditingCourse(c);
                                  setModal("course");
                                }
                              }}
                            >
                              {tx("Edit")}
                            </button>
                          </div>
                        </article>
                      ))}
                    {!data.courses.length && (
                      <Empty
                        text={tx("Add your first course to organize tasks.")}
                      />
                    )}
                  </div>
                )}
                {page === "calendar" && (
                  <>
                    <div className="filterbar">
                      <div className="calendar-controls">
                        <button
                          className="icon-button"
                          aria-label={tx("Previous period")}
                          onClick={() =>
                            setAnchor(shiftCalendarPeriod(anchor, view, -1))
                          }
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setAnchor(new Date())}
                        >
                          {t.today}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={tx("Next period")}
                          onClick={() =>
                            setAnchor(shiftCalendarPeriod(anchor, view, 1))
                          }
                        >
                          <ChevronRight size={18} />
                        </button>
                        <strong>
                          {new Intl.DateTimeFormat(locale, {
                            month: "long",
                            year: "numeric",
                            timeZone: "Europe/Berlin",
                          }).format(anchor)}
                        </strong>
                      </div>
                      <div className="tabs">
                        {["day", "week", "month"].map((v) => (
                          <button
                            key={tx(v)}
                            className={view === v ? "selected" : ""}
                            onClick={() => setView(v as CalendarView)}
                          >
                            {tx(v)}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label={tx("Calendar course")}
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                      >
                        <option value="">{tx("All courses")}</option>
                        {data.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={`calendar-grid ${view}`}>
                      {calendarDates(anchor, view).map((d) => {
                        const key = berlinDay(d);
                        return (
                          <div
                            key={key}
                            className={`calendar-cell ${key === berlinDay(new Date()) ? "is-today" : ""}`}
                          >
                            <time>
                              {new Intl.DateTimeFormat(locale, {
                                weekday: "short",
                                day: "numeric",
                                timeZone: "Europe/Berlin",
                              }).format(d)}
                            </time>
                            {items
                              .filter(
                                (i) =>
                                  berlinDay(i.starts_at) === key &&
                                  i.status !== "dismissed",
                              )
                              .map((i) => (
                                <button
                                  key={i.id}
                                  onClick={() => edit(i)}
                                  className={`calendar-event ${course(i.course_id)?.color || "sage"}`}
                                >
                                  <small>
                                    {i.all_day
                                      ? tx("All day")
                                      : stamp(i.starts_at, {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                  </small>
                                  {i.kind === "assignment" && (
                                    <small>
                                      {course(i.course_id)?.name ||
                                        tx("Module not provided")}
                                    </small>
                                  )}
                                  {i.title}
                                  {i.verification === "needs_review" && (
                                    <CircleAlert size={12} />
                                  )}
                                </button>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                    <p className="muted small">
                      {tx(
                        "All times Europe/Berlin. Calendar imports may have incomplete coverage.",
                      )}
                    </p>
                  </>
                )}
                {page === "sources" && (
                  <>
                    <div className="source-intro">
                      <CircleAlert size={21} />
                      <div>
                        <h2>{tx("No news isn’t always good news.")}</h2>
                        <p>
                          {tx(
                            "A successful calendar check only verifies published calendar events. Review Moodle for exercise PDFs, announcements and submission receipts.",
                          )}
                        </p>
                      </div>
                    </div>
                    <section>{sourceHealth}</section>
                    {["127.0.0.1", "localhost", "[::1]"].includes(
                      location.hostname,
                    ) && <LocalStatus />}
                    <div className="source-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          if (!needAccount()) setModal("feed");
                        }}
                      >
                        <Plus size={16} />
                        {tx("Connect Moodle calendar")}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          if (!needAccount()) setModal("import");
                        }}
                      >
                        <ArrowDownToLine size={16} />
                        {t.import}
                      </button>
                    </div>
                    {data.sources.map((s) => (
                      <article
                        className="source-detail"
                        key={s.id}
                        id={"source-" + s.id}
                        tabIndex={-1}
                      >
                        <div>
                          <h3>{s.name}</h3>
                          <p>
                            {s.kind === "file"
                              ? tx(
                                  "Manual file import · re-upload to check for changes",
                                )
                              : tx(
                                  "Calendar subscription · scheduled checks every 30 minutes for up to 10 feeds per run",
                                )}
                          </p>
                          {s.error && (
                            <p className="warning-text">{tx(s.error)}</p>
                          )}
                        </div>
                        {s.kind === "feed" && (
                          <button
                            className="secondary"
                            disabled={busy || isDemo}
                            onClick={() =>
                              act(
                                () => api("/sources/" + s.id + "/sync", "POST"),
                                "Calendar checked",
                              )
                            }
                          >
                            <RefreshCw size={15} />
                            {tx("Check now")}
                          </button>
                        )}
                        <button
                          className="text-button danger"
                          disabled={busy || isDemo}
                          onClick={() => {
                            if (
                              confirm(
                                tx(
                                  "Disconnect this source? Stored academic entries will be retained.",
                                ),
                              )
                            )
                              act(
                                () => api("/sources/" + s.id, "DELETE"),
                                "Source disconnected",
                              );
                          }}
                        >
                          {tx("Disconnect")}
                        </button>
                      </article>
                    ))}
                  </>
                )}
                {page === "assistant" && (
                  <Assistant
                    courses={data.courses}
                    signedIn={!!email}
                    language={prefs.language}
                    request={api}
                  />
                )}
                {page === "settings" && (
                  <div className="settings-layout">
                    <section>
                      <h2>{tx("Make this space yours")}</h2>
                      <label>
                        {t.language}
                        <select
                          value={prefs.language}
                          onChange={(e) =>
                            changePrefs({
                              ...prefs,
                              language: e.target
                                .value as Preferences["language"],
                            })
                          }
                        >
                          <option value="en">English</option>
                          <option value="de">Deutsch</option>
                          <option value="vi">Tiếng Việt</option>
                        </select>
                      </label>
                      <p className="muted small">
                        {tx(
                          "Interface and help text follow your language choice. Course content stays in its original language.",
                        )}
                      </p>
                      <label>
                        {t.appearance}
                        <select
                          value={prefs.theme}
                          onChange={(e) =>
                            changePrefs({
                              ...prefs,
                              theme: e.target.value as Preferences["theme"],
                            })
                          }
                        >
                          <option value="system">{tx("System")}</option>
                          <option value="light">{tx("Light")}</option>
                          <option value="dark">{tx("Dark")}</option>
                        </select>
                      </label>
                      {!isDemo && <Recovery />}
                      {!isDemo &&
                        ["127.0.0.1", "localhost", "[::1]"].includes(
                          location.hostname,
                        ) && <LocalStatus />}
                      <ReminderSettings
                        email={email}
                        prefs={prefs}
                        busy={busy}
                        needAccount={needAccount}
                        save={changePrefs}
                      />
                    </section>
                    <section>
                      <h2>{tx("Optional AI assistance")}</h2>
                      <p className="muted">
                        {tx(
                          "Find explicit dates in PDF text locally, with page evidence. Optional AI requires consent. All candidates require review.",
                        )}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => {
                          if (!needAccount()) setModal("ai");
                        }}
                      >
                        {tx("Review document text")}
                        <ArrowRight size={15} />
                      </button>
                      <h2>{tx("Take your workspace with you")}</h2>
                      <p className="muted">
                        {tx(
                          "Install from your browser menu on Windows, Linux or Android. Offline mode stores the app shell only; private records are not cached.",
                        )}
                      </p>
                      {install && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            await install.prompt();
                            setInstall(null);
                          }}
                        >
                          {tx("Install gobbler")}
                        </button>
                      )}
                      <h2>{tx("Read-only access for AI clients")}</h2>
                      <p className="muted">
                        {tx(
                          "Generate a token for the included MCP server. It can read your records for 30 days; keep it private.",
                        )}
                      </p>
                      <button
                        className="secondary"
                        disabled={busy || isDemo}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            setMcpToken(
                              (await api("/mcp-token", "POST")).token,
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {tx("Generate read-only token")}
                      </button>
                      {mcpToken && (
                        <label>
                          {tx("Copy now · shown once")}
                          <input
                            readOnly
                            value={mcpToken}
                            aria-label={tx("Read-only MCP token")}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                      )}
                      <button
                        className="text-button danger"
                        disabled={busy || isDemo}
                        onClick={() =>
                          act(async () => {
                            await api("/mcp-token", "DELETE");
                            setMcpToken("");
                          }, "All read-only tokens revoked")
                        }
                      >
                        {tx("Revoke all tokens")}
                      </button>
                      <h2>{tx("Your data")}</h2>
                      <p className="muted">
                        {tx(
                          "Download your stored academic records as JSON. Feed credentials and account secrets are excluded. Course material text is not included; keep your original documents.",
                        )}
                      </p>
                      <button
                        className="secondary"
                        disabled={isDemo}
                        onClick={() => {
                          const url = URL.createObjectURL(
                            new Blob([JSON.stringify(data, null, 2)], {
                              type: "application/json",
                            }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "gobbler-export.json";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        {tx("Export my records")}
                      </button>
                      {!isDemo && (
                        <Restore
                          busy={busy}
                          restore={async (data) => {
                            setBusy(true);
                            try {
                              const result = await api<{
                                added: {
                                  items: number;
                                  courses: number;
                                  actions: number;
                                  sources: number;
                                };
                                skipped: number;
                              }>("/restore", "POST", data);
                              await load();
                              return result;
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
            <footer>
              <span>
                htwr–gobbler <span className="footer-dot">·</span>
                {tx("A little more headspace.")}
              </span>
              <span>
                {tx("Built for your semester.")}
                <span className="footer-dot">·</span> Europe/Berlin
              </span>
            </footer>
          </main>
        </div>
        <dialog
          ref={dialog}
          aria-labelledby="modal-title"
          onCancel={() => setModal(null)}
          onClick={(e) => {
            if (e.target === dialog.current) setModal(null);
          }}
        >
          <div className="modal-heading">
            <h2 id="modal-title">
              {modal === "auth"
                ? tx("Your academic space")
                : modal === "item"
                  ? editing
                    ? tx("Edit item")
                    : tx("Add an academic item")
                  : modal === "course"
                    ? editingCourse
                      ? tx("Edit course")
                      : tx("Add a course")
                    : modal === "import"
                      ? tx("Import a calendar")
                      : modal === "feed"
                        ? tx("Connect Moodle calendar")
                        : tx("Review document text")}
            </h2>
            <button
              className="icon-button"
              aria-label={tx("Close dialog")}
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
          </div>
          {error && (
            <p className="alert error" role="alert">
              {tx(error)}
            </p>
          )}
          {modal === "auth" && (
            <Auth
              busy={busy}
              submit={async (action, values) => {
                setBusy(true);
                setError("");
                try {
                  const me = await api("/auth/" + action, "POST", values);
                  setEmail(me.email);
                  await load();
                  setModal(null);
                  setNotice(
                    action === "recover"
                      ? tx(
                          "Account recovered. Previous sessions and MCP tokens were revoked. Save a new recovery key in Settings.",
                        )
                      : tx(
                          "Your personal workspace is ready. Add a course or import a calendar.",
                        ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          {modal === "item" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const starts =
                  form.get("all_day") === "on"
                    ? String(form.get("starts_at")).slice(0, 10) +
                      "T00:00:00.000Z"
                    : new Date(String(form.get("starts_at"))).toISOString();
                act(() =>
                  api(
                    "/items" + (editing?.id ? "/" + editing.id : ""),
                    editing?.id ? "PUT" : "POST",
                    {
                      ...blank,
                      ...editing,
                      title: form.get("title"),
                      description: form.get("description"),
                      kind: form.get("kind"),
                      course_id: form.get("course_id") || null,
                      starts_at: starts,
                      ends_at: form.get("ends_at")
                        ? new Date(String(form.get("ends_at"))).toISOString()
                        : null,
                      all_day: form.get("all_day") === "on",
                      status: form.get("status"),
                      source_url: form.get("source_url"),
                      verification: form.get("verification"),
                      evidence: form.get("evidence"),
                    },
                  ),
                );
              }}
            >
              <label>
                {tx("Title")}
                <input
                  name="title"
                  required
                  maxLength={250}
                  defaultValue={editing?.title}
                />
              </label>
              <div className="field-row">
                <label>
                  {tx("Type")}
                  <select
                    name="kind"
                    defaultValue={editing?.kind || "assignment"}
                  >
                    {[
                      "assignment",
                      "lecture",
                      "tutorial",
                      "exam",
                      "study",
                      "announcement",
                      "material",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {tx(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tx("Course")}
                  <select
                    name="course_id"
                    defaultValue={editing?.course_id || ""}
                  >
                    <option value="">{tx("Personal")}</option>
                    {data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {tx("Date & time (this device’s timezone)")}
                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  defaultValue={editing ? localDate(editing.starts_at) : ""}
                />
              </label>
              <label>
                {tx("End date & time (optional)")}
                <input
                  type="datetime-local"
                  name="ends_at"
                  defaultValue={
                    editing?.ends_at ? localDate(editing.ends_at) : ""
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  name="all_day"
                  type="checkbox"
                  defaultChecked={editing?.all_day}
                />
                {tx("All-day event")}
              </label>
              <label>
                {tx("Status")}
                <select name="status" defaultValue={editing?.status || "open"}>
                  <option value="open">{tx("Open")}</option>
                  <option value="done">
                    {tx("Done · not a submission receipt")}
                  </option>
                  <option value="dismissed">{tx("Dismissed")}</option>
                </select>
              </label>
              <label>
                {tx("Details")}
                <textarea
                  name="description"
                  rows={3}
                  maxLength={10000}
                  defaultValue={editing?.description}
                />
              </label>
              <label>
                {tx("Original source URL")}
                <input
                  type="url"
                  name="source_url"
                  defaultValue={editing?.source_url}
                />
              </label>
              <label>
                {tx("Verification")}
                <select
                  name="verification"
                  defaultValue={editing?.verification || "confirmed"}
                >
                  <option value="confirmed">
                    {tx("Confirmed by me / original source")}
                  </option>
                  <option value="needs_review">{tx("Needs review")}</option>
                </select>
              </label>
              <label>
                {tx("Evidence / source quotation")}
                <textarea
                  name="evidence"
                  maxLength={3000}
                  defaultValue={editing?.evidence}
                />
              </label>
              <p className="muted small">
                {tx(
                  "Save retains the existing completion state. Done does not mean submitted. Editing imported dates may be overwritten by the next source check.",
                )}
              </p>
              <div className="modal-actions">
                {editing?.id && (
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => {
                      if (confirm(tx("Delete this item?")))
                        act(
                          () => api("/items/" + editing.id, "DELETE"),
                          "Item deleted",
                        );
                    }}
                  >
                    {tx("Delete item")}
                  </button>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}{" "}
                  {t.save}
                </button>
              </div>
            </form>
          )}
          {modal === "course" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                act(() =>
                  api(
                    "/courses" + (editingCourse ? "/" + editingCourse.id : ""),
                    editingCourse ? "PUT" : "POST",
                    Object.fromEntries(f),
                  ),
                );
              }}
            >
              <label>
                {tx("Course name")}
                <input
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={editingCourse?.name}
                />
              </label>
              <label>
                {tx("Course code")}
                <input
                  name="code"
                  maxLength={30}
                  defaultValue={editingCourse?.code}
                />
              </label>
              <label>
                {tx("Color")}
                <select
                  name="color"
                  defaultValue={editingCourse?.color || "sage"}
                >
                  {["sage", "blue", "clay", "gold"].map((c) => (
                    <option key={c} value={c}>
                      {tx(c)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                {editingCourse && (
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => {
                      if (
                        confirm(
                          tx(
                            "Delete course? Its tasks will remain without a course.",
                          ),
                        )
                      )
                        act(
                          () => api("/courses/" + editingCourse.id, "DELETE"),
                          "Course deleted",
                        );
                    }}
                  >
                    {tx("Delete course")}
                  </button>
                )}
                <button className="primary" disabled={busy}>
                  {t.save}
                </button>
              </div>
            </form>
          )}
          {modal === "import" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  file = f.get("file") as File;
                if (file.size > 2_000_000) {
                  setError("Choose a file under 2 MB.");
                  return;
                }
                act(
                  async () =>
                    api("/import", "POST", {
                      name: f.get("name"),
                      source_id: f.get("source_id") || undefined,
                      text: await file.text(),
                    }),
                  "Calendar imported. Check Sources for coverage.",
                );
              }}
            >
              <p className="muted">
                {tx(
                  "Export an .ics calendar from Moodle or RWTHonline. Recurring calendars currently require an export of individual events.",
                )}
              </p>
              <label>
                {tx("Source name")}
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue="University calendar"
                />
              </label>
              <label>
                {tx("Calendar to update")}
                <select name="source_id">
                  <option value="">{tx("Detect automatically")}</option>
                  {data.sources
                    .filter((s) => s.kind === "file")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {tx("Calendar file")}
                <input
                  name="file"
                  type="file"
                  accept=".ics,text/calendar"
                  required
                />
              </label>
              <p className="muted small">
                {tx(
                  "Repeat uploads are matched by their event IDs, even if the source name changes. For partially overlapping exports, choose the existing source above. File imports do not check automatically.",
                )}
              </p>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  {busy ? tx("Importing…") : t.import}
                </button>
              </div>
            </form>
          )}
          {modal === "feed" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                act(
                  () =>
                    api("/sources", "POST", {
                      ...Object.fromEntries(f),
                      source_id: f.get("source_id") || undefined,
                    }),
                  "Calendar connected. Use Check now for the first sync.",
                );
              }}
            >
              <p className="muted">
                {tx(
                  "In your Moodle calendar, choose Import and export → Export calendar. Paste your personal HTTPS export URL. Treat it like a password.",
                )}
              </p>
              <label>
                {tx("Source name")}
                <input
                  name="name"
                  required
                  defaultValue="RWTHmoodle calendar"
                  maxLength={100}
                />
              </label>
              <label>
                {tx("Existing calendar")}
                <select name="source_id" defaultValue="">
                  <option value="">{tx("Connect a separate calendar")}</option>
                  {data.sources
                    .filter((s) => s.kind === "file")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {tx("Replace file import:")}
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <p className="muted small">
                {tx(
                  "If you already uploaded this calendar, replace that file import to preserve its events, modules and completion states. Overlapping calendars are rejected during checks.",
                )}
              </p>
              <label>
                {tx("Calendar export URL")}
                <input type="url" name="url" required autoComplete="off" />
              </label>
              <p className="muted small">
                {tx(
                  "Only moodle.rwth-aachen.de/calendar/export_execute.php is accepted. Feed links are encrypted on the server, never displayed again.",
                )}
              </p>
              <div className="modal-actions">
                <button className="primary" disabled={busy}>
                  {tx("Connect calendar")}
                </button>
              </div>
            </form>
          )}
          {modal === "ai" && (
            <AI
              courses={data.courses}
              items={data.items}
              busy={busy}
              extract={async (text) => {
                setBusy(true);
                setError("");
                try {
                  return (
                    await api("/ai/extract", "POST", { text, consent: true })
                  ).deadlines;
                } catch (e) {
                  setError((e as Error).message);
                  return [];
                } finally {
                  setBusy(false);
                }
              }}
              add={(d, review) => {
                const exact = data.items.find(
                  (i) =>
                    i.course_id === review.course_id &&
                    i.document_key === review.document_key,
                );
                const previous = review.target_id
                  ? data.items.find((i) => i.id === review.target_id)
                  : exact;
                if (exact && !review.target_id) {
                  setEditing(exact);
                  setNotice(
                    "This document date is already saved. Reviewing its existing task.",
                  );
                  setModal("item");
                  return;
                }
                setEditing({
                  ...blank,
                  ...previous,
                  ...review,
                  source_url: review.source_url || previous?.source_url || "",
                  id: previous?.id || "",
                  source_id: null,
                  last_verified: null,
                  title: previous?.title || d.title,
                  starts_at: d.deadline,
                  all_day: d.all_day ?? false,
                  ends_at: null,
                  evidence: `${d.document}${d.page ? tx(" · page {0}", d.page) : ""}: ${d.evidence}`,
                  verification: "needs_review",
                } as Item);
                setModal("item");
              }}
            />
          )}
        </dialog>
      </div>
    </LanguageContext.Provider>
  );
}
function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Empty({ text }: { text: string }) {
  const tx = useText();
  return (
    <div className="empty">
      <BookOpen size={23} />
      <p>{tx(text)}</p>
    </div>
  );
}
function Auth({
  submit,
  busy,
}: {
  submit: (action: string, v: unknown) => Promise<void>;
  busy: boolean;
}) {
  const tx = useText();
  const [action, setAction] = useState("login");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  useEffect(() => {
    api("/auth/options")
      .then((v) => setRegistrationOpen(v.registration_open))
      .catch(() => {});
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(action, Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <p className="muted">
        {action === "register"
          ? tx(
              "Create an account for your own courses and calendars. Never use your RWTH password here.",
            )
          : action === "recover"
            ? tx(
                "Use the recovery key you previously saved. This resets your password, consumes the key and revokes existing sessions and MCP tokens. If you never saved a key, contact your Gobbler operator.",
              )
            : tx(
                "Sign in to your gobbler account. This is separate from RWTH SSO.",
              )}
      </p>
      <label>
        {tx("Email")}
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        {tx("Password · at least 12 characters")}
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete={
            action === "login" ? "current-password" : "new-password"
          }
          required
        />
      </label>
      {action === "recover" && (
        <label>
          {tx("Recovery key")}
          <input
            name="recovery_key"
            required
            autoComplete="off"
            maxLength={200}
          />
        </label>
      )}
      <div className="modal-actions">
        {(registrationOpen || action !== "login") && (
          <button
            className="text-button"
            type="button"
            onClick={() => setAction(action === "login" ? "register" : "login")}
          >
            {action === "login"
              ? tx("Create an account")
              : tx("I already have an account")}
          </button>
        )}
        {action === "login" && (
          <button
            className="text-button"
            type="button"
            onClick={() => setAction("recover")}
          >
            {tx("Recover account")}
          </button>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? tx("Opening…")
            : action === "login"
              ? tx("Sign in")
              : action === "recover"
                ? tx("Reset password and sign in")
                : tx("Create account")}
        </button>
      </div>
    </form>
  );
}
const localStatusSchema = z.object({
  heartbeat: z.string().datetime(),
  last_check: z.string().datetime().nullable(),
  check_failed: z.boolean(),
  last_backup: z.string().datetime().nullable(),
  backup_failed: z.boolean(),
});
function LocalStatus() {
  const tx = useText();
  const locale = useLocale();
  const [status, setStatus] = useState<z.infer<
    typeof localStatusSchema
  > | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await fetch("/local-status", { cache: "no-store" });
        const value = localStatusSchema.safeParse(
          result.ok ? await result.json() : null,
        );
        if (active) setStatus(value.success ? value.data : null);
      } catch {
        if (active) setStatus(null);
      }
      if (active) setNow(Date.now());
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const running = status && now - Date.parse(status.heartbeat) < 180000;
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <section aria-label={tx("Local monitoring")} className="muted small">
      <h3>{tx("Local monitoring & backups")}</h3>
      <p>
        {running
          ? tx(
              "Automatic calendar checks are active while this PC is awake and you are signed in to Windows. Connected feeds are checked every 30 minutes; overdue checks resume after sleep.",
            )
          : tx(
              "Automatic local checks are not running. Use the Gobbler startup shortcut, or Check now for a manual update.",
            )}
      </p>
      {running && status.check_failed && (
        <p role="status" className="warning-text">
          {tx(
            "The last automatic check failed. Previous records are retained; review Sources.",
          )}
        </p>
      )}
      {running && status.last_check && (
        <p>
          {tx("Last automatic check:")} {date(status.last_check)}
        </p>
      )}
      <p>
        {status?.last_backup
          ? tx(
              "Last verified local backup: {0}. Seven daily copies are retained on this PC.",
              date(status.last_backup),
            )
          : tx("No automatic backup has been verified yet.")}
      </p>
      {status?.backup_failed && (
        <p role="status" className="warning-text">
          {tx(
            "Automatic backup failed. Check free disk space and restart the local runner; the previous backup is retained.",
          )}
        </p>
      )}
      <p>
        {tx(
          "Reminders still require an open browser. Local backups do not protect against losing this PC.",
        )}
      </p>
    </section>
  );
}
function Recovery() {
  const tx = useText();
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section>
      <h2>{tx("Account recovery")}</h2>
      <p className="muted">
        {tx(
          "Save a recovery key outside Gobbler. It can reset your password once. Generating a new key replaces the previous one.",
        )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            password = String(new FormData(form).get("password"));
          setBusy(true);
          setError("");
          setKey("");
          try {
            const result = await api("/recovery-key", "POST", { password });
            setKey(result.recovery_key);
            form.reset();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tx("Current password")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <button className="secondary" disabled={busy}>
          {busy ? tx("Generating…") : tx("Generate recovery key")}
        </button>
      </form>
      {error && (
        <p role="alert" className="alert error">
          {tx(error)}
        </p>
      )}
      {key && (
        <div>
          <p role="status">
            {tx(
              "Save this key now. It will not be shown again after you leave this page.",
            )}
          </p>
          <label htmlFor="recovery-key">{tx("Your recovery key")}</label>
          <textarea id="recovery-key" readOnly value={key} autoComplete="off" />
          <button className="text-button" onClick={() => setKey("")}>
            {tx("I saved my key · hide it")}
          </button>
        </div>
      )}
    </section>
  );
}
type DocumentReview = {
  course_id: string;
  source_url: string;
  document_name: string;
  document_hash: string;
  document_key: string;
  target_id?: string;
};
function AI({
  extract,
  add,
  busy,
  courses,
  items,
}: {
  extract: (text: string) => Promise<DeadlineCandidate[]>;
  add: (d: DeadlineCandidate, review: DocumentReview) => void;
  busy: boolean;
  courses: Course[];
  items: Item[];
}) {
  const tx = useText();
  const [results, setResults] = useState<DeadlineCandidate[] | null>(null),
    [pages, setPages] = useState<DocumentPage[]>([]),
    [text, setText] = useState(""),
    [documentName, setDocumentName] = useState("Pasted document"),
    [localError, setLocalError] = useState(""),
    [reading, setReading] = useState(false),
    [consent, setConsent] = useState(false);
  const [courseId, setCourseId] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [targets, setTargets] = useState<Record<number, string>>({});
  return (
    <>
      <p className="muted">
        {tx(
          "Read a PDF locally or paste an excerpt. The local check finds numeric and German month-name dates with a year near deadline wording. Berlin time is assumed when a time is given. Date-only results have an unknown cutoff; every result needs review.",
        )}
      </p>
      <label>
        {tx("Module for this document")}
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setTargets({});
          }}
        >
          <option value="">{tx("Choose a module")}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {!courses.length && (
        <p className="muted">
          {tx("Add a course before saving document deadlines.")}
        </p>
      )}
      <label>
        {tx("Original document URL (optional)")}
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          maxLength={4000}
        />
      </label>
      <label>
        {tx("Exercise PDF · up to 20 pages, 10 MB")}
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={reading || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setReading(true);
            setLocalError("");
            setResults(null);
            setTargets({});
            setText("");
            setPages([]);
            try {
              const value = await (await import("./pdf")).readPdf(file);
              setPages(value);
              setText(value.map((p) => p.text).join("\n\n"));
              setDocumentName(file.name);
            } catch (error) {
              setLocalError(
                (error as Error).message ||
                  tx("Could not read PDF. The document has not been checked."),
              );
            } finally {
              setReading(false);
            }
          }}
        />
      </label>
      {reading && <p role="status">{tx("Reading PDF on this device…")}</p>}
      {localError && (
        <p className="alert error" role="alert">
          {tx(localError)}
        </p>
      )}
      <label htmlFor="document-text">{tx("Document text")}</label>
      <textarea
        id="document-text"
        value={text}
        maxLength={20000}
        rows={6}
        onChange={(e) => {
          setText(e.target.value);
          setPages([{ page: null, text: e.target.value }]);
          setDocumentName("Pasted document");
          setResults(null);
          setTargets({});
        }}
      />
      <button
        className="secondary"
        disabled={reading || busy || !text.trim()}
        onClick={() =>
          setResults(extractExplicitDeadlines(pages, documentName))
        }
      >
        {tx("Find explicit dates locally")}
      </button>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {tx(
          "I consent to sending this text to the configured OpenAI API provider. API usage may incur charges.",
        )}
      </label>
      <button
        className="secondary"
        disabled={reading || busy || !consent || !text.trim()}
        onClick={async () => {
          const output = await extract(text);
          setResults(
            output.map((d) => ({
              ...d,
              document: documentName,
              page:
                pages.find((p) => p.text.includes(d.evidence))?.page || null,
            })),
          );
        }}
      >
        {busy ? tx("Extracting…") : tx("Use optional AI extraction")}
      </button>
      {results?.map((d, i) => (
        <article key={i} className="candidate">
          <h3>{d.title}</h3>
          <p>
            {d.all_day
              ? d.deadline.slice(0, 10) + tx(" · cutoff time unknown")
              : d.deadline}{" "}
            {tx("· Needs review")}
            {d.page ? tx(" · Page ") + d.page : ""}
          </p>
          <blockquote>{d.evidence}</blockquote>
          {items.some(
            (item) =>
              item.course_id === courseId &&
              item.kind === "assignment" &&
              item.document_name,
          ) && (
            <label>
              {tx("Update an existing document task (optional)")}
              <select
                value={targets[i] || ""}
                onChange={(e) =>
                  setTargets({ ...targets, [i]: e.target.value })
                }
              >
                <option value="">
                  {tx("Create a new task, or reopen an identical saved date")}
                </option>
                {items
                  .filter(
                    (item) =>
                      item.course_id === courseId &&
                      item.kind === "assignment" &&
                      item.document_name,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.document_name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="secondary"
            disabled={!courseId || reading || busy}
            onClick={async () => {
              setReading(true);
              setLocalError("");
              try {
                const digest = async (value: string) =>
                  Array.from(
                    new Uint8Array(
                      await crypto.subtle.digest(
                        "SHA-256",
                        new TextEncoder().encode(value),
                      ),
                    ),
                    (b) => b.toString(16).padStart(2, "0"),
                  ).join("");
                const document_hash = await digest(
                  text.replace(/\s+/g, " ").trim(),
                );
                const document_key = await digest(
                  JSON.stringify([
                    document_hash,
                    d.page,
                    d.deadline,
                    d.evidence.replace(/\s+/g, " ").trim(),
                  ]),
                );
                add(d, {
                  course_id: courseId,
                  source_url: sourceUrl,
                  document_name: documentName,
                  document_hash,
                  document_key,
                  target_id: targets[i] || undefined,
                });
              } catch {
                setLocalError(
                  "Could not prepare document evidence. Nothing was saved.",
                );
              } finally {
                setReading(false);
              }
            }}
          >
            {tx("Review and save")}
          </button>
        </article>
      ))}
      {results?.length === 0 && (
        <p className="muted">
          {tx(
            "No supported, evidenced dates found. Dates in other formats, images, or without explicit times may have been missed. This does not prove there are no deadlines.",
          )}
        </p>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
