import { useState } from 'react';
import FileUploader from '../shared/FileUploader';
import { addTextToPDF, downloadPdfBytes } from '../../utils/pdfHelpers';

export default function EditPDF() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [text, setText] = useState('Approved');
  const [pageNumber, setPageNumber] = useState(1);
  const [x, setX] = useState(72);
  const [y, setY] = useState(72);
  const [size, setSize] = useState(16);
  const [error, setError] = useState('');

  const apply = async () => {
    if (!pdfFile || !text.trim()) {
      setError('Select a PDF and enter annotation text.');
      return;
    }
    setError('');
    try {
      const bytes = await addTextToPDF({ pdfFile, text, pageNumber, x, y, size });
      downloadPdfBytes(bytes, 'edited.pdf');
    } catch {
      setError('Unable to edit this PDF. Some advanced PDFs are not supported in-browser.');
    }
  };

  return (
    <div className="space-y-3">
      <FileUploader label="PDF to edit" accept=".pdf"
        onChange={(files) => { const f = files?.[0] ?? null; setPdfFile(f); setPdfFileName(f?.name ?? ''); }}
        loadedLabel={pdfFileName || null}
        onClear={() => { setPdfFile(null); setPdfFileName(''); setError(''); }}
      />
      <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Annotation text" />
      <div className="grid grid-cols-4 gap-2">
        <input className="input" type="number" min="1" value={pageNumber} onChange={(e) => setPageNumber(Number(e.target.value))} placeholder="Page" />
        <input className="input" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} placeholder="X" />
        <input className="input" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} placeholder="Y" />
        <input className="input" type="number" min="6" value={size} onChange={(e) => setSize(Number(e.target.value))} placeholder="Size" />
      </div>
      <button type="button" className="btn-primary" onClick={apply}>
        Apply Text And Download
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
