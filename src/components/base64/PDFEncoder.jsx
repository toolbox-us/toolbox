import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { useEffect, useRef, useState } from 'react';
import FileUploader from '../shared/FileUploader';
import CopyButton from '../shared/CopyButton';
import { stripDataUrlPrefix } from '../../utils/base64';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_MB = 50;

// Renders all pages of a PDF fit-to-width using pdfjs-dist
function PdfRenderer({ bytes }) {
  const containerRef = useRef(null);
  const [pageImages, setPageImages] = useState([]);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!bytes) { setPageImages([]); return; }

    let canceled = false;
    setRendering(true);
    setPageImages([]);

    async function renderAll() {
      const doc = await getDocument({ data: bytes.slice() }).promise;
      const total = doc.numPages;
      const containerW = Math.max(300, (containerRef.current?.clientWidth ?? 700) - 16);
      const imgs = [];

      for (let p = 1; p <= total; p++) {
        if (canceled) break;
        const page = await doc.getPage(p);
        const baseVp = page.getViewport({ scale: 1 });
        const scale = containerW / baseVp.width;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        if (!canceled) imgs.push(canvas.toDataURL('image/jpeg', 0.92));
      }

      doc.destroy();
      if (!canceled) { setPageImages(imgs); setRendering(false); }
    }

    renderAll().catch(() => { if (!canceled) setRendering(false); });
    return () => { canceled = true; };
  }, [bytes]);

  return (
    <div ref={containerRef} className="overflow-auto rounded bg-slate-950 p-2 space-y-2" style={{ maxHeight: '70vh' }}>
      {rendering && <p className="text-xs text-slate-400 p-2 text-center">Rendering pages…</p>}
      {pageImages.map((src, i) => (
        <img key={i} src={src} alt={`Page ${i + 1}`} className="block w-full rounded shadow" />
      ))}
    </div>
  );
}

export default function PDFEncoder() {
  const [base64, setBase64] = useState('');
  const [warning, setWarning]   = useState('');
  const [pdfBytes, setPdfBytes] = useState(null);

  const onFiles = (files) => {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      setWarning(`Large PDF selected (${(file.size / 1024 / 1024).toFixed(1)} MB). Browser memory may be impacted.`);
    } else {
      setWarning('');
    }

    // Read as Data URL for base64 string
    const b64Reader = new FileReader();
    b64Reader.onload = () => setBase64(stripDataUrlPrefix(String(b64Reader.result)));
    b64Reader.readAsDataURL(file);

    // Read as ArrayBuffer for the canvas renderer
    const bufReader = new FileReader();
    bufReader.onload = () => setPdfBytes(new Uint8Array(bufReader.result));
    bufReader.readAsArrayBuffer(file);
  };

  const decode = () => {
    if (!base64.trim()) return;
    try {
      const bytes = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0));
      setPdfBytes(bytes);
    } catch {
      // invalid base64 — leave preview as-is
    }
  };

  return (
    <div className="space-y-3">
      <FileUploader
        label="Select a PDF"
        accept=".pdf"
        onChange={onFiles}
        helperText="File is encoded locally."
      />
      {warning ? <p className="text-sm text-amber-400">{warning}</p> : null}
      <textarea
        className="input"
        rows={8}
        value={base64}
        onChange={(event) => setBase64(event.target.value)}
        placeholder="PDF Base64"
      />
      <div className="flex gap-2">
        <CopyButton value={base64} />
        <button type="button" className="btn-primary" onClick={decode}>
          Decode
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!pdfBytes}
          onClick={() => {
            if (!pdfBytes) return;
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'decoded.pdf';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download
        </button>
      </div>
      {pdfBytes ? (
        <div className="rounded border border-slate-700 p-2">
          <p className="mb-2 text-xs text-slate-400">Preview — {pdfBytes.length > 0 ? `${(pdfBytes.length / 1024).toFixed(0)} KB` : ''}</p>
          <PdfRenderer bytes={pdfBytes} />
        </div>
      ) : null}
    </div>
  );
}
