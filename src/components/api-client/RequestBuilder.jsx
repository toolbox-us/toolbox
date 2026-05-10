import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import HeadersEditor from './HeadersEditor';
import ResponseViewer from './ResponseViewer';
import { makeRequest } from '../../utils/httpClient';
import { parseCurlCommand } from '../../utils/curlParser';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const HISTORY_KEY = 'personal-utils-api-history-v1';
const MAX_HISTORY = 20;
const CONFIG_TABS = [
  { key: 'params', label: 'Query Params' },
  { key: 'headers', label: 'Headers' },
  { key: 'body', label: 'Request Body' },
  { key: 'auth', label: 'Authentication' }
];

function responseTone(status) {
  if (status >= 200 && status < 300) return 'bg-emerald-600/20 text-emerald-300';
  if (status >= 400) return 'bg-rose-600/20 text-rose-300';
  return 'bg-amber-600/20 text-amber-200';
}


export default function RequestBuilder() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [params, setParams] = useState([{ key: '', value: '' }]);
  const [headers, setHeaders] = useState([{ key: 'Accept', value: 'application/json' }]);
  const [body, setBody] = useState('');
  const [authType, setAuthType] = useState('none');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
   });
   const [showCurlImporter, setShowCurlImporter] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [curlError, setCurlError] = useState('');
   const [activeConfigTab, setActiveConfigTab] = useState('body');
   const [showHistory, setShowHistory] = useState(false);
   const [showConsole, setShowConsole] = useState(false);
   const [consoleLogs, setConsoleLogs] = useState([]);
   const [expandedLogs, setExpandedLogs] = useState(new Set());
   const curlInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Sync history across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== HISTORY_KEY) return;
      try {
        const saved = JSON.parse(e.newValue || '[]');
        setHistory(Array.isArray(saved) ? saved : []);
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!showCurlImporter) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCurlImporter(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => curlInputRef.current?.focus());

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showCurlImporter]);

  useEffect(() => {
    if (!showHistory) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => { if (event.key === 'Escape') setShowHistory(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showHistory]);

  const currentRequest = useMemo(
    () => ({
      method,
      url,
      params,
      headers,
      body,
      authType,
      token,
      username,
      password
    }),
    [method, url, params, headers, body, authType, token, username, password]
  );

  const applyRequest = (request) => {
    setMethod(request.method || 'GET');
    setUrl(request.url || '');
    setParams(Array.isArray(request.params) && request.params.length ? request.params : [{ key: '', value: '' }]);
    setHeaders(Array.isArray(request.headers) && request.headers.length ? request.headers : [{ key: '', value: '' }]);
    setBody(request.body || '');
    setAuthType(request.authType || 'none');
    setToken(request.token || '');
    setUsername(request.username || '');
    setPassword(request.password || '');
    setActiveConfigTab('body');
  };

  const clearHistory = () => {
    setHistory([]);
   };

   const run = async () => {
    if (!/^https?:\/\//i.test(url)) {
      setResponse({ error: 'Use a valid absolute URL (http:// or https://).' });
      return;
    }

    setLoading(true);
    const result = await makeRequest({
      method,
      url,
      params,
      headers,
      body,
      auth:
        authType === 'bearer'
          ? { type: 'bearer', token }
          : authType === 'basic'
            ? { type: 'basic', username, password }
            : { type: 'none' }
    });
    setResponse(result);

    // Add to console logs (keep last 50 requests)
    setConsoleLogs((prev) => [
      {
        id: Date.now(),
        method,
        url,
        params: params.filter(p => p.key),
        headers,
        body,
        authType,
        response: result,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev
    ].slice(0, 50));

    setHistory((prev) => [
      { ...currentRequest, id: Date.now(), status: result?.error ? null : result?.status ?? null },
      ...prev
    ].slice(0, MAX_HISTORY));
    setLoading(false);
  };

  const importCurl = () => {
    if (!curlInput.trim()) {
      setCurlError('Paste a cURL command first.');
      return;
    }

    try {
      const parsed = parseCurlCommand(curlInput);
      applyRequest(parsed);
      setCurlError('');
      setShowCurlImporter(false);
    } catch (error) {
      setCurlError(error.message || 'Invalid cURL command.');
    }
  };

  const updateParam = (index, field, value) => {
    const next = [...params];
    next[index] = { ...next[index], [field]: value };
    setParams(next);
  };


  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2 xl:items-stretch">

        {/* ── Left column: request setup ── */}
        <div className="h-full">
          <div className="tool-card flex h-full flex-col gap-4">
            <p className="tool-card-title">Request setup</p>

            <div className="grid gap-2 md:grid-cols-[120px_1fr_auto_auto]">
              <select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input className="input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com" />
              <button type="button" className="btn-secondary w-full md:w-auto" onClick={() => setShowCurlImporter(true)}>
                <span aria-hidden="true">⌘</span>
                Import cURL
              </button>
              <button type="button" className="btn-primary w-full md:w-auto" onClick={run} disabled={loading}>
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>

            <div className="border-t border-slate-800/80" />

            <div className="grid flex-1 gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
              <div className="space-y-1">
                {CONFIG_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={[
                      'flex w-full items-center justify-between rounded-lg border-l-2 px-2 py-2 text-left text-sm transition',
                      activeConfigTab === tab.key
                        ? 'border-l-brand-400 bg-transparent text-white'
                        : 'border-l-transparent bg-transparent text-slate-300 hover:text-white'
                    ].join(' ')}
                    onClick={() => setActiveConfigTab(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${activeConfigTab === tab.key ? 'bg-brand-400' : 'bg-slate-700'}`} />
                  </button>
                ))}
              </div>

              <div className="h-full min-h-[240px] rounded-2xl p-4">
                {activeConfigTab === 'params' ? (
                  <div className="space-y-2">
                    {params.map((entry, index) => (
                      <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <input className="input" value={entry.key} onChange={(e) => updateParam(index, 'key', e.target.value)} placeholder="key" />
                        <input className="input" value={entry.value} onChange={(e) => updateParam(index, 'value', e.target.value)} placeholder="value" />
                        <button type="button" className="btn-secondary" onClick={() => setParams(params.filter((_, i) => i !== index))}>Remove</button>
                      </div>
                    ))}
                    <button type="button" className="btn-secondary" onClick={() => setParams([...params, { key: '', value: '' }])}>Add Param</button>
                  </div>
                ) : null}

                {activeConfigTab === 'headers' ? (
                  <HeadersEditor headers={headers} setHeaders={setHeaders} />
                ) : null}

                {activeConfigTab === 'body' ? (
                  <textarea
                    className="input min-h-[200px] font-mono text-xs leading-5"
                    rows={10}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder='{"name": "example"}'
                  />
                ) : null}

                {activeConfigTab === 'auth' ? (
                  <div className="space-y-3">
                    <select className="input" value={authType} onChange={(event) => setAuthType(event.target.value)}>
                      <option value="none">None</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                    {authType === 'bearer' ? (
                      <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" />
                    ) : null}
                    {authType === 'basic' ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
                        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: response body ── */}
        <div className="tool-card flex h-full flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tool-card-title">Response</p>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setShowHistory(true)}
              title="Open recent requests"
            >
              🕓 Recent Requests
            </button>
          </div>
          <ResponseViewer response={response} />
        </div>
      </div>


      {/* ── cURL importer modal ── */}
      {showCurlImporter ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-ij-bg/80"
            onClick={() => setShowCurlImporter(false)}
            aria-label="Close cURL importer"
          />
          <div role="dialog" aria-modal="true" aria-labelledby="curl-importer-title" className="relative w-full max-w-3xl tool-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p id="curl-importer-title" className="tool-card-title">Paste cURL command</p>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setShowCurlImporter(false)} aria-label="Close">✕</button>
            </div>
            <textarea
              ref={curlInputRef}
              className="input font-mono text-xs leading-5"
              rows={7}
              value={curlInput}
              onChange={(event) => setCurlInput(event.target.value)}
              placeholder={'curl -X POST https://api.example.com -H "Content-Type: application/json" -d "{\\"name\\":\\"demo\\"}"'}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={importCurl} disabled={!curlInput.trim()}>
                Parse cURL
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCurlImporter(false)}>
                Close
              </button>
            </div>
            {curlError ? <p className="text-sm text-red-400">{curlError}</p> : null}
          </div>
        </div>,
        document.body
      ) : null}

      {/* ── Recent requests right-side drawer ── */}
      {showHistory ? createPortal(
        <div className="fixed inset-0 z-[9999]">
          {/* backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-ij-bg/80"
            onClick={() => setShowHistory(false)}
            aria-label="Close recent requests"
          />
          {/* panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Recent requests"
            className="absolute inset-y-0 right-0 flex w-full max-w-[360px] flex-col bg-ij-popup shadow-2xl shadow-black/40"
            style={{ borderLeft: '1px solid #4E5254' }}
          >
            {/* header */}
            <div className="flex items-center justify-between gap-2 px-4 py-4" style={{ borderBottom: '1px solid #4E5254' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ij-muted">Recent Requests</p>
                <p className="mt-1 text-sm text-ij-text">{history.length} saved</p>
              </div>
              <div className="flex gap-2">
                {history.length > 0 ? (
                  <button type="button" className="btn-secondary text-xs" onClick={clearHistory}>
                    Clear all
                  </button>
                ) : null}
                <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setShowHistory(false)} aria-label="Close">✕</button>
              </div>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {history.length === 0 ? (
                <p className="mt-6 text-center text-sm text-ij-dim">No requests yet. Send one to see it here.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mb-1 w-full rounded-lg border-l-2 border-l-transparent px-3 py-2.5 text-left transition hover:border-l-brand-400 hover:bg-ij-hover"
                    onClick={() => { applyRequest(item); setShowHistory(false); }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-semibold text-brand-300">{item.method}</span>
                      {item.status != null ? (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${responseTone(item.status)}`}>
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block truncate text-sm text-slate-200">{item.url}</span>
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-3 text-xs text-ij-dim" style={{ borderTop: '1px solid #4E5254' }}>
              Click a request to load it into Request setup.
            </div>
          </aside>
        </div>,
        document.body
       ) : null}

      {/* ── Console Box ── */}
      <div className="tool-card space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setShowConsole(!showConsole)}
        >
          <div className="flex items-center gap-2">
            <p className="tool-card-title">📋 Console</p>
            {response && !response.error && response.status ? (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${responseTone(response.status)}`}>
                {response.status}
              </span>
            ) : null}
          </div>
          <span className="text-slate-400 transition">{showConsole ? '▼' : '▶'}</span>
        </button>

        {showConsole ? (
          <div className="space-y-3 text-xs font-mono bg-slate-950/50 p-3 rounded overflow-y-auto max-h-[500px]">
            {consoleLogs.length === 0 ? (
              <p className="text-slate-500 italic">No requests sent yet. Send a request to see logs here.</p>
            ) : (
              consoleLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const toggleExpand = () => {
                  const newSet = new Set(expandedLogs);
                  if (newSet.has(log.id)) {
                    newSet.delete(log.id);
                  } else {
                    newSet.add(log.id);
                  }
                  setExpandedLogs(newSet);
                };

                return (
                  <div key={log.id} className="border border-slate-700 rounded overflow-hidden">
                    {/* ── Collapsed Header ── */}
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 p-2 hover:bg-slate-900/50 transition text-left"
                      onClick={toggleExpand}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-brand-300 font-semibold shrink-0">{log.method}</span>
                        <span className="text-slate-300 truncate">{log.url}</span>
                        {log.response && !log.response.error && log.response.status ? (
                          <span className={`rounded px-1 py-0.5 text-[10px] font-semibold shrink-0 ${responseTone(log.response.status)}`}>
                            {log.response.status}
                          </span>
                        ) : log.response?.error ? (
                          <span className="rounded px-1 py-0.5 text-[10px] font-semibold shrink-0 bg-red-600/20 text-red-300">ERROR</span>
                        ) : null}
                      </div>
                      <span className="text-slate-400 shrink-0">{isExpanded ? '▼' : '▶'}</span>
                    </button>

                    {/* ── Expanded Details ── */}
                    {isExpanded ? (
                      <div className="bg-slate-900/30 border-t border-slate-700 p-2 space-y-2">
                        {/* Timestamp and Status */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-slate-500">{log.timestamp}</p>
                          {log.response && !log.response.error && log.response.status ? (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${responseTone(log.response.status)}`}>
                              {log.response.status}
                            </span>
                          ) : log.response?.error ? (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600/20 text-red-300">ERROR</span>
                          ) : null}
                        </div>

                        {/* Request Line */}
                        <p className="text-slate-400">
                          <span className="text-brand-300 font-semibold">{log.method}</span> <span className="text-slate-300 break-all">{log.url}</span>
                        </p>

                        {/* Query Params */}
                        {log.params.length > 0 ? (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Query Params:</span>
                            <div className="ml-2">
                              {log.params.map((p, i) => (
                                <p key={i}>{p.key}: {p.value}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Headers */}
                        {log.headers.length > 0 ? (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Headers:</span>
                            <div className="ml-2 space-y-1">
                              {log.headers.map((h, i) => (
                                <p key={i}>{h.key}: <span className="text-slate-300">{h.value}</span></p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Body */}
                        {log.body ? (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Request Body:</span>
                            <pre className="ml-2 text-slate-400 overflow-x-auto whitespace-pre-wrap break-words bg-slate-900/50 p-2 rounded text-[10px]">{log.body}</pre>
                          </div>
                        ) : null}

                        {/* Auth */}
                        {log.authType !== 'none' ? (
                          <div className="text-slate-400">
                            <span className="text-slate-500">Auth:</span>
                            <p className="ml-2">{log.authType === 'bearer' ? 'Bearer Token' : 'Basic Auth'}</p>
                          </div>
                        ) : null}

                        {/* Response */}
                        {log.response ? (
                          <div className="text-slate-400 border-t border-slate-700 pt-2">
                            <span className="text-slate-500">Response:</span>
                            {log.response.error ? (
                              <p className="ml-2 text-red-400">{log.response.error}</p>
                            ) : (
                              <>
                                <p className="ml-2">Status: <span className={responseTone(log.response.status)}>{log.response.status} {log.response.statusText}</span></p>

                                {/* Response Headers */}
                                {log.response.headers && Object.entries(log.response.headers).length > 0 ? (
                                  <div className="ml-2">
                                    <p className="text-slate-500">Response Headers:</p>
                                    {Object.entries(log.response.headers).map(([key, val]) => (
                                      <p key={key} className="ml-2">
                                        {key}: <span className="text-slate-300">{val}</span>
                                      </p>
                                    ))}
                                  </div>
                                ) : null}

                                {/* Response Body */}
                                {log.response.body ? (
                                  <div className="ml-2">
                                    <p className="text-slate-500">Response Body:</p>
                                    <pre className="ml-2 text-slate-400 overflow-x-auto whitespace-pre-wrap break-words bg-slate-900/50 p-2 rounded text-[10px]">{typeof log.response.body === 'string' ? log.response.body : JSON.stringify(log.response.body, null, 2)}</pre>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

