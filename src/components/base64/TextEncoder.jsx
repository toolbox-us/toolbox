import { useMemo, useState } from 'react';
import CopyButton from '../shared/CopyButton';
import { decodeUnicodeText, encodeUnicodeText } from '../../utils/base64';

export default function TextEncoder() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const canProcess = useMemo(() => input.trim().length > 0, [input]);

  const encode = () => {
    setError('');
    try {
      setOutput(encodeUnicodeText(input));
    } catch {
      setError('Failed to encode text.');
    }
  };

  const decode = () => {
    setError('');
    try {
      setOutput(decodeUnicodeText(input));
    } catch {
      setError('Invalid Base64 content.');
    }
  };

  return (
    <div className="grid gap-3">
      <textarea
        rows={6}
        className="input"
        placeholder="Enter text or Base64"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={encode} disabled={!canProcess}>
          Encode
        </button>
        <button type="button" className="btn-secondary" onClick={decode} disabled={!canProcess}>
          Decode
        </button>
        <CopyButton value={output} />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <textarea rows={6} className="input" placeholder="Result" readOnly value={output} />
    </div>
  );
}

