import { useState } from "react";
import FileUploader from "../shared/FileUploader";
import { downloadPdfBytes, mergePDFFiles } from "../../utils/pdfHelpers";
export default function MergePDF() {
  const [files, setFiles] = useState([]);
  const [filesLabel, setFilesLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const onFiles = (incomingFiles) => {
    const arr = Array.from(incomingFiles || []);
    setFiles(arr);
    setFilesLabel(arr.length ? arr.length + " PDF" + (arr.length > 1 ? "s" : "") + " selected" : "");
    setError("");
  };
  const moveFile = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= files.length || fromIndex === toIndex) return;
    const next = [...files];
    const [movedFile] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, movedFile);
    setFiles(next);
  };
  const onDragStart = (event, index) => {
    event.dataTransfer.setData("text/plain", String(index));
    event.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (event, dropIndex) => {
    event.preventDefault();
    const dragIndex = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isNaN(dragIndex) || dragIndex === dropIndex) return;
    moveFile(dragIndex, dropIndex);
  };
  const merge = async () => {
    if (files.length < 2) { setError("Select at least two PDFs."); return; }
    setLoading(true); setError("");
    try {
      const bytes = await mergePDFFiles(files);
      downloadPdfBytes(bytes, "merged.pdf");
    } catch (e) {
      const msg = e?.message || String(e) || "";
      if (msg.toLowerCase().includes("encrypt")) {
        setError("One or more PDFs are password-protected and cannot be merged.");
      } else if (msg) {
        setError("Merge failed: " + msg);
      } else {
        setError("Failed to merge PDFs. Make sure all files are valid, unencrypted PDFs.");
      }
    } finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <FileUploader label="Upload PDFs" accept=".pdf" multiple onChange={onFiles}
        helperText="Tip: drag files in the list below to change their order before merging."
        loadedLabel={filesLabel || null}
        onClear={() => { setFiles([]); setFilesLabel(""); setError(""); }}
      />
      {files.length > 0 && (
        <>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li
                key={file.name + "-" + index}
                draggable
                onDragStart={(event) => onDragStart(event, index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, index)}
                className="list-card"
              >
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-slate-100">{index + 1}. {file.name}</span>
                  <p className="mt-1 text-xs text-slate-400">Drag to reorder, or use the arrow buttons.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-slate-400 md:inline">Drag or use buttons</span>
                  <button type="button" className="btn-secondary" onClick={() => moveFile(index, index - 1)} disabled={index === 0}>Up</button>
                  <button type="button" className="btn-secondary" onClick={() => moveFile(index, index + 1)} disabled={index === files.length - 1}>Down</button>
                </div>
              </li>
            ))}
          </ul>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={merge} disabled={loading}>
              {loading ? "Merging..." : "Merge PDFs"}
            </button>
            <span className="badge bg-white/[0.05] text-slate-300">{files.length} file{files.length === 1 ? "" : "s"} selected</span>
          </div>
        </>
      )}
    </div>
  );
}

