import { useMemo, useState } from "react";
import FileUploader from "../shared/FileUploader";
import { downloadPdfBytes, imagesToPdfBytes } from "../../utils/pdfHelpers";
export default function ImageToPDF() {
  const [files, setFiles] = useState([]);
  const [filesLabel, setFilesLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const totalSizeMb = useMemo(() => {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    return (total / 1024 / 1024).toFixed(2);
  }, [files]);
  const createPdf = async () => {
    if (!files.length) { setError("Select at least one image."); return; }
    setError(""); setLoading(true);
    try {
      const bytes = await imagesToPdfBytes(files);
      downloadPdfBytes(bytes, "images.pdf");
    } catch { setError("Could not convert images to PDF."); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-3">
      <FileUploader
        label="Upload images"
        accept=".png,.jpg,.jpeg,.webp,.gif,.bmp"
        multiple
        onChange={(selected) => {
          const arr = Array.from(selected || []);
          setFiles(arr);
          setFilesLabel(arr.length ? arr.length + " image" + (arr.length > 1 ? "s" : "") + " selected" : "");
          setError("");
        }}
        helperText="Images are added as one page each."
        loadedLabel={filesLabel || null}
        onClear={() => { setFiles([]); setFilesLabel(""); setError(""); }}
      />
      {files.length > 0 && (
        <>
          <p className="text-xs text-slate-400">{files.length} image(s), {totalSizeMb} MB total</p>
          <ul className="max-h-48 space-y-1 overflow-auto rounded border border-slate-700 p-2 text-xs">
            {files.map((file, index) => (
              <li key={file.name + "-" + index} className="truncate">{index + 1}. {file.name}</li>
            ))}
          </ul>
          <button type="button" className="btn-primary" onClick={createPdf} disabled={loading}>
            {loading ? "Creating PDF..." : "Create PDF"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </>
      )}
    </div>
  );
}
