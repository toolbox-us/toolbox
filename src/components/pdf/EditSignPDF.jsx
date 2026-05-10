import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import FileUploader from '../shared/FileUploader';
import { applyPdfOperations, downloadPdfBytes, getPdfPageCount } from '../../utils/pdfHelpers';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TOOL_OPTIONS = [
  { key: 'text',  icon: '✏️', label: 'Text' },
  { key: 'date',  icon: '📅', label: 'Sign Date' },
  { key: 'shape', icon: '🔲', label: 'Shape' },
  { key: 'sign',  icon: '✍️', label: 'Signature' }
];
const SIGNATURE_COLORS = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#111827', label: 'Black' },
  { value: '#dc2626', label: 'Red' }
];
const FONT_OPTIONS = ['Helvetica', 'TimesRoman', 'Courier'];

const SHAPE_KINDS = [
  { value: 'rect',     label: 'Rectangle', icon: '▭' },
  { value: 'ellipse',  label: 'Ellipse',   icon: '⬭' },
  { value: 'triangle', label: 'Triangle',  icon: '▲' },
  { value: 'line',     label: 'Line',      icon: '╱' },
  { value: 'arrow',    label: 'Arrow →',   icon: '→' },
  { value: 'star',     label: 'Star',      icon: '★' },
];

// All 8 resize handle definitions
const RESIZE_HANDLES = [
  { id: 'nw', cur: 'nw-resize', style: { top: -5,    left: -5   } },
  { id: 'n',  cur: 'n-resize',  style: { top: -5,    left: '50%', transform: 'translateX(-50%)' } },
  { id: 'ne', cur: 'ne-resize', style: { top: -5,    right: -5  } },
  { id: 'e',  cur: 'e-resize',  style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { id: 'se', cur: 'se-resize', style: { bottom: -5, right: -5  } },
  { id: 's',  cur: 's-resize',  style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
  { id: 'sw', cur: 'sw-resize', style: { bottom: -5, left: -5   } },
  { id: 'w',  cur: 'w-resize',  style: { top: '50%', left: -5,  transform: 'translateY(-50%)' } }
];

function createOperationId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getOpDimensions(op) {
  return {
    w: op.width  ?? 180,
    h: op.height ?? (op.type === 'text' || op.type === 'date' ? Math.max((op.size ?? 16) * 1.4, 28) : 60)
  };
}

// ─── ShapePreviewSvg ──────────────────────────────────────────────
// Renders the correct SVG shape inside the frame, viewBox 0 0 100 100
// with preserveAspectRatio="none" so it stretches to fill the frame.
function ShapePreviewSvg({ op }) {
  const stroke = op.borderColor ?? '#ef4444';
  const fill   = op.fillColor   ?? '#ffffff';
  const sw   = Math.max(0.5, (op.borderWidth ?? 2) * 0.8);
  const kind = op.shapeKind ?? 'rect';
  const noFill = kind === 'line' || kind === 'arrow';
  const f = noFill ? 'none' : fill;

  if (kind === 'ellipse') {
    return <ellipse cx={50} cy={50} rx={50 - sw / 2} ry={50 - sw / 2} fill={f} stroke={stroke} strokeWidth={sw} />;
  }
  if (kind === 'triangle') {
    return <polygon points={`50,${(sw / 2).toFixed(1)} ${(100 - sw / 2).toFixed(1)},${(100 - sw / 2).toFixed(1)} ${(sw / 2).toFixed(1)},${(100 - sw / 2).toFixed(1)}`} fill={f} stroke={stroke} strokeWidth={sw} />;
  }
  if (kind === 'line') {
    return <line x1={2} y1={50} x2={98} y2={50} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
  }
  if (kind === 'arrow') {
    const ah = 18;
    return (
      <>
        <line x1={2} y1={50} x2={100 - ah - 1} y2={50} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <polygon points={`99,50 ${100 - ah},${50 - ah / 2} ${100 - ah},${50 + ah / 2}`} fill={stroke} />
      </>
    );
  }
  if (kind === 'star') {
    const cx = 50, cy = 50, outerR = 48 - sw, innerR = outerR * 0.42;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI / 5) - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');
    return <polygon points={pts} fill={f} stroke={stroke} strokeWidth={sw} />;
  }
  // rect (default)
  return <rect x={sw / 2} y={sw / 2} width={100 - sw} height={100 - sw} fill={f} stroke={stroke} strokeWidth={sw} />;
}

// ─── OperationFrame ───────────────────────────────────────────────
// Draggable + resizable overlay rendered on the PDF preview canvas.
function OperationFrame({
  op,
  zoom,
  pageHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDragStart,
  shouldAutoFocus,
  onAutoFocused
}) {
  const { w, h } = getOpDimensions(op);
  // PDF coords: origin bottom-left. Screen coords: origin top-left.
  const sl = Math.round(op.x * zoom);
  const st = Math.round((pageHeight - op.y - h) * zoom);
  const sw = Math.max(22, Math.round(w * zoom));
  const sh = Math.max(14, Math.round(h * zoom));

  const canResize = op.type === 'shape' || op.type === 'sign' || op.type === 'text' || op.type === 'date';
  const isTextBox = op.type === 'text' || op.type === 'date';
  const accent = isSelected ? '#3b82f6' : (op.type === 'shape' ? (op.borderColor ?? '#ef4444') : (op.color ?? '#3b82f6'));

  function startMove(e) {
    if (e.button !== 0) return;
    if (e.target.closest('textarea, input, button')) return;
    e.preventDefault(); e.stopPropagation();
    onDragStart?.();
    onSelect(op.id);
    const mx0 = e.clientX, my0 = e.clientY, x0 = op.x, y0 = op.y;
    const onMove = (me) => onUpdate(op.id, {
      x: Math.max(0, Math.round(x0 + (me.clientX - mx0) / zoom)),
      y: Math.max(0, Math.round(y0 - (me.clientY - my0) / zoom))
    });
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startResize(handleId, e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onDragStart?.();
    const { w: w0, h: h0 } = getOpDimensions(op);
    const mx0 = e.clientX, my0 = e.clientY, x0 = op.x, y0 = op.y;
    const minW = isTextBox ? 70 : 20;
    const minH = isTextBox ? 28 : 10;
    const onMove = (me) => {
      const dx = (me.clientX - mx0) / zoom;
      const dy = (me.clientY - my0) / zoom;
      let nx = x0, ny = y0, nw = w0, nh = h0;
      if (handleId.includes('e')) nw = Math.max(minW, w0 + dx);
      if (handleId.includes('w')) { nx = x0 + dx; nw = Math.max(minW, w0 - dx); }
      if (handleId.includes('s')) { ny = Math.max(0, y0 - dy); nh = Math.max(minH, h0 + dy); }
      if (handleId.includes('n')) nh = Math.max(minH, h0 - dy);
      onUpdate(op.id, { x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const borderStyle = isTextBox
    ? `2px dotted ${accent}`
    : `2px ${isSelected ? 'solid' : 'dashed'} ${accent}`;

  // Title label shown in the 14px header bar
  const titleLabel = op.type === 'text' ? 'TEXT'
    : op.type === 'date' ? 'DATE'
    : op.type === 'shape' ? (SHAPE_KINDS.find(s => s.value === (op.shapeKind ?? 'rect'))?.label ?? 'Shape').toUpperCase()
    : op.type.toUpperCase();

  return (
    <div
      style={{
        position: 'absolute',
        left: sl, top: st, width: sw, height: sh,
        border: borderStyle,
        background: isTextBox ? 'rgba(255,255,255,0.08)' : 'transparent',
        boxSizing: 'border-box',
        userSelect: 'none',
        zIndex: isSelected ? 20 : 10
      }}
      onMouseDown={startMove}
      onClick={(e) => { e.stopPropagation(); onSelect(op.id); }}
    >
      {/* Header bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, cursor: 'move', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 9, lineHeight: '14px', padding: '0 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {titleLabel}
      </div>

      {/* Text input */}
      {op.type === 'text' && (
        <textarea
          value={op.text ?? ''}
          placeholder="Insert text here"
          autoFocus={Boolean(shouldAutoFocus)}
          onFocus={() => onAutoFocused?.(op.id)}
          onChange={(e) => onUpdate(op.id, { text: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: 14, width: '100%', height: 'calc(100% - 14px)',
            border: 'none', outline: 'none', padding: '4px 6px', margin: 0, resize: 'none',
            background: 'transparent', color: op.color ?? '#111827',
            fontFamily: op.font === 'TimesRoman' ? 'Georgia,"Times New Roman",serif' : (op.font === 'Courier' ? '"Courier New",Courier,monospace' : 'Arial,Helvetica,sans-serif'),
            fontSize: `${Math.max(10, (op.size ?? 16) * zoom)}px`, lineHeight: 1.3, boxSizing: 'border-box'
          }}
        />
      )}

      {/* Date input */}
      {op.type === 'date' && (
        <input
          type="date" value={op.text ?? ''}
          autoFocus={Boolean(shouldAutoFocus)}
          onFocus={() => onAutoFocused?.(op.id)}
          onChange={(e) => onUpdate(op.id, { text: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: 14, width: '100%', height: 'calc(100% - 14px)',
            border: 'none', outline: 'none', padding: '4px 6px', background: 'transparent',
            color: op.color ?? '#111827', fontFamily: 'Arial,Helvetica,sans-serif',
            fontSize: `${Math.max(10, (op.size ?? 16) * zoom)}px`, boxSizing: 'border-box'
          }}
        />
      )}

      {/* Signature preview */}
      {!isTextBox && op.type === 'sign' && op.signaturePngDataUrl && (
        <img
          src={op.signaturePngDataUrl}
          alt="signature preview"
          draggable={false}
          style={{ position: 'absolute', top: 14, left: 0, width: '100%', height: 'calc(100% - 14px)', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
        />
      )}

      {/* Shape preview (SVG) */}
      {!isTextBox && op.type === 'shape' && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 14, left: 0, width: '100%', height: 'calc(100% - 14px)', pointerEvents: 'none', overflow: 'visible' }}
        >
          <ShapePreviewSvg op={op} />
        </svg>
      )}

      {/* Fallback label for unknown types */}
      {!isTextBox && op.type !== 'sign' && op.type !== 'shape' && (
        <div style={{ position: 'absolute', inset: 0, cursor: 'move', overflow: 'hidden' }}>
          <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '1px 3px', display: 'block' }}>
            {op.type.toUpperCase()}
          </span>
        </div>
      )}

      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(op.id); }} style={{ position: 'absolute', top: -10, right: -10, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 30 }} title="Remove">×</button>
      {canResize && RESIZE_HANDLES.map((rh) => (
        <div key={rh.id} onMouseDown={(e) => startResize(rh.id, e)} style={{ position: 'absolute', width: 10, height: 10, background: accent, borderRadius: 2, cursor: rh.cur, zIndex: 25, ...rh.style }} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function EditSignPDF() {
  const [workingBytes, setWorkingBytes] = useState(null);
  const [loadedFileName, setLoadedFileName] = useState('');
  const [pdfDoc, setPdfDoc]             = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [isMaximized, setIsMaximized]   = useState(false);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageHeight, setPageHeight]     = useState(0);
  const [operations, setOperations]     = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [error, setError]               = useState('');
  const [activeTool, setActiveTool]     = useState('text');

  const [x, setX]                                   = useState(80);
  const [y, setY]                                   = useState(80);
  const [size, setSize]                             = useState(16);
  const [font, setFont]                             = useState('Helvetica');
  const [textColor, setTextColor]                   = useState('#111827');
  const [frameWidth, setFrameWidth]                 = useState(180);
  const [frameHeight, setFrameHeight]               = useState(70);
  const [text, setText]                             = useState('');
  const [dateValue, setDateValue]                   = useState(new Date().toISOString().slice(0, 10));
  const [shapeBorderColor, setShapeBorderColor]     = useState('#ef4444');
  const [shapeFillColor, setShapeFillColor]         = useState('#ffffff');
  const [shapeFillNone, setShapeFillNone]           = useState(false);
  const [shapeBorderWidth, setShapeBorderWidth]     = useState(2);
  const [shapeKind, setShapeKind]                   = useState('rect');
  const [signatureColor, setSignatureColor]         = useState('#111827');
  const [signatureLineWidth, setSignatureLineWidth] = useState(2);
  const [drawing, setDrawing]                       = useState(false);
  const [isTextModalOpen, setIsTextModalOpen]       = useState(false);
  const [isDateModalOpen, setIsDateModalOpen]       = useState(false);
  const [isShapeModalOpen, setIsShapeModalOpen]     = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  const [pendingTextFocusId, setPendingTextFocusId] = useState(null);

  // Undo / redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const signatureCanvasRef  = useRef(null);
  const previewCanvasRef    = useRef(null);
  const previewContainerRef = useRef(null);
  const undoFnRef           = useRef(null);
  const redoFnRef           = useRef(null);


  // ── History ─────────────────────────────────────────────────────
  const pushHistory = () => {
    setUndoStack(prev => [...prev.slice(-19), { operations, workingBytes }]);
    setRedoStack([]);
  };

  const doUndo = () => {
    if (!undoStack.length) return;
    const snapshot = undoStack[undoStack.length - 1];
    setRedoStack(prev => [{ operations, workingBytes }, ...prev.slice(0, 19)]);
    setUndoStack(prev => prev.slice(0, -1));
    setOperations(snapshot.operations);
    setSelectedId(null);
    if (snapshot.workingBytes !== workingBytes) {
      setWorkingBytes(snapshot.workingBytes);
      getDocument({ data: snapshot.workingBytes.slice() }).promise
        .then(doc => setPdfDoc(doc)).catch(() => {});
    }
  };

  const doRedo = () => {
    if (!redoStack.length) return;
    const snapshot = redoStack[0];
    setUndoStack(prev => [...prev.slice(-19), { operations, workingBytes }]);
    setRedoStack(prev => prev.slice(1));
    setOperations(snapshot.operations);
    setSelectedId(null);
    if (snapshot.workingBytes !== workingBytes) {
      setWorkingBytes(snapshot.workingBytes);
      getDocument({ data: snapshot.workingBytes.slice() }).promise
        .then(doc => setPdfDoc(doc)).catch(() => {});
    }
  };

  // Always keep refs current for keyboard handler
  undoFnRef.current = doUndo;
  redoFnRef.current = doRedo;

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoFnRef.current?.(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoFnRef.current?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Sync toolbar when frame selected ────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const op = operations.find(o => o.id === selectedId);
    if (!op) return;
    setActiveTool(op.type);
    setX(op.x); setY(op.y);
    if (op.type === 'text' || op.type === 'date') {
      if (op.type === 'text') setText(op.text ?? ''); else setDateValue(op.text ?? '');
      setFont(op.font ?? 'Helvetica'); setSize(op.size ?? 16); setTextColor(op.color ?? '#111827');
      setFrameWidth(op.width ?? 180); setFrameHeight(op.height ?? Math.max((op.size ?? 16) * 1.4, 28));
    } else if (op.type === 'shape') {
      setFrameWidth(op.width ?? 180); setFrameHeight(op.height ?? 60);
      setShapeBorderColor(op.borderColor ?? '#ef4444');
      setShapeFillColor(op.fillColor === 'none' ? '#ffffff' : (op.fillColor ?? '#ffffff'));
      setShapeFillNone(op.fillColor === 'none');
      setShapeBorderWidth(op.borderWidth ?? 2);
      setShapeKind(op.shapeKind ?? 'rect');
    } else if (op.type === 'sign') {
      setFrameWidth(op.width ?? 180); setFrameHeight(op.height ?? 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── PDF rendering ────────────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    const renderPage = async () => {
      if (!pdfDoc || !previewCanvasRef.current) return;
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = previewCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (!canceled) setPageHeight(page.getViewport({ scale: 1 }).height);
    };
    renderPage().catch(() => setError('Unable to render PDF preview.'));
    return () => { canceled = true; };
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => () => { pdfDoc?.destroy?.(); }, [pdfDoc]);

  const resetLoadedPdf = () => {
    setWorkingBytes(null); setLoadedFileName(''); setPdfDoc(null);
    setPageCount(0); setCurrentPage(1); setPageHeight(0);
    setOperations([]); setSelectedId(null);
    setUndoStack([]); setRedoStack([]);
    setPendingTextFocusId(null); setError('');
    setZoom(1); setIsMaximized(false);
    setDrawing(false); setShapeKind('rect'); setShapeFillNone(false);
    setIsTextModalOpen(false); setIsDateModalOpen(false); setIsShapeModalOpen(false); setIsSignatureModalOpen(false);
  };

  // ── File load ────────────────────────────────────────────────────
  const onFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const bytes  = new Uint8Array(await file.arrayBuffer());
      const count  = await getPdfPageCount(bytes);
      const loaded = await getDocument({ data: bytes.slice() }).promise;
      let fitZoom = 1;
      if (previewContainerRef.current) {
        const page = await loaded.getPage(1);
        const natural = page.getViewport({ scale: 1 });
        const containerW = previewContainerRef.current.clientWidth - 20;
        fitZoom = Math.max(0.4, Math.min(3.0, parseFloat((containerW / natural.width).toFixed(2))));
      }
      setWorkingBytes(bytes); setPdfDoc(loaded);
      setPageCount(count); setCurrentPage(1);
      setOperations([]); setSelectedId(null);
      setUndoStack([]); setRedoStack([]);
      setPendingTextFocusId(null);
      setLoadedFileName(file.name);
      setZoom(fitZoom); setError('');
    } catch { setError('Unable to load this PDF.'); }
  };

  // ── Signature drawing ────────────────────────────────────────────
  const startDraw = (e) => {
    const ctx = signatureCanvasRef.current.getContext('2d');
    ctx.strokeStyle = signatureColor; ctx.lineWidth = signatureLineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setDrawing(true);
  };
  const draw = (e) => {
    if (!drawing) return;
    const ctx = signatureCanvasRef.current.getContext('2d');
    ctx.strokeStyle = signatureColor; ctx.lineWidth = signatureLineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };
  const endDraw = () => setDrawing(false);
  const clearCanvas = () => {
    const c = signatureCanvasRef.current;
    if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  };

  // ── Canvas click: place a new text/date box ──────────────────────
  const handleCanvasClick = (e) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !pageHeight) return;
    const b = canvas.getBoundingClientRect();
    const px = (e.clientX - b.left) * (canvas.width / b.width);
    const py = (e.clientY - b.top)  * (canvas.height / b.height);
    const newX = Math.max(0, Math.round(px / zoom));
    const newY = Math.max(0, Math.round(pageHeight - py / zoom));
    if (activeTool === 'text' || activeTool === 'date') {
      pushHistory();
      const op = {
        id: createOperationId(), type: activeTool, pageNumber: currentPage,
        x: newX, y: newY,
        text: activeTool === 'date' ? dateValue : '',
        size, color: textColor, font,
        width: frameWidth, height: Math.max(frameHeight, Math.round(size * 1.4))
      };
      setOperations(prev => [...prev, op]);
      setSelectedId(op.id); setPendingTextFocusId(op.id); setError('');
      return;
    }
    setX(newX); setY(newY); setSelectedId(null);
  };

  // ── Operation helpers ────────────────────────────────────────────
  const updateOperation = (id, changes) =>
    setOperations(prev => prev.map(op => op.id === id ? { ...op, ...changes } : op));

  const removeOperation = (id) => {
    pushHistory();
    setOperations(prev => prev.filter(op => op.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDragStart = () => pushHistory();

  const update = (setter, opKey, transform = v => v) => (raw) => {
    const val = transform(raw);
    setter(val);
    if (selectedId) updateOperation(selectedId, { [opKey]: val });
  };

  const addOperation = () => {
    if (!workingBytes) { setError('Load a PDF first.'); return; }
    pushHistory();
    let op = { id: createOperationId(), type: activeTool, pageNumber: currentPage, x, y };
    if (activeTool === 'sign') {
      op = { ...op, signaturePngDataUrl: signatureCanvasRef.current.toDataURL('image/png'), width: frameWidth, height: frameHeight };
    } else if (activeTool === 'shape') {
      op = { ...op, shapeKind, width: frameWidth, height: frameHeight, borderColor: shapeBorderColor, fillColor: shapeFillNone ? 'none' : shapeFillColor, borderWidth: shapeBorderWidth };
    } else {
      op = { ...op, text: activeTool === 'date' ? dateValue : text.trim(), size, color: textColor, font, width: frameWidth, height: frameHeight };
    }
    setOperations(prev => [...prev, op]);
    setSelectedId(op.id); setError('');
  };

  const applyAll = async () => {
    if (!workingBytes) { setError('Select a PDF first.'); return; }
    if (!operations.length) { setError('Add at least one operation.'); return; }
    try {
      pushHistory();
      const updated = await applyPdfOperations({ pdfBytes: workingBytes, operations });
      setWorkingBytes(updated);
      const loaded = await getDocument({ data: updated.slice() }).promise;
      setPdfDoc(loaded); setOperations([]); setSelectedId(null); setError('');
    } catch { setError('Unable to apply operations to this PDF.'); }
  };

  const downloadCurrent = () => workingBytes && downloadPdfBytes(workingBytes, 'edited-signed.pdf');

  const currentPageOps = operations.filter(op => op.pageNumber === currentPage);
  const zoomPct        = Math.round(zoom * 100);

  const colorPicker = (label, value, onChange) => (
    <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-transparent p-0" />
    </label>
  );

  const numInput = (label, value, onChange, min = 1, maxWidth = 'max-w-[64px]') => (
    <label className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
      {label}
      <input className={`input ${maxWidth}`} type="number" min={min} value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)} />
    </label>
  );

  const drawerControls = (
    <>
      {!workingBytes ? (
        <FileUploader
          label="PDF to edit and sign"
          accept=".pdf"
          onChange={onFiles}
          helperText="Click PDF to place a dotted text or date box, drag to move, resize with handles, and use Ctrl+Z / Ctrl+Y for history."
        />
      ) : null}

      {workingBytes ? (
        <div className="rounded border border-slate-700 bg-slate-900/80 p-3 space-y-3">
          <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-1.5">
            {TOOL_OPTIONS.map(tool => (
              <button
                key={tool.key} type="button"
                className={`${activeTool === tool.key ? 'btn-primary' : 'btn-secondary'} !h-9 !w-9 !p-0 text-base`}
                onClick={() => {
                  setActiveTool(tool.key); setSelectedId(null); setPendingTextFocusId(null);
                  setIsTextModalOpen(tool.key === 'text');
                  setIsDateModalOpen(tool.key === 'date');
                  setIsShapeModalOpen(tool.key === 'shape');
                  setIsSignatureModalOpen(tool.key === 'sign');
                }}
                aria-label={tool.label} title={tool.label}
              >
                <span aria-hidden="true">{tool.icon}</span>
              </button>
            ))}

            {workingBytes && pageCount > 0 ? (
              <>
                <select className="input !w-auto max-w-[110px]" value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))}>
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary" onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.2).toFixed(1))))}>−</button>
                <span className="text-xs text-slate-300 min-w-[36px] text-center shrink-0">{zoomPct}%</span>
                <button type="button" className="btn-secondary" onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.2).toFixed(1))))}>+</button>
              </>
            ) : null}

            {workingBytes ? (
              <div className="ml-auto flex items-center gap-1.5 pl-2">
                <button type="button" className="btn-secondary" title="Undo (Ctrl+Z)" disabled={!undoStack.length} onClick={doUndo}>↩</button>
                <button type="button" className="btn-secondary" title="Redo (Ctrl+Y)" disabled={!redoStack.length} onClick={doRedo}>↪</button>
                <button type="button" className="btn-secondary" onClick={() => setIsMaximized(v => !v)} title="Toggle fullscreen">{isMaximized ? '⬛' : '⬜'}</button>
                <button type="button" className="btn-primary" onClick={applyAll} disabled={!operations.length}>Apply ({operations.length})</button>
                <button type="button" className="btn-secondary" onClick={downloadCurrent} disabled={!workingBytes}>⬇ PDF</button>
              </div>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3">
      {drawerControls}

      <div className="space-y-3">
        {workingBytes ? (
          <div ref={previewContainerRef} className={`rounded border border-slate-700 p-2 overflow-y-auto overflow-x-auto ${isMaximized ? 'fixed inset-0 z-30 bg-slate-950' : 'max-h-[72vh]'}`}>
            {isMaximized && (
              <div className="sticky top-0 z-40 mb-2 flex justify-end bg-slate-950/90 pb-1">
                <button type="button" className="btn-secondary" onClick={() => setIsMaximized(false)}>⬛ Restore</button>
              </div>
            )}
            <div className="flex w-full justify-center">
              <div className="relative inline-block">
                {pdfDoc ? (
                  <canvas
                    ref={previewCanvasRef}
                    className="block rounded border border-slate-700 bg-white"
                    onClick={handleCanvasClick}
                    style={{ cursor: activeTool === 'text' || activeTool === 'date' ? 'text' : 'crosshair' }}
                  />
                ) : null}

                {pdfDoc && pageHeight > 0 && currentPageOps.map(op => (
                  <OperationFrame
                    key={op.id} op={op} zoom={zoom} pageHeight={pageHeight}
                    isSelected={selectedId === op.id}
                    onSelect={setSelectedId}
                    onClearSelection={() => setSelectedId(null)}
                    onUpdate={updateOperation}
                    onDelete={removeOperation}
                    onDragStart={handleDragStart}
                    shouldAutoFocus={pendingTextFocusId === op.id}
                    onAutoFocused={() => setPendingTextFocusId(null)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* ── Text modal ── */}
      {isTextModalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9998]">
          <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setIsTextModalOpen(false)} aria-label="Close text options" />
          <div role="dialog" aria-modal="true" aria-labelledby="text-options-title" className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="text-options-title" className="text-sm font-semibold text-slate-100">Text Options</h3>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setIsTextModalOpen(false)} aria-label="Close text options">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input max-w-[220px]" value={text} placeholder="Type default text"
                onChange={(e) => { setText(e.target.value); if (selectedId) updateOperation(selectedId, { text: e.target.value }); }} />
              <select className="input max-w-[130px]" value={font}
                onChange={(e) => { setFont(e.target.value); if (selectedId) updateOperation(selectedId, { font: e.target.value }); }}>
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {numInput('Size', size, (v) => { setSize(v); if (selectedId) updateOperation(selectedId, { size: v }); }, 6)}
              {colorPicker('Color', textColor, (v) => { setTextColor(v); if (selectedId) updateOperation(selectedId, { color: v }); })}
              {numInput('W', frameWidth, update(setFrameWidth, 'width', v => v), 40)}
              {numInput('H', frameHeight, update(setFrameHeight, 'height', v => v), 20)}
            </div>
            <div className="mt-3 flex items-center justify-end">
              <button type="button" className="btn-primary" onClick={() => setIsTextModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* ── Date modal ── */}
      {isDateModalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9998]">
          <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setIsDateModalOpen(false)} aria-label="Close date options" />
          <div role="dialog" aria-modal="true" aria-labelledby="date-options-title" className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="date-options-title" className="text-sm font-semibold text-slate-100">Date Options</h3>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setIsDateModalOpen(false)} aria-label="Close date options">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input max-w-[170px]" type="date" value={dateValue}
                onChange={(e) => { setDateValue(e.target.value); if (selectedId) updateOperation(selectedId, { text: e.target.value }); }} />
              <select className="input max-w-[130px]" value={font}
                onChange={(e) => { setFont(e.target.value); if (selectedId) updateOperation(selectedId, { font: e.target.value }); }}>
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {numInput('Size', size, (v) => { setSize(v); if (selectedId) updateOperation(selectedId, { size: v }); }, 6)}
              {colorPicker('Color', textColor, (v) => { setTextColor(v); if (selectedId) updateOperation(selectedId, { color: v }); })}
              {numInput('W', frameWidth, update(setFrameWidth, 'width', v => v), 40)}
              {numInput('H', frameHeight, update(setFrameHeight, 'height', v => v), 20)}
            </div>
            <div className="mt-3 flex items-center justify-end">
              <button type="button" className="btn-primary" onClick={() => setIsDateModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* ── Shape modal ── */}
      {isShapeModalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9998]">
          <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setIsShapeModalOpen(false)} aria-label="Close shape options" />
          <div role="dialog" aria-modal="true" aria-labelledby="shape-options-title" className="absolute left-1/2 top-1/2 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="shape-options-title" className="text-sm font-semibold text-slate-100">Shape Options</h3>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setIsShapeModalOpen(false)} aria-label="Close shape options">✕</button>
            </div>

            {/* Kind picker */}
            <div className="flex gap-1.5">
              {SHAPE_KINDS.map(k => (
                <button
                  key={k.value}
                  type="button"
                  title={k.label}
                  className={`h-9 w-9 flex items-center justify-center text-lg rounded border transition ${
                    shapeKind === k.value
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                  }`}
                  onClick={() => { setShapeKind(k.value); if (selectedId) updateOperation(selectedId, { shapeKind: k.value }); }}
                >
                  {k.icon}
                </button>
              ))}
            </div>

            {/* Style controls */}
            <div className="flex flex-wrap items-center gap-3">
              {colorPicker('Stroke', shapeBorderColor, update(setShapeBorderColor, 'borderColor'))}
              {(shapeKind !== 'line' && shapeKind !== 'arrow') && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={shapeFillNone ? 'No fill (click to enable fill)' : 'Fill enabled (click for no fill)'}
                    onClick={() => {
                      const next = !shapeFillNone;
                      setShapeFillNone(next);
                      if (selectedId) updateOperation(selectedId, { fillColor: next ? 'none' : shapeFillColor });
                    }}
                    className={`h-7 w-7 flex items-center justify-center rounded border text-xs transition ${
                      shapeFillNone
                        ? 'bg-slate-700 border-slate-500 text-slate-300'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="1" y="1" width="12" height="12" rx="1.5" />
                      <line x1="2" y1="2" x2="12" y2="12" />
                    </svg>
                  </button>
                  {!shapeFillNone && colorPicker('Fill', shapeFillColor, (v) => {
                    setShapeFillColor(v);
                    if (selectedId) updateOperation(selectedId, { fillColor: v });
                  })}
                  {shapeFillNone && <span className="text-xs text-slate-500">No fill</span>}
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
                Stroke
                <input
                  type="range" min="0.5" max="20" step="0.5"
                  value={shapeBorderWidth}
                  onChange={(e) => { const v = Number(e.target.value); setShapeBorderWidth(v); if (selectedId) updateOperation(selectedId, { borderWidth: v }); }}
                  className="w-28"
                />
                <span className="min-w-[28px] text-right text-slate-200">{shapeBorderWidth}</span>
              </label>
            </div>

            {/* Mini live preview */}
            <div className="flex items-center gap-3 pt-1">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: 120, height: 60, background: '#1e293b', borderRadius: 6, border: '1px solid #334155', flexShrink: 0 }}
              >
                <ShapePreviewSvg op={{ shapeKind, borderColor: shapeBorderColor, fillColor: shapeFillNone ? 'none' : shapeFillColor, borderWidth: shapeBorderWidth }} />
              </svg>
              <span className="text-xs text-slate-400">Live preview · Click PDF to set position, then add.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end border-t border-slate-800 pt-2">
              <button type="button" className="btn-primary" onClick={() => { addOperation(); setIsShapeModalOpen(false); }}>➕ Add Shape</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* ── Signature modal ── */}
      {isSignatureModalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9998]">
          <button type="button" className="absolute inset-0 bg-black/65" onClick={() => setIsSignatureModalOpen(false)} aria-label="Close signature pad" />
          <div role="dialog" aria-modal="true" aria-labelledby="signature-pad-title" className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="signature-pad-title" className="text-sm font-semibold text-slate-100">Signature Pad</h3>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => setIsSignatureModalOpen(false)} aria-label="Close signature pad">✕</button>
            </div>
            <canvas
              ref={signatureCanvasRef}
              width={420} height={130}
              className="w-full rounded border border-slate-700 bg-white"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">Pen</span>
                <div className="flex items-center gap-2" role="radiogroup" aria-label="Signature pen color">
                  {SIGNATURE_COLORS.map((item) => {
                    const isActive = signatureColor === item.value;
                    return (
                      <button key={item.value} type="button" role="radio" aria-checked={isActive} aria-label={item.label} title={item.label}
                        onClick={() => setSignatureColor(item.value)}
                        className={`h-7 w-7 rounded-full border-2 transition ${isActive ? 'border-white' : 'border-slate-500'}`}
                        style={{ backgroundColor: item.value }}
                      />
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Thick
                <input type="range" min="1" max="12" step="0.5" value={signatureLineWidth}
                  onChange={(e) => setSignatureLineWidth(Number(e.target.value))} className="w-44" />
                <span className="min-w-[32px] text-right text-slate-200">{signatureLineWidth}</span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" onClick={clearCanvas}>Clear</button>
              <span className="text-xs text-slate-400">Draw, click PDF to place, then add signature.</span>
              <button type="button" className="btn-primary ml-auto" onClick={() => { addOperation(); setIsSignatureModalOpen(false); }}>➕ Add Signature</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
