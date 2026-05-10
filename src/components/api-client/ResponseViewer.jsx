import { useState, useCallback } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────────

function detectType(headers = {}) {
  const ct = (headers['content-type'] || '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml'))  return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('image/')) return 'image';
  return 'text';
}

function statusTone(status) {
  if (status >= 200 && status < 300) return 'bg-emerald-600/20 text-emerald-300';
  if (status >= 400) return 'bg-rose-600/20 text-rose-300';
  return 'bg-amber-600/20 text-amber-200';
}

function useCopy(getText) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }, [getText]);
  return [copied, copy];
}

// ── JSON tree ──────────────────────────────────────────────────────────────

function JsonValue({ value, depth }) {
  const [open, setOpen] = useState(depth < 2);

  if (value === null)
    return <span className="text-slate-400 italic">null</span>;
  if (typeof value === 'boolean')
    return <span className="text-amber-300">{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="text-sky-300">{value}</span>;
  if (typeof value === 'string')
    return <span className="text-emerald-300 break-all">&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <span>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="mr-1 text-slate-400 hover:text-white transition">
          {open ? '▾' : '▸'}
        </button>
        <span className="text-slate-400">[{value.length}]</span>
        {open && (
          <span className="ml-4 block border-l border-slate-800 pl-3">
            {value.map((item, i) => (
              <div key={i} className="flex flex-wrap gap-1 py-0.5">
                <span className="text-slate-500 select-none">{i}:</span>
                <JsonValue value={item} depth={depth + 1} />
                {i < value.length - 1 && <span className="text-slate-600">,</span>}
              </div>
            ))}
          </span>
        )}
      </span>
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return <span className="text-slate-400">{'{}'}</span>;
    return (
      <span>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="mr-1 text-slate-400 hover:text-white transition">
          {open ? '▾' : '▸'}
        </button>
        <span className="text-slate-400">{'{' + keys.length + '}'}</span>
        {open && (
          <span className="ml-4 block border-l border-slate-800 pl-3">
            {keys.map((key, i) => (
              <div key={key} className="flex flex-wrap gap-1 py-0.5">
                <span className="text-brand-300">&quot;{key}&quot;</span>
                <span className="text-slate-500">:</span>
                <JsonValue value={value[key]} depth={depth + 1} />
                {i < keys.length - 1 && <span className="text-slate-600">,</span>}
              </div>
            ))}
          </span>
        )}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

function JsonTree({ raw }) {
  const [view, setView] = useState('tree');
  const [copied, copy] = useCopy(() => {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  });

  let parsed = null;
  let parseError = '';
  try { parsed = JSON.parse(raw); } catch (e) { parseError = e.message; }
  const pretty = parsed !== null ? JSON.stringify(parsed, null, 2) : raw;

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
          {['tree', 'raw'].map(m => (
            <button key={m} type="button" onClick={() => setView(m)}
              className={`px-3 py-1.5 capitalize transition ${view === m ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="btn-secondary text-xs gap-1.5">
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      {parseError && <p className="text-xs text-amber-400">⚠ {parseError}</p>}
      {view === 'tree' && parsed !== null ? (
        <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs leading-6 max-h-[520px] flex-1">
          <JsonValue value={parsed} depth={0} />
        </div>
      ) : (
        <textarea readOnly className="input min-h-[300px] flex-1 font-mono text-xs leading-5" value={pretty} />
      )}
    </div>
  );
}

// ── XML tree ───────────────────────────────────────────────────────────────

function XmlNodeRender({ node, depth }) {
  const [open, setOpen] = useState(depth < 2);
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return <span className="text-emerald-300 break-all">{text}</span>;
  }
  if (node.nodeType === Node.COMMENT_NODE)
    return <span className="text-slate-500 italic">{`<!-- ${node.textContent} -->`}</span>;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const children = Array.from(node.childNodes).filter(n =>
    n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.COMMENT_NODE ||
    (n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
  );
  const attrs = Array.from(node.attributes || []);

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-slate-800 pl-2' : ''}>
      <div className="flex flex-wrap items-baseline gap-0.5">
        {children.length > 0 && (
          <button type="button" onClick={() => setOpen(o => !o)}
            className="mr-0.5 text-slate-400 hover:text-white text-xs transition">
            {open ? '▾' : '▸'}
          </button>
        )}
        <span className="text-brand-300">&lt;{node.nodeName}</span>
        {attrs.map(a => (
          <span key={a.name} className="ml-1">
            <span className="text-amber-300">{a.name}</span>
            <span className="text-slate-400">=</span>
            <span className="text-emerald-300">&quot;{a.value}&quot;</span>
          </span>
        ))}
        <span className="text-brand-300">{children.length > 0 ? '>' : ' />'}</span>
      </div>
      {open && children.length > 0 && (
        <>
          {children.map((child, i) => <XmlNodeRender key={i} node={child} depth={depth + 1} />)}
          <span className="text-brand-300">&lt;/{node.nodeName}&gt;</span>
        </>
      )}
    </div>
  );
}

function XmlTree({ raw }) {
  const [view, setView] = useState('tree');
  const [copied, copy] = useCopy(() => raw);

  let doc = null;
  let parseError = '';
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(raw, 'text/xml');
    const err = doc.querySelector('parsererror');
    if (err) { parseError = err.textContent; doc = null; }
  } catch (e) { parseError = e.message; }

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
          {['tree', 'raw'].map(m => (
            <button key={m} type="button" onClick={() => setView(m)}
              className={`px-3 py-1.5 capitalize transition ${view === m ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-400 hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="btn-secondary text-xs gap-1.5">
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      {parseError && <p className="text-xs text-amber-400">⚠ {parseError}</p>}
      {view === 'tree' && doc ? (
        <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs leading-6 max-h-[520px] flex-1">
          <XmlNodeRender node={doc.documentElement} depth={0} />
        </div>
      ) : (
        <textarea readOnly className="input min-h-[300px] flex-1 font-mono text-xs leading-5" value={raw} />
      )}
    </div>
  );
}

// ── Image viewer ───────────────────────────────────────────────────────────

function ImageViewer({ dataUrl, contentType }) {
  const ext = contentType?.split('/')[1] || 'img';
  return (
    <div className="flex flex-col gap-3 flex-1">
      <div>
        <a href={dataUrl} download={`response.${ext}`} className="btn-secondary text-xs">
          ⬇ Download image
        </a>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2 flex-1">
        <img src={dataUrl} alt="Response" className="max-w-full rounded object-contain" />
      </div>
    </div>
  );
}

// ── Text / HTML viewer ─────────────────────────────────────────────────────

function TextViewer({ raw, label }) {
  const [copied, copy] = useCopy(() => raw);
  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center gap-2">
        <span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        <button type="button" onClick={copy} className="btn-secondary text-xs gap-1.5">
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      <textarea readOnly className="input min-h-[300px] flex-1 font-mono text-xs leading-5" value={raw} />
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function ResponseViewer({ response }) {
  const [headersOpen, setHeadersOpen] = useState(false);

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 py-16 text-center">
        <p className="text-sm text-slate-500">Send a request to see the response here.</p>
      </div>
    );
  }

  if (response.error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
        <p className="font-medium text-red-300">{response.error}</p>
        <p className="text-xs text-amber-200">
          If this is a CORS issue, test with a public CORS-enabled API or configure a proxy.
        </p>
      </div>
    );
  }

  const type = response.dataUrl ? 'image' : detectType(response.headers);
  const ct = response.headers?.['content-type'] || '';

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Status / meta bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${statusTone(response.status)}`}>{response.status} {response.statusText}</span>
        <span className="badge bg-white/[0.06] text-slate-200">{response.time} ms</span>
        {ct && <span className="badge bg-white/[0.06] text-slate-400 text-[10px]">{ct}</span>}
      </div>

      {/* Smart body */}
      {type === 'json'  && <JsonTree  raw={response.body} />}
      {type === 'xml'   && <XmlTree   raw={response.body} />}
      {type === 'image' && <ImageViewer dataUrl={response.dataUrl} contentType={ct} />}
      {(type === 'html' || type === 'text') && <TextViewer raw={response.body} label={type} />}

      {/* Headers drawer */}
      <div className="mt-auto">
        <button type="button"
          className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900 transition"
          onClick={() => setHeadersOpen(o => !o)}>
          <span>Response headers ({Object.keys(response.headers || {}).length})</span>
          <span>{headersOpen ? '▾' : '▸'}</span>
        </button>
        {headersOpen && (
          <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs leading-6 text-slate-300">
            {JSON.stringify(response.headers, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
