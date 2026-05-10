import { useState } from 'react';
import CopyButton from '../shared/CopyButton';

const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const IANA_TIMEZONES = [
  'Pacific/Midway',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Halifax',
  'America/Sao_Paulo',
  'Atlantic/Azores',
  'Europe/London',
  'Europe/Paris',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

function buildTimezoneList() {
  if (IANA_TIMEZONES.includes(SYSTEM_TZ)) return IANA_TIMEZONES;
  return [SYSTEM_TZ, ...IANA_TIMEZONES];
}

// Returns the offset in ms: (tz time as UTC) - (actual UTC). Positive = ahead.
function getTzOffsetMs(date, tzIANA) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: tzIANA,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  const h = get('hour') === '24' ? '00' : get('hour');
  const tzAsUtc = new Date(`${get('year')}-${get('month')}-${get('day')}T${h}:${get('minute')}:${get('second')}Z`);
  return tzAsUtc.getTime() - date.getTime();
}

function tzLabel(tz) {
  try {
    const offsetMin = Math.round(getTzOffsetMs(new Date(), tz) / 60000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${tz} (UTC${sign}${hh}:${mm})`;
  } catch {
    return tz;
  }
}

function formatTimestamp(date, tzIANA) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: tzIANA,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  const h = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${h}:${get('minute')}:${get('second')}`;
}

const TIMEZONES = buildTimezoneList();

export default function EpochConverter() {
  // Epoch → Date state
  const [epochInput, setEpochInput] = useState('');
  const [epochTz, setEpochTz] = useState(SYSTEM_TZ);
  const [epochResult, setEpochResult] = useState('');
  const [epochError, setEpochError] = useState('');

  // Date → Epoch state
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('00:00');
  const [dateTz, setDateTz] = useState(SYSTEM_TZ);
  const [dateResult, setDateResult] = useState('');
  const [dateError, setDateError] = useState('');

  const convertEpochToDate = () => {
    setEpochError('');
    setEpochResult('');
    const raw = epochInput.trim();
    if (!raw) { setEpochError('Please enter an epoch value.'); return; }
    const num = Number(raw);
    if (!Number.isFinite(num)) { setEpochError('Invalid epoch number.'); return; }
    try {
      const date = new Date(num * 1000);
      const ts = formatTimestamp(date, epochTz);
      setEpochResult(`${ts} (${epochTz})`);
    } catch {
      setEpochError('Conversion failed. Check timezone or epoch value.');
    }
  };

  const useCurrentEpoch = () => {
    setEpochInput(String(Math.floor(Date.now() / 1000)));
    setEpochResult('');
    setEpochError('');
  };

  const convertDateToEpoch = () => {
    setDateError('');
    setDateResult('');
    if (!dateInput) { setDateError('Please pick a date.'); return; }
    try {
      // Build a wall-clock datetime from date + time and treat as UTC first.
      const asUtc = new Date(`${dateInput}T${timeInput || '00:00'}:00Z`);
      // Subtract tz offset so the "wall clock" time matches the chosen timezone.
      const offsetMs = getTzOffsetMs(asUtc, dateTz);
      const epoch = Math.floor((asUtc.getTime() - offsetMs) / 1000);
      setDateResult(String(epoch));
    } catch {
      setDateError('Conversion failed. Check timezone or date value.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Epoch → Date ── */}

      <div className="tool-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Epoch → Date</h3>
          <p className="mt-1 text-xs text-slate-400">Convert Unix seconds into a readable timestamp for the timezone you choose.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Epoch (seconds)</label>
            <input
              type="number"
              className="input w-full"
              value={epochInput}
              onChange={(e) => setEpochInput(e.target.value)}
              placeholder="1609459200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Timezone <span className="text-slate-500">(default: system)</span>
            </label>
            <select className="input w-full" value={epochTz} onChange={(e) => setEpochTz(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tzLabel(tz)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-primary" onClick={convertEpochToDate}>
            Convert to Date
          </button>
          <button type="button" className="btn-secondary" onClick={useCurrentEpoch}>
            Use Current Epoch
          </button>
        </div>
        {epochError ? <p className="text-sm text-red-400">{epochError}</p> : null}
        {epochResult ? (
          <div className="result-panel flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-slate-100 break-all">{epochResult}</p>
            <CopyButton value={epochResult} />
          </div>
        ) : null}
      </div>

      {/* ── Date → Epoch ── */}
      <div className="tool-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Date → Epoch</h3>
          <p className="mt-1 text-xs text-slate-400">Pick a calendar date, assign a timezone, and instantly get the Unix epoch value.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date & Time</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="date"
                className="input w-full"
                style={{ colorScheme: 'dark' }}
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <input
                type="time"
                className="input w-full"
                style={{ colorScheme: 'dark' }}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Timezone <span className="text-slate-500">(default: system)</span>
            </label>
            <select className="input w-full" value={dateTz} onChange={(e) => setDateTz(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tzLabel(tz)}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={convertDateToEpoch}>
          Convert to Epoch
        </button>
        {dateError ? <p className="text-sm text-red-400">{dateError}</p> : null}
        {dateResult ? (
          <div className="result-panel flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-slate-100">{dateResult}</p>
            <CopyButton value={dateResult} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
