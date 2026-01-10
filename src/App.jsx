import React, { useState, useMemo, useEffect } from "react";
import {
  Upload,
  User,
  FileSpreadsheet,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";

const App = () => {
  const [data, setData] = useState([]);
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = useState("mySchedule");
  const [dayTasks, setDayTasks] = useState(null);
  const [filter, setFilter] = useState("all");

  const hasWindow = typeof window !== "undefined";
  const storage = hasWindow ? window.localStorage : null;

  useEffect(() => {
    if (!storage) return;
    try {
      const savedData = storage.getItem("scheduleData");
      const savedUser = storage.getItem("currentUser");
      const savedView = storage.getItem("viewMode");
      const savedFilter = storage.getItem("testFilter");

      if (savedData) setData(JSON.parse(savedData));
      if (savedUser) setUser(savedUser);
      if (savedView) setView(savedView);
      if (savedFilter) setFilter(savedFilter);
    } catch (err) {
      console.error("Error loading saved data:", err);
    }
  }, [storage]);

  useEffect(() => {
    if (!storage) return;
    if (data.length > 0) storage.setItem("scheduleData", JSON.stringify(data));
  }, [data, storage]);

  useEffect(() => {
    if (!storage) return;
    if (user) storage.setItem("currentUser", user);
  }, [user, storage]);

  useEffect(() => {
    if (!storage) return;
    storage.setItem("viewMode", view);
  }, [view, storage]);

  useEffect(() => {
    if (!storage) return;
    storage.setItem("testFilter", filter);
  }, [filter, storage]);

  const getSaturday = (d) => {
    const date = new Date(d);
    date.setHours(12, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 6 ? 0 : day + 1));
    return date.toISOString().split("T")[0];
  };

  useEffect(() => {
    if (!weekStart) setWeekStart(getSaturday(new Date()));
  }, [weekStart]);

  const people = useMemo(
    () => [...new Set(data.map((i) => i.person))].sort(),
    [data]
  );
  const tests = useMemo(() => [...new Set(data.map((i) => i.test))].sort(), [
    data,
  ]);
  const filtered = useMemo(
    () => (filter === "all" ? data : data.filter((i) => i.test === filter)),
    [data, filter]
  );

  const weekDates = useMemo(() => {
    if (!weekStart) return [];
    const dates = [];
    const start = new Date(`${weekStart}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [weekStart]);

  const allWeek = useMemo(() => {
    const t = {};
    weekDates.forEach((d) => {
      t[d] = filtered
        .filter((i) => new Date(i.date).toISOString().split("T")[0] === d)
        .sort(
          (a, b) =>
            a.person.localeCompare(b.person) || a.test.localeCompare(b.test)
        );
    });
    return t;
  }, [filtered, weekDates]);

  const myWeek = useMemo(() => {
    const t = {};
    weekDates.forEach((d) => {
      t[d] = filtered
        .filter(
          (i) =>
            i.person === user &&
            new Date(i.date).toISOString().split("T")[0] === d
        )
        .sort((a, b) => a.test.localeCompare(b.test));
    });
    return t;
  }, [filtered, user, weekDates]);

  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysBack = firstDay.getDay() === 6 ? 0 : firstDay.getDay() + 1;

    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - daysBack);

    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === m - 1,
        isToday: dateStr === new Date().toISOString().split("T")[0],
      });
    }
    return days;
  }, [month]);

  const calTasks = useMemo(() => {
    if (!user) return {};
    const t = {};
    filtered.forEach((i) => {
      if (i.person === user) {
        const d = new Date(i.date).toISOString().split("T")[0];
        if (!t[d]) t[d] = [];
        t[d].push(i);
      }
    });
    return t;
  }, [filtered, user]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {
          type: "array",
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

        const proc = [];
        json.forEach((r, i) => {
          const d = r.Date || r.date;
          const p = r.Name || r.name || "";
          const t = r.Test || r.test || "";

          if (p && t && d) {
            let date;
            if (typeof d === "number") {
              date = new Date((d - 25569) * 86400 * 1000)
                .toISOString()
                .split("T")[0];
            } else {
              date = new Date(d).toISOString().split("T")[0];
            }

            proc.push({
              id: `${i}`,
              test: String(t).trim(),
              date,
              person: String(p).trim(),
              time: r.Time || r.time || null,
              location: r.Location || r.location || null,
              zipCode: r["Zip Code"] || r.ZipCode || null,
              testId: r["Test ID"] || r.TestID || null,
              mep: r["MEP Description"] || r.MEP || null,
            });
          }
        });

        if (proc.length === 0) {
          setError("No valid data");
          return;
        }

        setData(proc);
        if (!user) setUser(proc[0].person);
        storage?.setItem("uploadTimestamp", new Date().toISOString());
      } catch (err) {
        console.error(err);
        setError("Error reading file");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const fmt = (ds) => {
    const d = new Date(`${ds}T00:00:00`);
    return {
      short: d.toLocaleDateString("en-US", { weekday: "short" }),
      long: d.toLocaleDateString("en-US", { weekday: "long" }),
      num: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      today: ds === new Date().toISOString().split("T")[0],
    };
  };

  const clearAllData = () => {
    if (!hasWindow) return;
    if (
      window.confirm(
        "Are you sure you want to clear all data? This cannot be undone."
      )
    ) {
      storage?.clear();
      setData([]);
      setUser("");
      setView("mySchedule");
      setFilter("all");
      setError("");
    }
  };

  const getUploadInfo = () => {
    const timestamp = storage?.getItem("uploadTimestamp");
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const WeekNav = () => (
    <div className="bg-gray-950/60 rounded-2xl border border-white/10 p-4 mb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            const c = new Date(weekStart);
            c.setDate(c.getDate() - 7);
            setWeekStart(c.toISOString().split("T")[0]);
          }}
          className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-gray-200 flex items-center gap-1 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
        >
          <ChevronLeft size={18} />
          Prev
        </button>

        <div className="text-center">
          <h3 className="font-semibold text-white">
            Week of{" "}
            {weekDates[0] &&
              new Date(`${weekDates[0]}T00:00:00`).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
          </h3>
          <button
            onClick={() => setWeekStart(getSaturday(new Date()))}
            className="text-indigo-400 text-xs mt-1 hover:text-indigo-300 transition"
          >
            Today
          </button>
        </div>

        <button
          onClick={() => {
            const c = new Date(weekStart);
            c.setDate(c.getDate() + 7);
            setWeekStart(c.toISOString().split("T")[0]);
          }}
          className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-gray-200 flex items-center gap-1 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  // Shared classes (polish)
  const panel =
    "bg-gray-900/60 rounded-2xl shadow-2xl shadow-black/30 p-6 border border-white/10 backdrop-blur";
  const headerPanel =
    "bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl shadow-2xl shadow-black/40 p-5 border border-white/10";
  const selectClass =
    "p-3 border border-white/10 rounded-xl bg-black/30 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 p-6 text-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className={`${headerPanel} mb-6`}>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Work Scheduler
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Upload your schedule to get started
            </p>
          </div>

          <div className={panel}>
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="text-indigo-400" size={22} />
              <h2 className="text-lg font-semibold text-white">
                Upload Schedule
              </h2>
            </div>

            <div className="border-2 border-dashed border-white/15 rounded-2xl p-10 text-center bg-white/5 hover:border-indigo-400/60 hover:bg-indigo-500/5 transition">
              <Upload className="mx-auto text-gray-400 mb-3" size={44} />
              <label className="cursor-pointer">
                <span className="text-indigo-300 hover:text-indigo-200 font-semibold text-base">
                  Click to upload Excel file
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-950/60 border border-red-500/30 rounded-2xl flex items-start gap-2">
                <AlertCircle className="text-red-300" size={18} />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-200">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${headerPanel} mb-6`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                Work Scheduler
              </h1>
              <p className="text-sm text-gray-400 mt-1">Manage your schedule</p>
              {getUploadInfo() && (
                <p className="text-xs text-gray-400/80 mt-1">
                  Last uploaded: {getUploadInfo()}
                </p>
              )}
            </div>

            <button
              onClick={clearAllData}
              className="px-4 py-2 rounded-xl font-semibold text-sm bg-red-950/60 text-red-100 border border-red-500/30 hover:bg-red-900/60 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
            >
              Clear All Data
            </button>
          </div>
        </div>

        {/* Main */}
        <div className={panel}>
          {/* Sticky controls (mobile-friendly) */}
          <div className="sticky top-3 z-30 bg-gray-900/80 backdrop-blur rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-2 block flex items-center gap-2">
                    <User size={14} />I am
                  </label>
                  <select
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className={selectClass}
                  >
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-2 block flex items-center gap-2">
                    <FileSpreadsheet size={14} />
                    Filter
                  </label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className={selectClass}
                  >
                    <option value="all">All Tests</option>
                    {tests.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                <button
                  onClick={() => setView("mySchedule")}
                  className={`py-2 rounded-xl text-sm font-semibold transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]
                  ${
                    view === "mySchedule"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  My Weekly
                </button>

                <button
                  onClick={() => setView("teamWeekly")}
                  className={`py-2 rounded-xl text-sm font-semibold transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]
                  ${
                    view === "teamWeekly"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  Team Weekly
                </button>

                <button
                  onClick={() => setView("monthly")}
                  className={`py-2 rounded-xl text-sm font-semibold transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]
                  ${
                    view === "monthly"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  Monthly
                </button>

                <button
                  onClick={() => setView("list")}
                  className={`py-2 rounded-xl text-sm font-semibold transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]
                  ${
                    view === "list"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {view === "mySchedule" && (
            <>
              <WeekNav />
              <h3 className="text-lg font-semibold text-white mb-4">
                My Weekly Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {weekDates.map((date) => {
                  const { short, long, num, today } = fmt(date);
                  const tasks = myWeek[date] || [];

                  return (
                    <div
                      key={date}
                      className={`rounded-2xl p-4 border transition
                      ${
                        today
                          ? "border-indigo-400/60 bg-indigo-500/10 shadow-md shadow-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="mb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-white text-sm">
                              {short}
                            </h4>
                            <p className="text-xs text-gray-400/90">{long}</p>
                          </div>
                          {today && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 mt-1">{num}</p>
                      </div>

                      {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400/80 text-center py-4">
                          No tests
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((t) => (
                            <div
                              key={t.id}
                              className="border border-white/10 rounded-xl p-2 bg-black/30"
                            >
                              <h4 className="font-semibold text-white text-sm mb-1">
                                {t.test}
                              </h4>
                              <div className="text-xs text-gray-300 space-y-0.5">
                                {t.mep && (
                                  <div className="bg-indigo-500/10 border border-indigo-400/20 px-2 py-1 rounded-lg text-indigo-200">
                                    <span className="font-bold">MEP: </span>
                                    {t.mep}
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold">
                                    Location:{" "}
                                  </span>
                                  {t.location || "N/A"}
                                </div>
                                <div>
                                  <span className="font-semibold">Time: </span>
                                  {t.time || "N/A"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view === "teamWeekly" && (
            <>
              <WeekNav />
              <h3 className="text-lg font-semibold text-white mb-4">
                Team Weekly Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {weekDates.map((date) => {
                  const { short, long, num, today } = fmt(date);
                  const tasks = allWeek[date] || [];

                  return (
                    <div
                      key={date}
                      className={`rounded-2xl p-4 border transition
                      ${
                        today
                          ? "border-indigo-400/60 bg-indigo-500/10 shadow-md shadow-indigo-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="mb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-white text-sm">
                              {short}
                            </h4>
                            <p className="text-xs text-gray-400/90">{long}</p>
                          </div>
                          {today && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 mt-1">{num}</p>
                      </div>

                      {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400/80 text-center py-4">
                          No tests
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((t) => (
                            <div
                              key={t.id}
                              className="border border-white/10 rounded-xl p-2 bg-black/30"
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-white text-sm">
                                  {t.test}
                                </h4>
                                <span className="text-[10px] bg-blue-500/10 border border-blue-400/20 text-blue-200 px-2 py-0.5 rounded-full">
                                  {t.person}
                                </span>
                              </div>

                              <div className="text-xs text-gray-300 space-y-0.5">
                                {t.mep && (
                                  <div className="bg-indigo-500/10 border border-indigo-400/20 px-2 py-1 rounded-lg text-indigo-200">
                                    <span className="font-bold">MEP: </span>
                                    {t.mep}
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold">Loc: </span>
                                  {t.location || "N/A"}
                                </div>
                                <div>
                                  <span className="font-semibold">Time: </span>
                                  {t.time || "N/A"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view === "monthly" && (
            <>
              <div className="bg-gray-950/60 rounded-2xl border border-white/10 p-4 mb-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const [y, m] = month.split("-").map(Number);
                      const d = new Date(y, m - 2, 1);
                      setMonth(d.toISOString().slice(0, 7));
                    }}
                    className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-gray-200 flex items-center gap-1 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
                  >
                    <ChevronLeft size={18} />
                    Prev
                  </button>

                  <div className="text-center">
                    <h3 className="font-semibold text-white">
                      {new Date(`${month}-01`).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <button
                      onClick={() =>
                        setMonth(new Date().toISOString().slice(0, 7))
                      }
                      className="text-indigo-400 text-xs mt-1 hover:text-indigo-300 transition"
                    >
                      Today
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const [y, m] = month.split("-").map(Number);
                      const d = new Date(y, m, 1);
                      setMonth(d.toISOString().slice(0, 7));
                    }}
                    className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-gray-200 flex items-center gap-1 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <div
                    key={d}
                    className="text-center font-semibold text-xs py-2 bg-white/5 rounded-xl text-gray-300 border border-white/10"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day, i) => {
                  const tasks = calTasks[day.date] || [];
                  return (
                    <div
                      key={i}
                      onClick={() =>
                        tasks.length > 0 &&
                        setDayTasks({ date: day.date, tasks })
                      }
                      className={`min-h-24 border rounded-2xl p-2 transition
                      ${
                        tasks.length > 0
                          ? "cursor-pointer hover:bg-white/10 hover:border-indigo-400/60"
                          : ""
                      }
                      ${
                        day.isToday
                          ? "bg-indigo-500/10 border-indigo-400/60"
                          : day.isCurrentMonth
                          ? "bg-white/5 border-white/10"
                          : "bg-black/20 border-white/5"
                      }`}
                    >
                      <div className="flex justify-between mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            day.isToday
                              ? "text-indigo-300"
                              : day.isCurrentMonth
                              ? "text-gray-200"
                              : "text-gray-500"
                          }`}
                        >
                          {day.dayNum}
                        </span>
                        {day.isToday && (
                          <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                            Today
                          </span>
                        )}
                      </div>

                      {tasks.length > 0 && (
                        <div className="space-y-1">
                          {tasks.slice(0, 3).map((t) => (
                            <div
                              key={t.id}
                              className="text-[11px] bg-indigo-500/10 border border-indigo-400/20 text-indigo-200 px-2 py-1 rounded-lg truncate"
                            >
                              {t.test}
                            </div>
                          ))}
                          {tasks.length > 3 && (
                            <div className="text-[11px] text-gray-400 text-center">
                              +{tasks.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {dayTasks && (
                <div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                  onClick={() => setDayTasks(null)}
                >
                  <div
                    className="bg-gray-950/80 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-gray-950/80 backdrop-blur border-b border-white/10 p-4 flex justify-between">
                      <h3 className="text-lg font-bold text-white">
                        {new Date(
                          `${dayTasks.date}T00:00:00`
                        ).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>
                      <button
                        onClick={() => setDayTasks(null)}
                        className="text-gray-300 hover:text-white text-2xl font-bold transition"
                      >
                        ×
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      {dayTasks.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="border border-white/10 rounded-2xl p-4 bg-white/5"
                        >
                          <h4 className="font-semibold text-white mb-2">
                            {t.test}
                          </h4>
                          <div className="space-y-1 text-sm text-gray-200/90">
                            {t.mep && (
                              <div className="bg-indigo-500/10 border border-indigo-400/20 px-2 py-1 rounded-lg text-indigo-200">
                                <span className="font-bold">MEP: </span>
                                {t.mep}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold">Location: </span>
                              {t.location || "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">Time: </span>
                              {t.time || "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">ID: </span>
                              {t.testId || "N/A"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {view === "list" && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                My Schedule
              </h3>
              <div className="overflow-x-auto border border-white/10 rounded-2xl bg-white/5">
                <table className="w-full">
                  <thead className="bg-black/30 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase">
                        Test
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase">
                        MEP
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-300 uppercase">
                        Time
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {filtered
                      .filter((i) => i.person === user)
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-white/5 transition">
                          <td className="px-4 py-3 text-sm text-gray-200">
                            {new Date(`${t.date}T00:00:00`).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-white">
                            {t.test}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-200/90">
                            {t.mep ? (
                              <span className="bg-indigo-500/10 border border-indigo-400/20 px-2 py-1 rounded-lg text-indigo-200">
                                {t.mep}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-200/90">
                            {t.location || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-200/90">
                            {t.time || "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Optional: quick re-upload inside app (nice UX) */}
          <div className="mt-8">
            <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold text-white">Update Schedule</div>
                  <div className="text-xs text-gray-400/90">
                    Upload a new Excel file anytime
                  </div>
                </div>

                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]">
                    <Upload size={16} />
                    Upload New File
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-950/60 border border-red-500/30 rounded-xl flex items-start gap-2">
                  <AlertCircle className="text-red-300" size={18} />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
