import { useState } from "react";
import FileUploader from "../shared/FileUploader";
import { compressPdfBytes, downloadPdfBytes } from "../../utils/pdfHelpers";
const LEVELS = [
  { value: "low", label: "Low (quick, minimal changes)" },
  { value: "medium", label: "Medium (recommended)" },
  { value: "high", label: "High (rebuild pages, may be slower)" }
];
export default function CompressPDF() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [level, setLevel] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState("");
  const [error, setError] = useState("");
  const compress = async () => {
    if (!file) { setError("Choose a PDF first."); return; }
    setError(""); setResultText(""); setLoading(true);
    try {
      const inputBytes = await file.arrayBuffer();
      const outputBytes = await compressPdfBytes(inputBytes, level);
      const before = inputBytes.byteLength, after = outputBytes.byteLength;
      const diff = (((before - after) / before) * 100).toFixed(1);
      setResultText("Before: " + (before/1024/1024).toFixed(2) + " MB, After: " + (after/1024/1024).toFixed(2) + " MB (" + diff + "% change).");
      downloadPdfBytes(outputBytes, "compressed.pdf");
    } catch { setError("Compression failed for this PDF."); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-3">
      <FileUploader
        label="PDF to compress"
        accept=".pdf"
        onChange={(files) => { const f = files?.[0] ?? null; setFile(f); setFileName(f?.name ?? ""); setResultText(""); setError(""); }}
        helperText="Compression works by rewriting PDF objects in-browser. Results vary by file type."
        loadedLabel={fileName || null}
        onClear={() => { setFile(null); setFileName(""); setResultText(""); setError(""); }}
      />
      {file && (
        <>
          <select className="input" value={level} onChange={(event) => setLevel(event.target.value)}>
            {LEVELS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={compress} disabled={loading}>
            {loading ? "Compressing..." : "Compress and Download"}
          </button>
          {resultText ? <p className="text-sm text-emerald-300">{resultText}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </>
      )}
    </div>
  );
}
