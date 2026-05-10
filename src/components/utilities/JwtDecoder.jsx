import { useState } from 'react';
import jwtDecode from 'jwt-decode';

export default function JwtDecoder() {
  const [token, setToken] = useState('');
  const [decoded, setDecoded] = useState('');
  const [error, setError] = useState('');

  const decode = () => {
    try {
      const payload = jwtDecode(token);
      setDecoded(JSON.stringify(payload, null, 2));
      setError('');
    } catch {
      setDecoded('');
      setError('Invalid JWT token.');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-300">Decoder only. This does not verify signatures.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs text-slate-400">JWT Input</label>
          <textarea
            rows={10}
            className="input font-mono text-xs"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste JWT token"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-slate-400">Decoded Output</label>
          <textarea rows={10} readOnly className="input font-mono text-xs" value={decoded} placeholder="Decoded payload" />
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={decode}>
        Decode JWT
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

