import { useRef, useState } from 'react';
import FileUploader from '../shared/FileUploader';
import { downloadPdfBytes, signPDF } from '../../utils/pdfHelpers';

export default function SignPDF() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [x, setX] = useState(80);
  const [y, setY] = useState(80);
  const [width, setWidth] = useState(120);
  const [height, setHeight] = useState(60);
  const [error, setError] = useState('');
  const [drawing, setDrawing] = useState(false);
  
  // Signature management
  const [signatures, setSignatures] = useState([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureColor, setSignatureColor] = useState('#111827');
  const [selectedSignatureId, setSelectedSignatureId] = useState('');
  
  const canvasRef = useRef(null);

  const getCanvasPoint = (event, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(event.pointerId);
    const { x, y } = getCanvasPoint(event, canvas);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const { x, y } = getCanvasPoint(event, canvas);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (event) => {
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    setDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const isEmpty = !canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
    
    if (isEmpty) {
      setError('Please draw a signature before saving.');
      return;
    }

    const finalName = signatureName.trim() || `Signature ${signatures.length + 1}`;
    const dataUrl = canvas.toDataURL('image/png');
    
    setSignatures(prev => [...prev, {
      id: `sig-${Date.now()}`,
      name: finalName,
      dataUrl,
      color: signatureColor
    }]);
    
    clearCanvas();
    setSignatureName('');
    setSignatureColor('#111827');
    setError('');
    setShowSignatureModal(false);
  };

  const deleteSignature = (id) => {
    setSignatures(prev => prev.filter(sig => sig.id !== id));
    if (selectedSignatureId === id) setSelectedSignatureId('');
  };

  const applySignature = async () => {
    if (!pdfFile) {
      setError('Select a PDF first.');
      return;
    }

    if (!selectedSignatureId) {
      setError('Select a signature to apply.');
      return;
    }

    const sig = signatures.find(s => s.id === selectedSignatureId);
    if (!sig) {
      setError('Signature not found.');
      return;
    }

    setError('');
    try {
      const bytes = await signPDF({
        pdfFile,
        signaturePngDataUrl: sig.dataUrl,
        pageNumber,
        x,
        y,
        width,
        height
      });
      downloadPdfBytes(bytes, 'signed.pdf');
    } catch {
      setError('Unable to sign PDF.');
    }
  };

  return (
    <div className="space-y-3">
      <FileUploader label="PDF to sign" accept=".pdf"
        onChange={(files) => { const f = files?.[0] ?? null; setPdfFile(f); setPdfFileName(f?.name ?? ''); setError(''); }}
        loadedLabel={pdfFileName || null}
        onClear={() => { setPdfFile(null); setPdfFileName(''); setError(''); }}
      />

      {pdfFile ? (
        <>
          <div className="rounded border border-slate-700 bg-slate-900/80 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">Signature Management</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => setShowSignatureModal(true)}
                >
                  ✏️ Create Signature
                </button>
                {signatures.length > 0 && (
                  <select
                    className="input text-sm flex-1 min-w-[200px]"
                    value={selectedSignatureId}
                    onChange={(e) => setSelectedSignatureId(e.target.value)}
                  >
                    <option value="">Select a signature...</option>
                    {signatures.map(sig => (
                      <option key={sig.id} value={sig.id}>{sig.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {signatures.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">Saved Signatures</p>
                <div className="flex flex-wrap gap-2">
                  {signatures.map(sig => (
                    <div
                      key={sig.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded border ${selectedSignatureId === sig.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-800'}`}
                    >
                      <img src={sig.dataUrl} alt={sig.name} className="h-8 w-12 object-cover" />
                      <span className="text-xs text-slate-300">{sig.name}</span>
                      <button
                        type="button"
                        className="btn-secondary !h-6 !w-6 !p-0 text-xs"
                        onClick={() => deleteSignature(sig.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-slate-700 pt-3">
              <p className="text-xs font-semibold text-slate-300">Placement</p>
              <div className="grid grid-cols-4 gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                  Page
                  <input className="input" type="number" min="1" value={pageNumber} onChange={(e) => setPageNumber(Number(e.target.value))} />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                  X
                  <input className="input" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                  Y
                  <input className="input" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                  W
                  <input className="input" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min="40" />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                  H
                  <input className="input" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min="20" />
                </label>
              </div>
            </div>

            <button type="button" className="btn-primary w-full" onClick={applySignature} disabled={!selectedSignatureId}>
              Sign And Download
            </button>
          </div>
        </>
      ) : null}

      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-2xl w-full mx-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Draw Signature</h2>
              <button
                type="button"
                className="btn-secondary !h-8 !w-8 !p-0"
                onClick={() => { setShowSignatureModal(false); clearCanvas(); setSignatureName(''); setSignatureColor('#111827'); }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Signature Name</label>
                <input
                  className="input w-full"
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder={`Signature ${signatures.length + 1}`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Pen Color</label>
                <div className="flex gap-2">
                  {[
                    { color: '#111827', label: 'Black' },
                    { color: '#1e40af', label: 'Blue' },
                    { color: '#dc2626', label: 'Red' }
                  ].map(opt => (
                    <button
                      key={opt.color}
                      type="button"
                      className={`px-3 py-2 rounded text-sm font-medium transition ${
                        signatureColor === opt.color
                          ? 'bg-slate-700 text-white border-2 border-blue-500'
                          : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                      }`}
                      onClick={() => setSignatureColor(opt.color)}
                    >
                      <span
                        className="inline-block w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: opt.color }}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">Draw Signature:</p>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full rounded border-2 border-slate-600 bg-white cursor-crosshair"
                  onPointerDown={startDraw}
                  onPointerMove={draw}
                  onPointerUp={endDraw}
                  onPointerCancel={endDraw}
                  style={{ touchAction: 'none' }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={clearCanvas}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowSignatureModal(false); clearCanvas(); setSignatureName(''); setSignatureColor('#111827'); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveSignature}
                >
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
