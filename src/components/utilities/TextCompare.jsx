import { useState } from 'react';
import CopyButton from '../shared/CopyButton';

export default function TextCompare() {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [result, setResult] = useState('');

  const compare = () => {
    if (!text1.trim() || !text2.trim()) {
      setResult('');
      return;
    }

    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    let htmlResult = '<div class="font-mono text-sm space-y-1">';

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 === line2) {
        htmlResult += `<div class="text-gray-400">= ${escapeHtml(line1)}</div>`;
      } else {
        htmlResult += `<div class="text-red-400">- ${escapeHtml(line1)}</div>`;
        htmlResult += `<div class="text-green-400">+ ${escapeHtml(line2)}</div>`;
      }
    }

    htmlResult += '</div>';
    setResult(htmlResult);
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Text 1</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={text1}
            onChange={(event) => setText1(event.target.value)}
            placeholder="Enter first text..."
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Text 2</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={text2}
            onChange={(event) => setText2(event.target.value)}
            placeholder="Enter second text..."
          />
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={compare}>
        Compare
      </button>
      {result && (
        <div className="rounded border border-slate-700 p-4 bg-slate-900">
          <div dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      )}
    </div>
  );
}

