import { useState } from 'react';

export default function DiffChecker() {
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [diff, setDiff] = useState([]);

  const computeDiff = () => {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const diffs = [];

    const maxLines = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = origLines[i] || '';
      const modLine = modLines[i] || '';

      if (origLine === modLine) {
        diffs.push({ type: 'same', line: origLine, lineNum: i + 1 });
      } else if (origLine && !modLine) {
        diffs.push({ type: 'removed', line: origLine, lineNum: i + 1 });
      } else if (!origLine && modLine) {
        diffs.push({ type: 'added', line: modLine, lineNum: i + 1 });
      } else {
        diffs.push({ type: 'removed', line: origLine, lineNum: i + 1 });
        diffs.push({ type: 'added', line: modLine, lineNum: i + 1 });
      }
    }

    setDiff(diffs);
  };

  const getRowClass = (type) => {
    switch (type) {
      case 'added':
        return 'bg-green-950 text-green-300';
      case 'removed':
        return 'bg-red-950 text-red-300';
      case 'same':
        return 'bg-slate-800 text-slate-400';
      default:
        return '';
    }
  };

  const getSymbol = (type) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'same':
        return ' ';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Original</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={original}
            onChange={(event) => setOriginal(event.target.value)}
            placeholder="Paste original content..."
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Modified</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={modified}
            onChange={(event) => setModified(event.target.value)}
            placeholder="Paste modified content..."
          />
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={computeDiff}>
        Show Diff
      </button>

      {diff.length > 0 && (
        <div className="rounded border border-slate-700 overflow-hidden">
          <div className="max-h-96 overflow-auto bg-slate-900">
            {diff.map((item, index) => (
              <div
                key={index}
                className={`font-mono text-xs p-2 border-b border-slate-800 ${getRowClass(item.type)}`}
              >
                <span className="w-4 inline-block">{getSymbol(item.type)}</span>
                <span className="w-8 inline-block text-slate-500">{item.lineNum}</span>
                <span className="break-all">{item.line}</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 p-3 border-t border-slate-700 text-xs text-slate-400 flex gap-4">
            <span>✕ Removed: {diff.filter(d => d.type === 'removed').length}</span>
            <span>✓ Added: {diff.filter(d => d.type === 'added').length}</span>
            <span>= Same: {diff.filter(d => d.type === 'same').length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

