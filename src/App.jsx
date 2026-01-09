import React, { useState, useMemo, useEffect } from ‘react’;
import { Upload, User, FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight } from ‘lucide-react’;
import * as XLSX from ‘xlsx’;

const App = () => {
const [data, setData] = useState([]);
const [user, setUser] = useState(’’);
const [error, setError] = useState(’’);
const [weekStart, setWeekStart] = useState(’’);
const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
const [view, setView] = useState(‘mySchedule’);
const [dayTasks, setDayTasks] = useState(null);
const [filter, setFilter] = useState(‘all’);

useEffect(() => {
try {
const savedData = localStorage.getItem(‘scheduleData’);
const savedUser = localStorage.getItem(‘currentUser’);
const savedView = localStorage.getItem(‘viewMode’);
const savedFilter = localStorage.getItem(‘testFilter’);

```
  if (savedData) setData(JSON.parse(savedData));
  if (savedUser) setUser(savedUser);
  if (savedView) setView(savedView);
  if (savedFilter) setFilter(savedFilter);
} catch (err) {
  console.error('Error loading saved data:', err);
}
```

}, []);

useEffect(() => {
if (data.length > 0) localStorage.setItem(‘scheduleData’, JSON.stringify(data));
}, [data]);

useEffect(() => {
if (user) localStorage.setItem(‘currentUser’, user);
}, [user]);

useEffect(() => {
localStorage.setItem(‘viewMode’, view);
}, [view]);

useEffect(() => {
localStorage.setItem(‘testFilter’, filter);
}, [filter]);

const getSaturday = (d) => {
const date = new Date(d);
date.setHours(12, 0, 0, 0);
const day = date.getDay();
date.setDate(date.getDate() - (day === 6 ? 0 : day + 1));
return date.toISOString().split(‘T’)[0];
};

useEffect(() => { if (!weekStart) setWeekStart(getSaturday(new Date())); }, [weekStart]);

const people = useMemo(() => […new Set(data.map(i => i.person))].sort(), [data]);
const tests = useMemo(() => […new Set(data.map(i => i.test))].sort(), [data]);
const filtered = useMemo(() => filter === ‘all’ ? data : data.filter(i => i.test === filter), [data, filter]);

const weekDates = useMemo(() => {
if (!weekStart) return [];
const dates = [], start = new Date(weekStart + ‘T00:00:00’);
for (let i = 0; i < 7; i++) {
const d = new Date(start);
d.setDate(start.getDate() + i);
dates.push(d.toISOString().split(‘T’)[0]);
}
return dates;
}, [weekStart]);

const allWeek = useMemo(() => {
const t = {};
weekDates.forEach(d => {
t[d] = filtered.filter(i => new Date(i.date).toISOString().split(‘T’)[0] === d)
.sort((a,b) => a.person.localeCompare(b.person) || a.test.localeCompare(b.test));
});
return t;
}, [filtered, weekDates]);

const myWeek = useMemo(() => {
const t = {};
weekDates.forEach(d => {
t[d] = filtered.filter(i => i.person === user && new Date(i.date).toISOString().split(‘T’)[0] === d)
.sort((a,b) => a.test.localeCompare(b.test));
});
return t;
}, [filtered, user, weekDates]);

const monthDays = useMemo(() => {
const [y, m] = month.split(’-’).map(Number);
const firstDay = new Date(y, m - 1, 1);
let daysBack = firstDay.getDay() === 6 ? 0 : firstDay.getDay() + 1;
const startDate = new Date(firstDay);
startDate.setDate(firstDay.getDate() - daysBack);
const days = [];
for (let i = 0; i < 42; i++) {
const d = new Date(startDate);
d.setDate(startDate.getDate() + i);
const dateStr = d.toISOString().split(‘T’)[0];
days.push({
date: dateStr,
dayNum: d.getDate(),
isCurrentMonth: d.getMonth() === m - 1,
isToday: dateStr === new Date().toISOString().split(‘T’)[0]
});
}
return days;
}, [month]);

const calTasks = useMemo(() => {
if (!user) return {};
const t = {};
filtered.forEach(i => {
if (i.person === user) {
const d = new Date(i.date).toISOString().split(‘T’)[0];
if (!t[d]) t[d] = [];
t[d].push(i);
}
});
return t;
}, [filtered, user]);

const handleUpload = (e) => {
const file = e.target.files[0];
if (!file) return;
setError(’’);
const reader = new FileReader();
reader.onload = (ev) => {
try {
const wb = XLSX.read(new Uint8Array(ev.target.result), {type: ‘array’});
const ws = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(ws, {defval: ‘’, raw: false});
const proc = [];
json.forEach((r, i) => {
const d = r.Date || r.date;
const p = r.Name || r.name || ‘’;
const t = r.Test || r.test || ‘’;
if (p && t && d) {
let date;
if (typeof d === ‘number’) {
date = new Date((d - 25569) * 86400 * 1000).toISOString().split(‘T’)[0];
} else {
date = new Date(d).toISOString().split(‘T’)[0];
}
proc.push({
id: `${i}`, test: t.trim(), date, person: p.trim(),
time: r.Time || r.time || null,
location: r.Location || r.location || null,
zipCode: r[‘Zip Code’] || r.ZipCode || null,
testId: r[‘Test ID’] || r.TestID || null,
mep: r[‘MEP Description’] || r.MEP || null
});
}
});
if (proc.length === 0) { setError(‘No valid data’); return; }
setData(proc);
if (!user) setUser(proc[0].person);
localStorage.setItem(‘uploadTimestamp’, new Date().toISOString());
} catch (err) { setError(‘Error reading file’); }
};
reader.readAsArrayBuffer(file);
};

const fmt = (ds) => {
const d = new Date(ds + ‘T00:00:00’);
return {
short: d.toLocaleDateString(‘en-US’, {weekday: ‘short’}),
long: d.toLocaleDateString(‘en-US’, {weekday: ‘long’}),
num: d.toLocaleDateString(‘en-US’, {month: ‘numeric’, day: ‘numeric’}),
today: ds === new Date().toISOString().split(‘T’)[0]
};
};

const clearAllData = () => {
if (window.confirm(‘Are you sure you want to clear all data? This cannot be undone.’)) {
localStorage.clear();
setData([]);
setUser(’’);
setView(‘mySchedule’);
setFilter(‘all’);
setError(’’);
}
};

const getUploadInfo = () => {
const timestamp = localStorage.getItem(‘uploadTimestamp’);
if (!timestamp) return null;
const date = new Date(timestamp);
return date.toLocaleDateString(‘en-US’, {
month: ‘short’,
day: ‘numeric’,
year: ‘numeric’,
hour: ‘numeric’,
minute: ‘2-digit’
});
};

const WeekNav = () => (
<div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-6">
<div className="flex items-center justify-between">
<button onClick={() => { const c = new Date(weekStart); c.setDate(c.getDate() - 7); setWeekStart(c.toISOString().split(‘T’)[0]); }}
className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 flex items-center gap-2"><ChevronLeft size={20} />Prev</button>
<div className="text-center">
<h3 className="font-semibold text-white">Week of {weekDates[0] && new Date(weekDates[0] + ‘T00:00:00’).toLocaleDateString(‘en-US’, {month: ‘long’, day: ‘numeric’})}</h3>
<button onClick={() => setWeekStart(getSaturday(new Date()))} className="text-indigo-400 text-sm mt-1">Today</button>
</div>
<button onClick={() => { const c = new Date(weekStart); c.setDate(c.getDate() + 7); setWeekStart(c.toISOString().split(‘T’)[0]); }}
className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 flex items-center gap-2">Next<ChevronRight size={20} /></button>
</div>
</div>
);

if (data.length === 0) {
return (
<div className="min-h-screen bg-gray-900 p-6">
<div className="max-w-7xl mx-auto">
<div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
<h1 className="text-3xl font-bold text-white mb-2">Work Scheduler</h1>
<p className="text-gray-400">Upload your schedule to get started</p>
</div>
<div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
<div className="flex items-center gap-3 mb-4">
<FileSpreadsheet className="text-indigo-400" size={24} />
<h2 className="text-xl font-semibold text-white">Upload Schedule</h2>
</div>
<div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-indigo-500 bg-gray-900">
<Upload className="mx-auto text-gray-500 mb-3" size={48} />
<label className="cursor-pointer">
<span className="text-indigo-400 hover:text-indigo-300 font-medium text-lg">Click to upload Excel file</span>
<input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
</label>
</div>
{error && (
<div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg flex items-start gap-2">
<AlertCircle className="text-red-400" size={20} />
<p className="text-red-300 text-sm">{error}</p>
</div>
)}
</div>
</div>
</div>
);
}

return (
<div className="min-h-screen bg-gray-900 p-6">
<div className="max-w-7xl mx-auto">
<div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
<div className="flex items-center justify-between">
<div>
<h1 className="text-3xl font-bold text-white mb-2">Work Scheduler</h1>
<p className="text-gray-400">Manage your schedule</p>
{getUploadInfo() && (
<p className="text-xs text-gray-500 mt-1">Last uploaded: {getUploadInfo()}</p>
)}
</div>
<button onClick={clearAllData} className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded-lg font-medium transition-colors">
Clear All Data
</button>
</div>
</div>

```
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2"><User size={16} />I am</label>
            <select value={user} onChange={(e) => setUser(e.target.value)} className="p-3 border border-gray-600 rounded-lg bg-gray-900 text-white">
              {people.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2"><FileSpreadsheet size={16} />Filter</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-3 border border-gray-600 rounded-lg bg-gray-900 text-white">
              <option value="all">All Tests</option>
              {tests.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView('mySchedule')} className={`px-4 py-2 rounded-lg font-medium ${view === 'mySchedule' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>My Weekly</button>
          <button onClick={() => setView('teamWeekly')} className={`px-4 py-2 rounded-lg font-medium ${view === 'teamWeekly' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Team Weekly</button>
          <button onClick={() => setView('monthly')} className={`px-4 py-2 rounded-lg font-medium ${view === 'monthly' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Monthly</button>
          <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg font-medium ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>List</button>
        </div>
      </div>

      {view === 'mySchedule' && (
        <>
          <WeekNav />
          <h3 className="text-lg font-semibold text-white mb-4">My Weekly Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {weekDates.map(date => {
              const {short, long, num, today} = fmt(date);
              const tasks = myWeek[date] || [];
              return (
                <div key={date} className={`border-2 rounded-lg p-3 ${today ? 'border-indigo-500 bg-indigo-950' : 'border-gray-700 bg-gray-800'}`}>
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <div><h4 className="font-bold text-white">{short}</h4><p className="text-xs text-gray-400">{long}</p></div>
                      {today && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Today</span>}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{num}</p>
                  </div>
                  {tasks.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No tests</p> : (
                    <div className="space-y-2">
                      {tasks.map(t => (
                        <div key={t.id} className="border border-gray-700 rounded-lg p-2 bg-gray-900">
                          <h4 className="font-bold text-white text-sm mb-1">{t.test}</h4>
                          <div className="text-xs text-gray-300">
                            {t.mep && <div className="bg-indigo-900 px-2 py-1 rounded text-indigo-300 mb-1"><span className="font-bold">MEP: </span>{t.mep}</div>}
                            <div><span className="font-semibold">Location: </span>{t.location || 'N/A'}</div>
                            <div><span className="font-semibold">Time: </span>{t.time || 'N/A'}</div>
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

      {view === 'teamWeekly' && (
        <>
          <WeekNav />
          <h3 className="text-lg font-semibold text-white mb-4">Team Weekly Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {weekDates.map(date => {
              const {short, long, num, today} = fmt(date);
              const tasks = allWeek[date] || [];
              return (
                <div key={date} className={`border-2 rounded-lg p-3 ${today ? 'border-indigo-500 bg-indigo-950' : 'border-gray-700 bg-gray-800'}`}>
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <div><h4 className="font-bold text-white">{short}</h4><p className="text-xs text-gray-400">{long}</p></div>
                      {today && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Today</span>}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{num}</p>
                  </div>
                  {tasks.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No tests</p> : (
                    <div className="space-y-2">
                      {tasks.map(t => (
                        <div key={t.id} className="border border-gray-700 rounded-lg p-2 bg-gray-900">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-bold text-white text-sm">{t.test}</h4>
                            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">{t.person}</span>
                          </div>
                          <div className="text-xs text-gray-300">
                            {t.mep && <div className="bg-indigo-900 px-2 py-1 rounded text-indigo-300 mb-1"><span className="font-bold">MEP: </span>{t.mep}</div>}
                            <div><span className="font-semibold">Loc: </span>{t.location || 'N/A'}</div>
                            <div><span className="font-semibold">Time: </span>{t.time || 'N/A'}</div>
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

      {view === 'monthly' && (
        <>
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between">
              <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m-2, 1); setMonth(d.toISOString().slice(0,7)); }} 
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 flex items-center gap-2"><ChevronLeft size={20} />Prev</button>
              <div className="text-center">
                <h3 className="font-semibold text-white">{new Date(month + '-01').toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</h3>
                <button onClick={() => setMonth(new Date().toISOString().slice(0,7))} className="text-indigo-400 text-sm mt-1">Today</button>
              </div>
              <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m, 1); setMonth(d.toISOString().slice(0,7)); }} 
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 flex items-center gap-2">Next<ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sat','Sun','Mon','Tue','Wed','Thu','Fri'].map(d => <div key={d} className="text-center font-bold text-sm py-2 bg-gray-900 rounded text-gray-300">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day, i) => {
              const tasks = calTasks[day.date] || [];
              return (
                <div key={i} onClick={() => tasks.length > 0 && setDayTasks({date: day.date, tasks})} 
                  className={`min-h-24 border rounded-lg p-2 ${tasks.length > 0 ? 'cursor-pointer hover:border-indigo-500' : ''} ${day.isToday ? 'bg-indigo-950 border-indigo-500 border-2' : day.isCurrentMonth ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-800'}`}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-sm font-semibold ${day.isToday ? 'text-indigo-400' : day.isCurrentMonth ? 'text-gray-200' : 'text-gray-600'}`}>{day.dayNum}</span>
                    {day.isToday && <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                  </div>
                  {tasks.length > 0 && (
                    <div className="space-y-1">
                      {tasks.slice(0, 3).map(t => <div key={t.id} className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded truncate">{t.test}</div>)}
                      {tasks.length > 3 && <div className="text-xs text-gray-500 text-center">+{tasks.length - 3} more</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {dayTasks && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50" onClick={() => setDayTasks(null)}>
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between">
                  <h3 className="text-lg font-bold text-white">{new Date(dayTasks.date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})}</h3>
                  <button onClick={() => setDayTasks(null)} className="text-gray-400 hover:text-gray-200 text-2xl font-bold">×</button>
                </div>
                <div className="p-4 space-y-3">
                  {dayTasks.tasks.map(t => (
                    <div key={t.id} className="border border-gray-700 rounded-lg p-4 bg-gray-900">
                      <h4 className="font-bold text-white mb-2">{t.test}</h4>
                      <div className="space-y-1 text-sm text-gray-300">
                        {t.mep && <div className="bg-indigo-900 px-2 py-1 rounded text-indigo-300"><span className="font-bold">MEP: </span>{t.mep}</div>}
                        <div><span className="font-semibold">Location: </span>{t.location || 'N/A'}</div>
                        <div><span className="font-semibold">Time: </span>{t.time || 'N/A'}</div>
                        <div><span className="font-semibold">ID: </span>{t.testId || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'list' && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">My Schedule</h3>
          <div className="overflow-x-auto border border-gray-700 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-900 border-b-2 border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">MEP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filtered.filter(i => i.person === user).sort((a,b) => new Date(a.date) - new Date(b.date)).map(t => (
                  <tr key={t.id} className="hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-200">{new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{t.test}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{t.mep ? <span className="bg-indigo-900 px-2 py-1 rounded text-indigo-300">{t.mep}</span> : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{t.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{t.time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
</div>
```

);
};

export default App;