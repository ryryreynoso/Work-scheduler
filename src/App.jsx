import React, { useEffect, useMemo, useState } from "react";
import {
  Upload,
  User,
  FileSpreadsheet,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const App = () => {
  const [data, setData] = useState([]);
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = useState("mySchedule");
  const [dayTasks, setDayTasks] = useState(null);
  const [filter, setFilter] = useState("all");
  const [uploadInfo, setUploadInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasWindow = typeof window !== "undefined";
  const storage = hasWindow ? window.localStorage : null;

  // ---------------------------
  // Firestore Helpers (shared schedule)
  // ---------------------------
  const rowsRef = collection(db, "schedule", "current", "rows");
  const metaRef = doc(db, "schedule", "current");

  async function saveScheduleToFirestore(rows) {
    // NOTE: Firestore batch limit is 500 operations.
    // If your schedule could exceed ~450 rows, tell me and I'll upgrade this to chunked batches.
    const batch = writeBatch(db);

    // Delete old rows
    const existing = await getDocs(rowsRef);
    existing.forEach((snap) => batch.delete(snap.ref));

    // Add new rows (use stable ids)
    rows.forEach((row, idx) => {
      const rowDocRef = doc(db, "schedule", "current", "rows", String(idx));
      batch.set(rowDocRef, row);
    });

    // Update metadata
    batch.set(
      metaRef,
      {
        updatedAt: serverTimestamp(),
        count: rows.length,
      },
      { merge: true }
    );

    await batch.commit();
  }

  async function clearScheduleInFirestore() {
    const batch = writeBatch(db);
    const existing = await getDocs(rowsRef);
    existing.forEach((snap) => batch.delete(snap.ref));

    batch.set(
      metaRef,
      {
        updatedAt: serverTimestamp(),
        count: 0,
      },
      { merge: true }
    );

    await batch.commit();
  }

  // ---------------------------
  // Load UI prefs from localStorage (NOT schedule data)
  // ---------------------------
  useEffect(() => {
    if (!storage) return;
    try {
      const savedUser = storage.getItem("currentUser");
      const savedView = storage.getItem("viewMode");
      const savedFilter = storage.getItem("testFilter");
      if (savedUser) setUser(savedUser);
      if (savedView) setView(savedView);
      if (savedFilter) setFilter(savedFilter);
    } catch (err) {
      console.error("Error loading prefs:", err);
    }
  }, [storage]);

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

  // ---------------------------
  // Subscribe to Firestore schedule (shared for everyone)
  // ---------------------------
  useEffect(() => {
    setLoading(true);

    const q = query(rowsRef, orderBy("date", "asc"));
    const unsubRows = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setData(rows);

        // Set default user if none selected
        setUser((prev) => prev || rows[0]?.person || "");
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Could not load schedule from server.");
        setLoading(false);
      }
    );

    const unsubMeta = onSnapshot(
      metaRef,
      (snap) => {
        const meta = snap.data();
        if (meta?.updatedAt?.toDate) {
          const dt = meta.updatedAt.toDate();
          setUploadInfo(
            dt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          );
        }
      },
      (err) => console.error("Meta snapshot error:", err)
    );

    return () => {
      unsubRows();
      unsubMeta();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Date Helpers
  // ---------------------------
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

  // ---------------------------
  // Derived Data
  // ---------------------------
  const people = useMemo(
    () => [...new Set(data.map((i) => i.person))].sort(),
    [data]
  );

  const tests = useMemo(
    () => [...new Set(data.map((i) => i.test))].sort(),
    [data]
  );

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

  // ---------------------------
  // Upload Handler (save to Firestore) - UPDATED
  // ---------------------------
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

        console.log("Raw Excel data (first 3 rows):", json.slice(0, 3));
        console.log("Available columns:", json[0] ? Object.keys(json[0]) : []);

        if (json.length === 0) {
          setError("The Excel file appears to be empty.");
          return;
        }

        // Get column names (case-insensitive matching)
        const firstRow = json[0];
        const columns = Object.keys(firstRow);
        
        // Helper function to find column (case-insensitive)
        const findColumn = (possibleNames) => {
          const lowerColumns = columns.map(c => c.toLowerCase());
          for (const name of possibleNames) {
            const idx = lowerColumns.indexOf(name.toLowerCase());
            if (idx !== -1) return columns[idx];
          }
          return null;
        };

        // Map column names
        const dateCol = findColumn(['Date', 'date', 'Date/Time', 'DateTime', 'Test Date']);
        const nameCol = findColumn(['Name', 'name', 'Person', 'person', 'Employee', 'Technician', 'Tech']);
        const testCol = findColumn(['Test', 'test', 'Test Type', 'TestType', 'Service']);
        const timeCol = findColumn(['Time', 'time', 'Start Time', 'StartTime']);
        const locationCol = findColumn(['Location', 'location', 'Site', 'Address']);
        const zipCol = findColumn(['Zip Code', 'ZipCode', 'Zip', 'ZIP', 'Postal Code', 'zip code']);
        const testIdCol = findColumn(['Test ID', 'TestID', 'ID', 'Job ID', 'JobID', 'test id']);
        const mepCol = findColumn(['MEP Description', 'Mep description', 'MEP', 'mep', 'Description', 'Notes']);

        console.log("Mapped columns:", {
          date: dateCol,
          name: nameCol,
          test: testCol,
          time: timeCol,
          location: locationCol,
          zip: zipCol,
          testId: testIdCol,
          mep: mepCol
        });

        // Check required columns
        const missing = [];
        if (!dateCol) missing.push('Date');
        if (!nameCol) missing.push('Name/Person');
        if (!testCol) missing.push('Test');

        if (missing.length > 0) {
          setError(
            `Missing required columns: ${missing.join(', ')}.\n\n` +
            `Found columns: ${columns.join(', ')}\n\n` +
            `Please ensure your Excel file has columns for Date, Name/Person, and Test.`
          );
          return;
        }

        const proc = [];
        const errors = [];

        json.forEach((r, idx) => {
          const dateValue = r[dateCol];
          const personValue = r[nameCol];
          const testValue = r[testCol];

          // Skip empty rows
          if (!personValue && !testValue && !dateValue) return;

          // Validate required fields
          if (!personValue) {
            errors.push(`Row ${idx + 2}: Missing person name`);
            return;
          }
          if (!testValue) {
            errors.push(`Row ${idx + 2}: Missing test type`);
            return;
          }
          if (!dateValue) {
            errors.push(`Row ${idx + 2}: Missing date`);
            return;
          }

          // Parse date
          let date;
          try {
            if (typeof dateValue === "number") {
              // Excel serial date
              date = new Date((dateValue - 25569) * 86400 * 1000)
                .toISOString()
                .split("T")[0];
            } else if (typeof dateValue === "string") {
              // Try to parse string date
              const parsed = new Date(dateValue);
              if (isNaN(parsed.getTime())) {
                errors.push(`Row ${idx + 2}: Invalid date format "${dateValue}"`);
                return;
              }
              date = parsed.toISOString().split("T")[0];
            } else {
              errors.push(`Row ${idx + 2}: Unexpected date format`);
              return;
            }
          } catch (err) {
            errors.push(`Row ${idx + 2}: Could not parse date "${dateValue}"`);
            return;
          }

          proc.push({
            test: String(testValue).trim(),
            date,
            person: String(personValue).trim(),
            time: timeCol && r[timeCol] ? String(r[timeCol]).trim() : null,
            location: locationCol && r[locationCol] ? String(r[locationCol]).trim() : null,
            zipCode: zipCol && r[zipCol] ? String(r[zipCol]).trim() : null,
            testId: testIdCol && r[testIdCol] ? String(r[testIdCol]).trim() : null,
            mep: mepCol && r[mepCol] ? String(r[mepCol]).trim() : null,
          });
        });

        console.log(`Processed ${proc.length} valid rows`);
        console.log("Sample processed data:", proc.slice(0, 3));

        if (errors.length > 0) {
          console.warn("Errors during import:", errors);
          setError(
            `Import completed with warnings:\n\n${errors.slice(0, 5).join('\n')}` +
            (errors.length > 5 ? `\n\n...and ${errors.length - 5} more errors` : '')
          );
        }

        if (proc.length === 0) {
          setError("No valid data found in file. Please check the format and try again.");
          return;
        }

        await saveScheduleToFirestore(proc);

        if (!user && proc.length > 0) {
          setUser(proc[0].person);
        }

        // Show success message
        if (errors.length === 0) {
          setError(""); // Clear any previous errors
          alert(`Successfully imported ${proc.length} schedule entries!`);
        }

      } catch (err) {
        console.error("Upload error:", err);
        setError(`Error reading file: ${err.message}`);
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

  // ---------------------------
  // Clear All Data (clears Firestore)
  // ---------------------------
  const clearAllData = async () => {
    if (!hasWindow) return;
    if (window.confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      try {
        await clearScheduleInFirestore();
        setData([]);
        setUser("");
        setView("mySchedule");
        setFilter("all");
        setError("");
      } catch (err) {
        console.error(err);
        setError("Could not clear schedule from server.");
      }
    }
  };

  // ---------------------------
  // UI Components (polished)
  // ---------------------------
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

  const panel =
    "bg-gray-900/60 rounded-2xl shadow-2xl shadow-black/30 p-6 border border-white/10 backdrop-blur";
  const headerPanel =
    "bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl shadow-2xl shadow-black/40 p-5 border border-white/10";
  const selectClass =
    "p-3 border border-white/10 rounded-xl bg-black/30 text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  // ---------------------------
  // Render
  // ---------------------------
  if (loading && data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 p-6 text-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className={headerPanel}>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Work Schedule
            </h1>
            <p className="text-sm text-gray-400 mt-1">Loading schedule…</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 p-6 text-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className={`${headerPanel} mb-6`}>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Work Schedule
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Upload your schedule to get started
            </p>
          </div>

          <div className={panel}>
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="text-indigo-400" size={22} />
              <h2 className="text-lg font-semibold text-white">Upload Schedule</h2>
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
        <div className={`${headerPanel} mb-6`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                Work Schedule
              </h1>
              <p className="text-sm text-gray-400 mt-1">Manage your schedule</p>
              {uploadInfo && (
                <p className="text-xs text-gray-400/80 mt-1">
                  Last uploaded: {uploadInfo}
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

        <div className={panel}>
          {/* Sticky Controls */}
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
                {[
                  ["mySchedule", "My Weekly"],
                  ["teamWeekly", "Team Weekly"],
                  ["monthly", "Monthly"],
                  ["list", "List"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`py-2 rounded-xl text-sm font-semibold transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]
                    ${
                      view === key
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                        : "bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* VIEWS */}
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
                      const prev = new Date(y, m - 2, 1);
                      setMonth(prev.toISOString().slice(0, 7));
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
                      This Month
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const [y, m] = month.split("-").map(Number);
                      const next = new Date(y, m, 1);
                      setMonth(next.toISOString().slice(0, 7));
                    }}
                    className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 rounded-lg text-gray-200 flex items-center gap-1 transition ring-1 ring-white/10 hover:ring-white/20 active:scale-[0.98]"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-4">
                My Monthly Calendar
              </h3>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-sm text-gray-400 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const tasks = calTasks[day.date] || [];
                  return (
                    <button
                      key={day.date}
                      onClick={() => setDayTasks(tasks.length > 0 ? day.date : null)}
                      className={`min-h-[100px] rounded-xl p-2 border transition text-left
                        ${
                          day.isToday
                            ? "border-indigo-400/60 bg-indigo-500/10"
                            : day.isCurrentMonth
                            ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                            : "border-white/5 bg-black/20"
                        }
                        ${tasks.length > 0 ? "cursor-pointer" : "cursor-default"}
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            day.isCurrentMonth ? "text-white" : "text-gray-500"
                          }`}
                        >
                          {day.dayNum}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                            Today
                          </span>
                        )}
                      </div>

                      {tasks.length > 0 && (
                        <div className="space-y-1">
                          {tasks.slice(0, 2).map((t) => (
                            <div
                              key={t.id}
                              className="text-[10px] bg-blue-500/20 border border-blue-400/30 text-blue-100 px-1.5 py-1 rounded truncate"
                            >
                              {t.test}
                            </div>
                          ))}
                          {tasks.length > 2 && (
                            <div className="text-[9px] text-gray-400 px-1">
                              +{tasks.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {dayTasks && (
                <div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setDayTasks(null)}
                >
                  <div
                    className="bg-gray-900 rounded-2xl border border-white/20 p-6 max-w-lg w-full max-h-[80vh] overflow-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {new Date(`${dayTasks}T00:00:00`).toLocaleDateString(
                          "en-US",
                          { weekday: "long", month: "long", day: "numeric" }
                        )}
                      </h3>
                      <button
                        onClick={() => setDayTasks(null)}
                        className="text-gray-400 hover:text-white transition text-2xl leading-none"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(calTasks[dayTasks] || []).map((t) => (
                        <div
                          key={t.id}
                          className="border border-white/10 rounded-xl p-3 bg-black/30"
                        >
                          <h4 className="font-semibold text-white mb-2">{t.test}</h4>
                          <div className="text-sm text-gray-300 space-y-1">
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
                            {t.zipCode && (
                              <div>
                                <span className="font-semibold">Zip: </span>
                                {t.zipCode}
                              </div>
                            )}
                            {t.testId && (
                              <div>
                                <span className="font-semibold">Test ID: </span>
                                {t.testId}
                              </div>
                            )}
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
            <>
              <h3 className="text-lg font-semibold text-white mb-4">
                {user ? `${user}'s Schedule` : "All Schedules"}
              </h3>

              <div className="space-y-3">
                {filtered
                  .filter((t) => !user || t.person === user)
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((t) => (
                    <div
                      key={t.id}
                      className="border border-white/10 rounded-2xl p-4 bg-white/5 hover:bg-white/10 transition"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                        <div>
                          <h4 className="font-semibold text-white text-base mb-1">
                            {t.test}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs bg-blue-500/10 border border-blue-400/20 text-blue-200 px-2 py-1 rounded-lg">
                              {t.person}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(`${t.date}T00:00:00`).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {t.mep && (
                          <div className="bg-indigo-500/10 border border-indigo-400/20 px-3 py-2 rounded-xl text-indigo-200">
                            <span className="font-bold">MEP: </span>
                            {t.mep}
                          </div>
                        )}
                        <div className="text-gray-300">
                          <span className="font-semibold">Location: </span>
                          {t.location || "N/A"}
                        </div>
                        <div className="text-gray-300">
                          <span className="font-semibold">Time: </span>
                          {t.time || "N/A"}
                        </div>
                        {t.zipCode && (
                          <div className="text-gray-300">
                            <span className="font-semibold">Zip Code: </span>
                            {t.zipCode}
                          </div>
                        )}
                        {t.testId && (
                          <div className="text-gray-300">
                            <span className="font-semibold">Test ID: </span>
                            {t.testId}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {filtered.filter((t) => !user || t.person === user).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No tests found</p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-8">
            <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold text-white">Update Schedule</div>
                  <div className="text-xs text-gray-400/90">
                    Upload a new Excel file anytime (updates for everyone)
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
