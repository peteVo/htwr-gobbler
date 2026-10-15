import React, { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import {
  calendarDates,
  shiftCalendarPeriod,
  type CalendarView,
  berlinDay,
  briefing,
  defaultPreferences,
  quietHour,
  type Course,
  type Item,
  type Snapshot,
  type Preferences,
} from "../../../packages/core/index";
import { demo } from "./demo";
import {
  extractExplicitDeadlines,
  type DeadlineCandidate,
  type DocumentPage,
} from "../../../packages/core/deadlines";
import { messages } from "./i18n";
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
type Page = "today" | "tasks" | "calendar" | "courses" | "sources" | "settings";
const navigation = [
  ["today", LayoutDashboard],
  ["tasks", ListTodo],
  ["calendar", CalendarDays],
  ["courses", BookOpen],
  ["sources", Unplug],
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
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const prefs = data.preferences,
    t = messages[prefs.language],
    locale = { en: "en-GB", de: "de-DE", vi: "vi-VN" }[prefs.language];
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
    if (modal) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [modal]);
  useEffect(() => {
    if (
      !email ||
      !prefs.reminders ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const check = () => {
      const now = Date.now(),
        hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            hour: "numeric",
            hourCycle: "h23",
            timeZone: "Europe/Berlin",
          }).format(now),
        );
      if (quietHour(hour, prefs.quiet_start, prefs.quiet_end)) return;
      for (const i of data.items) {
        const due = new Date(i.starts_at).getTime(),
          key = `reminded:${email}:${i.id}:${i.starts_at}`;
        if (
          i.kind === "assignment" &&
          i.status === "open" &&
          due > now &&
          due - now < 86400000 &&
          !localStorage.getItem(key)
        ) {
          new Notification("htwr-gobbler · Deadline approaching", {
            body: `${i.title} · ${stamp(i.starts_at)}`,
          });
          localStorage.setItem(key, "1");
        }
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [email, data.items, prefs]);
  const summary = briefing(data.items, data.sources, clock),
    course = (id: string | null) => data.courses.find((c) => c.id === id),
    isDemo = !email;
  const items = data.items.filter(
    (i) =>
      (!search ||
        `${i.title} ${i.description} ${course(i.course_id)?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
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
  async function act(fn: () => Promise<unknown>, message = "Saved") {
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
          aria-label={`${item.status === "done" ? "Reopen" : "Complete"} ${item.title}`}
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
            {c?.name || (item.source_id ? "Module not provided" : "Personal")}
          </span>
          <strong>{item.title}</strong>
          <span className="task-meta">
            <Clock3 size={12} />
            {stamp(
              item.starts_at,
              item.all_day ? { dateStyle: "medium" } : undefined,
            )}
            {item.all_day && " · all day"}
            <span
              className={`verification ${item.verification === "needs_review" || outdated ? "review" : ""}`}
            >
              {outdated ? (
                "Source outdated"
              ) : item.verification === "needs_review" ? (
                t.review
              ) : (
                <>
                  <ShieldCheck size={11} />{" "}
                  {isDemo ? "Demo verified" : "Confirmed"}
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
            aria-label={`Open original source for ${item.title}`}
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
        {summary.healthy} of {summary.total} sources checked within the last
        hour.
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
                ? "Last success " + stamp(s.last_success)
                : "Never checked"}
            </span>
          </div>
          <span
            className={`source-state ${sourceCurrent(s) ? "" : "warning-text"}`}
          >
            {s.status === "connected" && !sourceCurrent(s)
              ? "Check outdated"
              : t[s.status as keyof typeof t] || s.status}
          </span>
        </div>
      ))}
      {!data.sources.length && (
        <p className="muted">
          Connect a calendar to check its published events.
        </p>
      )}
      <div className="coverage-note">
        <CircleAlert size={15} />
        <span>
          Calendar coverage only. PDFs, announcements and submissions have not
          been checked.
        </span>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a href="#today" className="brand" onClick={() => setPage("today")}>
          <img src="/icon.svg" width="35" height="35" alt="" />
          <span>
            htwr<span className="brand-dash">–</span>gobbler
            <small>YOUR ACADEMIC SPACE</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace">
          <span className="university-mark">rwth</span>
          <div>
            <strong>RWTH Aachen</strong>
            <small>Winter semester 26/27</small>
          </div>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(([key, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => {
                setPage(key);
                setMobile(false);
                setSearch("");
                setCourseFilter("");
                setTypeFilter("assignment");
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
            A clearer head.
            <br />A little more headspace.
          </p>
          <div className="account">
            <span className="avatar">
              {email ? email[0].toUpperCase() : "G"}
            </span>
            <div>
              <strong>{email || "Explore the demo"}</strong>
              <small>
                {email ? "Personal workspace" : "No real university data"}
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
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{t[page]}</strong>
          </div>
          <label className="search">
            <Search size={17} />
            <input
              aria-label={t.search}
              placeholder={t.search}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) {
                  setPage("tasks");
                  setTypeFilter("");
                }
              }}
            />
            <kbd>/</kbd>
          </label>
          <span className="timezone">Europe / Berlin</span>
        </header>
        <main id="main">
          <div className="demo-strip">
            {isDemo ? (
              <>
                <span className="demo-label">DEMO WORKSPACE</span>
                <span>
                  Sample data. Your university accounts are not connected.
                </span>
                <button onClick={() => setModal("auth")}>
                  {t.signin}
                  <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="demo-label">PERSONAL WORKSPACE</span>
                <span>
                  Calendar imports cover published events, not every university
                  instruction.
                </span>
              </>
            )}
          </div>
          {!online && (
            <div className="alert" role="status">
              You’re offline. Visible records may be outdated. Reconnect to save
              or check sources.
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
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
                  : "YOUR ACADEMIC SPACE"}
              </p>
              <h1>{page === "today" ? t.headline : t[page]}</h1>
              <p>
                {page === "today"
                  ? t.sub
                  : page === "tasks"
                    ? "Keep track here. Submit through your course system."
                    : page === "sources"
                      ? "Know what was checked, and what still needs your attention."
                      : "One place for the details of your semester."}
              </p>
            </div>
            <button
              className="primary"
              disabled={loading}
              onClick={() =>
                page === "sources"
                  ? needAccount() || setModal("import")
                  : page === "courses"
                    ? needAccount() ||
                      (setEditingCourse(null), setModal("course"))
                    : edit()
              }
            >
              <Plus size={17} />
              {page === "sources"
                ? t.import
                : page === "courses"
                  ? t.newcourse
                  : t.add}
            </button>
          </div>
          {loading ? (
            <div className="empty">
              <LoaderCircle className="spin" /> Opening your workspace…
            </div>
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
                          ? `${summary.overdue} overdue task${summary.overdue === 1 ? "" : "s"} need a look.`
                          : summary.week
                            ? `${summary.week} assignment${summary.week === 1 ? "" : "s"} due in the next 7 days.`
                            : "A little room to plan ahead."}
                      </h2>
                      <p>
                        {summary.today} open items on today’s calendar.{" "}
                        {summary.total
                          ? `${summary.total - summary.healthy} source${summary.total - summary.healthy === 1 ? "" : "s"} need a fresh check.`
                          : "No university sources have been checked yet."}{" "}
                        {data.items.some(
                          (i) => i.verification === "needs_review",
                        )
                          ? "Some dates still need your review."
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
                        <small>assignments due</small>
                      </span>
                    </div>
                    <div>
                      <span className="metric">
                        {summary.today.toString().padStart(2, "0")}
                      </span>
                      <span>
                        {t.today}
                        <small>scheduled items</small>
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
                        <small>verify the original</small>
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
                          <Empty text="No assignments stored. This does not mean your university has no deadlines." />
                        )}
                      </div>
                      <div className="small muted list-footnote">
                        <ShieldCheck size={14} /> Dates keep their source and
                        verification state.
                      </div>
                    </section>
                    <section className="schedule-section">
                      <div className="section-heading">
                        <h2>{t.schedule}</h2>
                        <span className="tiny-label">TODAY</span>
                      </div>
                      {items
                        .filter(
                          (i) =>
                            berlinDay(i.starts_at) === berlinDay(new Date()) &&
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
                                ? "All day"
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
                        <Empty text="No scheduled events stored for today." />
                      )}
                      <button
                        className="text-button schedule-footer"
                        onClick={() => setPage("calendar")}
                      >
                        Open calendar
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    <section className="activity-section">
                      <div className="section-heading">
                        <h2>{t.activity}</h2>
                        <span className="tiny-label">RECENT ACTIVITY</span>
                      </div>
                      {data.changes.slice(0, 4).map((c) => (
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
                            <span>
                              {c.kind === "added"
                                ? "Added to your workspace"
                                : "Information updated"}{" "}
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
                        <Empty text="Changes will appear here after your first import." />
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
                          key={v}
                          className={filter === v ? "selected" : ""}
                          onClick={() => setFilter(v)}
                        >
                          {t[v as "open"]}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label="Filter course"
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="">All courses</option>
                      {data.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    >
                      <option value="">All types</option>
                      {[
                        "assignment",
                        "lecture",
                        "tutorial",
                        "exam",
                        "study",
                        "announcement",
                        "material",
                      ].map((v) => (
                        <option key={v}>{v}</option>
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
                        <p className="eyebrow">{c.code || "PERSONAL COURSE"}</p>
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
                          open assignments
                        </p>
                        <div className="course-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setCourseFilter(c.id);
                              setPage("tasks");
                            }}
                          >
                            View coursework
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
                            Edit
                          </button>
                        </div>
                      </article>
                    ))}
                  {!data.courses.length && (
                    <Empty text="Add your first course to organize tasks." />
                  )}
                </div>
              )}
              {page === "calendar" && (
                <>
                  <div className="filterbar">
                    <div className="calendar-controls">
                      <button
                        className="icon-button"
                        aria-label="Previous period"
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
                        aria-label="Next period"
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
                          key={v}
                          className={view === v ? "selected" : ""}
                          onClick={() => setView(v as CalendarView)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label="Calendar course"
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="">All courses</option>
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
                                    ? "All day"
                                    : stamp(i.starts_at, {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                </small>
                                {i.kind === "assignment" && (
                                  <small>
                                    {course(i.course_id)?.name ||
                                      "Module not provided"}
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
                    All times Europe/Berlin. Calendar imports may have
                    incomplete coverage.
                  </p>
                </>
              )}
              {page === "sources" && (
                <>
                  <div className="source-intro">
                    <CircleAlert size={21} />
                    <div>
                      <h2>No news isn’t always good news.</h2>
                      <p>
                        A successful calendar check only verifies published
                        calendar events. Review Moodle for exercise PDFs,
                        announcements and submission receipts.
                      </p>
                    </div>
                  </div>
                  <section>{sourceHealth}</section>
                  {["127.0.0.1", "localhost", "[::1]"].includes(
                    location.hostname,
                  ) && (
                    <p className="muted small">
                      Running locally: use Check now to refresh subscriptions.
                      Automatic scheduled checks require the hosted backend.
                    </p>
                  )}
                  <div className="source-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        if (!needAccount()) setModal("feed");
                      }}
                    >
                      <Plus size={16} />
                      Connect Moodle calendar
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
                    <article className="source-detail" key={s.id}>
                      <div>
                        <h3>{s.name}</h3>
                        <p>
                          {s.kind === "file"
                            ? "Manual file import · re-upload to check for changes"
                            : "Calendar subscription · scheduled checks every 30 minutes for up to 10 feeds per run"}
                        </p>
                        {s.error && <p className="warning-text">{s.error}</p>}
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
                          Check now
                        </button>
                      )}
                      <button
                        className="text-button danger"
                        disabled={busy || isDemo}
                        onClick={() => {
                          if (
                            confirm(
                              "Disconnect this source? Stored academic entries will be retained.",
                            )
                          )
                            act(
                              () => api("/sources/" + s.id, "DELETE"),
                              "Source disconnected",
                            );
                        }}
                      >
                        Disconnect
                      </button>
                    </article>
                  ))}
                </>
              )}
              {page === "settings" && (
                <div className="settings-layout">
                  <section>
                    <h2>Make this space yours</h2>
                    <label>
                      {t.language}
                      <select
                        value={prefs.language}
                        onChange={(e) =>
                          changePrefs({
                            ...prefs,
                            language: e.target.value as Preferences["language"],
                          })
                        }
                      >
                        <option value="en">English</option>
                        <option value="de">Deutsch</option>
                        <option value="vi">Tiếng Việt</option>
                      </select>
                    </label>
                    <p className="muted small">
                      Navigation and key labels are translated; detailed help
                      currently uses English.
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
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                    <h2>Reminders, with boundaries</h2>
                    <p className="muted">
                      Reminders work while this app is open. Background push
                      delivery is not implemented.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (needAccount()) return;
                        if (!("Notification" in window)) {
                          setError(
                            "This browser does not support notifications.",
                          );
                          return;
                        }
                        if (
                          !prefs.reminders &&
                          (await Notification.requestPermission()) !== "granted"
                        ) {
                          setError(
                            "Notification permission was denied. Your deadlines are still visible here.",
                          );
                          return;
                        }
                        changePrefs({ ...prefs, reminders: !prefs.reminders });
                      }}
                    >
                      {prefs.reminders
                        ? "Disable reminders"
                        : "Enable foreground reminders"}
                    </button>
                    <div className="field-row">
                      <label>
                        Quiet from (Berlin)
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={prefs.quiet_start}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= 0 && v <= 23)
                              changePrefs({ ...prefs, quiet_start: v });
                          }}
                        />
                      </label>
                      <label>
                        Until
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={prefs.quiet_end}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= 0 && v <= 23)
                              changePrefs({ ...prefs, quiet_end: v });
                          }}
                        />
                      </label>
                    </div>
                  </section>
                  <section>
                    <h2>Optional AI assistance</h2>
                    <p className="muted">
                      Find explicit dates in PDF text locally, with page
                      evidence. Optional AI requires consent. All candidates
                      require review.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        if (!needAccount()) setModal("ai");
                      }}
                    >
                      Review document text
                      <ArrowRight size={15} />
                    </button>
                    <h2>Take your workspace with you</h2>
                    <p className="muted">
                      Install from your browser menu on Windows, Linux or
                      Android. Offline mode stores the app shell only; private
                      records are not cached.
                    </p>
                    {install && (
                      <button
                        className="secondary"
                        onClick={async () => {
                          await install.prompt();
                          setInstall(null);
                        }}
                      >
                        Install gobbler
                      </button>
                    )}
                    <h2>Read-only access for AI clients</h2>
                    <p className="muted">
                      Generate a token for the included MCP server. It can read
                      your records for 30 days; keep it private.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy || isDemo}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          setMcpToken((await api("/mcp-token", "POST")).token);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Generate read-only token
                    </button>
                    {mcpToken && (
                      <label>
                        Copy now · shown once
                        <input
                          readOnly
                          value={mcpToken}
                          aria-label="Read-only MCP token"
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
                      Revoke all tokens
                    </button>
                    <h2>Your data</h2>
                    <p className="muted">
                      Download your stored academic records as JSON. Feed
                      credentials and account secrets are excluded.
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
                      Export my records
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              htwr–gobbler <span className="footer-dot">·</span> A little more
              headspace.
            </span>
            <span>
              Built for your semester. <span className="footer-dot">·</span>{" "}
              Europe/Berlin
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="modal-heading">
          <h2>
            {modal === "auth"
              ? "Your academic space"
              : modal === "item"
                ? editing
                  ? "Edit item"
                  : "Add an academic item"
                : modal === "course"
                  ? editingCourse
                    ? "Edit course"
                    : "Add a course"
                  : modal === "import"
                    ? "Import a calendar"
                    : modal === "feed"
                      ? "Connect Moodle calendar"
                      : "Review document text"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
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
                  "Your personal workspace is ready. Add a course or import a calendar.",
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
              Title
              <input
                name="title"
                required
                maxLength={250}
                defaultValue={editing?.title}
              />
            </label>
            <div className="field-row">
              <label>
                Type
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
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Course
                <select
                  name="course_id"
                  defaultValue={editing?.course_id || ""}
                >
                  <option value="">Personal</option>
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Date & time (this device’s timezone)
              <input
                type="datetime-local"
                name="starts_at"
                required
                defaultValue={editing ? localDate(editing.starts_at) : ""}
              />
            </label>
            <label>
              End date & time (optional)
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
              All-day event
            </label>
            <label>
              Status
              <select name="status" defaultValue={editing?.status || "open"}>
                <option value="open">Open</option>
                <option value="done">Done · not a submission receipt</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </label>
            <label>
              Details
              <textarea
                name="description"
                rows={3}
                maxLength={10000}
                defaultValue={editing?.description}
              />
            </label>
            <label>
              Original source URL
              <input
                type="url"
                name="source_url"
                defaultValue={editing?.source_url}
              />
            </label>
            <label>
              Verification
              <select
                name="verification"
                defaultValue={editing?.verification || "confirmed"}
              >
                <option value="confirmed">
                  Confirmed by me / original source
                </option>
                <option value="needs_review">Needs review</option>
              </select>
            </label>
            <label>
              Evidence / source quotation
              <textarea
                name="evidence"
                maxLength={3000}
                defaultValue={editing?.evidence}
              />
            </label>
            <p className="muted small">
              Save retains the existing completion state. Done does not mean
              submitted. Editing imported dates may be overwritten by the next
              source check.
            </p>
            <div className="modal-actions">
              {editing?.id && (
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => {
                    if (confirm("Delete this item?"))
                      act(
                        () => api("/items/" + editing.id, "DELETE"),
                        "Item deleted",
                      );
                  }}
                >
                  Delete item
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
              Course name
              <input
                name="name"
                required
                maxLength={150}
                defaultValue={editingCourse?.name}
              />
            </label>
            <label>
              Course code
              <input
                name="code"
                maxLength={30}
                defaultValue={editingCourse?.code}
              />
            </label>
            <label>
              Color
              <select
                name="color"
                defaultValue={editingCourse?.color || "sage"}
              >
                {["sage", "blue", "clay", "gold"].map((c) => (
                  <option key={c}>{c}</option>
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
                        "Delete course? Its tasks will remain without a course.",
                      )
                    )
                      act(
                        () => api("/courses/" + editingCourse.id, "DELETE"),
                        "Course deleted",
                      );
                  }}
                >
                  Delete course
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
              Export an .ics calendar from Moodle or RWTHonline. Recurring
              calendars currently require an export of individual events.
            </p>
            <label>
              Source name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue="University calendar"
              />
            </label>
            <label>
              Calendar to update
              <select name="source_id">
                <option value="">Detect automatically</option>
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
              Calendar file
              <input
                name="file"
                type="file"
                accept=".ics,text/calendar"
                required
              />
            </label>
            <p className="muted small">
              Repeat uploads are matched by their event IDs, even if the source
              name changes. For partially overlapping exports, choose the
              existing source above. File imports do not check automatically.
            </p>
            <div className="modal-actions">
              <button className="primary" disabled={busy}>
                {busy ? "Importing…" : t.import}
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
              In your Moodle calendar, choose Import and export → Export
              calendar. Paste your personal HTTPS export URL. Treat it like a
              password.
            </p>
            <label>
              Source name
              <input
                name="name"
                required
                defaultValue="RWTHmoodle calendar"
                maxLength={100}
              />
            </label>
            <label>
              Existing calendar
              <select name="source_id" defaultValue="">
                <option value="">Connect a separate calendar</option>
                {data.sources
                  .filter((s) => s.kind === "file")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      Replace file import: {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="muted small">
              If you already uploaded this calendar, replace that file import to
              preserve its events, modules and completion states. Overlapping
              calendars are rejected during checks.
            </p>
            <label>
              Calendar export URL
              <input type="url" name="url" required autoComplete="off" />
            </label>
            <p className="muted small">
              Only moodle.rwth-aachen.de/calendar/export_execute.php is
              accepted. Feed links are encrypted on the server, never displayed
              again.
            </p>
            <div className="modal-actions">
              <button className="primary" disabled={busy}>
                Connect calendar
              </button>
            </div>
          </form>
        )}
        {modal === "ai" && (
          <AI
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
            add={(d) => {
              setEditing({
                ...blank,
                id: "",
                source_id: null,
                last_verified: null,
                title: d.title,
                starts_at: d.deadline,
                evidence: `${d.document}${d.page ? ` · page ${d.page}` : ""}: ${d.evidence}`,
                verification: "needs_review",
              } as Item);
              setModal("item");
            }}
          />
        )}
      </dialog>
    </div>
  );
}
function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <BookOpen size={23} />
      <p>{text}</p>
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
  const [action, setAction] = useState("login");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(action, Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <p className="muted">
        {action === "register"
          ? "Create an account for your own courses and calendars. Never use your RWTH password here."
          : "Sign in to your gobbler account. This is separate from RWTH SSO."}
      </p>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password · at least 12 characters
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
      <div className="modal-actions">
        <button
          className="text-button"
          type="button"
          onClick={() => setAction(action === "login" ? "register" : "login")}
        >
          {action === "login"
            ? "Create an account"
            : "I already have an account"}
        </button>
        <button className="primary" disabled={busy}>
          {busy
            ? "Opening…"
            : action === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </div>
    </form>
  );
}
function AI({
  extract,
  add,
  busy,
}: {
  extract: (text: string) => Promise<DeadlineCandidate[]>;
  add: (d: DeadlineCandidate) => void;
  busy: boolean;
}) {
  const [results, setResults] = useState<DeadlineCandidate[] | null>(null),
    [pages, setPages] = useState<DocumentPage[]>([]),
    [text, setText] = useState(""),
    [documentName, setDocumentName] = useState("Pasted document"),
    [localError, setLocalError] = useState(""),
    [reading, setReading] = useState(false),
    [consent, setConsent] = useState(false);
  return (
    <>
      <p className="muted">
        Read a PDF locally or paste an excerpt. The local check finds numeric
        German dates with a year and time near deadline wording. Berlin time is
        assumed; every result needs review.
      </p>
      <label>
        Exercise PDF · up to 20 pages, 10 MB
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
                  "Could not read PDF. The document has not been checked.",
              );
            } finally {
              setReading(false);
            }
          }}
        />
      </label>
      {reading && <p role="status">Reading PDF on this device…</p>}
      {localError && (
        <p className="alert error" role="alert">
          {localError}
        </p>
      )}
      <label>
        Document text
        <textarea
          value={text}
          maxLength={20000}
          rows={6}
          onChange={(e) => {
            setText(e.target.value);
            setPages([{ page: null, text: e.target.value }]);
            setDocumentName("Pasted document");
            setResults(null);
          }}
        />
      </label>
      <button
        className="secondary"
        disabled={reading || busy || !text.trim()}
        onClick={() =>
          setResults(extractExplicitDeadlines(pages, documentName))
        }
      >
        Find explicit dates locally
      </button>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I consent to sending this text to the configured OpenAI API provider.
        API usage may incur charges.
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
        {busy ? "Extracting…" : "Use optional AI extraction"}
      </button>
      {results?.map((d, i) => (
        <article key={i} className="candidate">
          <h3>{d.title}</h3>
          <p>
            {d.deadline} · Needs review{d.page ? " · Page " + d.page : ""}
          </p>
          <blockquote>{d.evidence}</blockquote>
          <button className="secondary" onClick={() => add(d)}>
            Review and save
          </button>
        </article>
      ))}
      {results?.length === 0 && (
        <p className="muted">
          No supported, evidenced dates found. Dates in other formats, images,
          or without explicit times may have been missed. This does not prove
          there are no deadlines.
        </p>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
