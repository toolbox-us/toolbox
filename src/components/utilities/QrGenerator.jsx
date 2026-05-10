import { useState } from 'react';
import QRCode from 'qrcode';

export default function QrGenerator() {
  const [text, setText] = useState('https://example.com');
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  const generate = async () => {
    try {
      const result = await QRCode.toDataURL(text, { width: 260, margin: 2 });
      setDataUrl(result);
      setError('');
    } catch {
      setDataUrl('');
      setError('Could not generate QR code.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Input Controls ── */}
      <div className="space-y-3">
        <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Text or URL" />
        <button type="button" className="btn-primary" onClick={generate}>
          Generate QR
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      {/* ── QR Code Preview ── */}
      <div>
        {dataUrl ? (
          <div className="space-y-2">
            <img src={dataUrl} alt="Generated QR code" className="rounded border border-slate-700 bg-white p-2" />
            <a className="btn-secondary" href={dataUrl} download="qrcode.png">
              Download PNG
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

