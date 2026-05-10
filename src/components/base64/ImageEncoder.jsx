import { useState } from 'react';
import FileUploader from '../shared/FileUploader';
import CopyButton from '../shared/CopyButton';
import { ensureDataUrlPrefix, stripDataUrlPrefix } from '../../utils/base64';

const MAX_MB = 20;

export default function ImageEncoder() {
  const [dataUrl, setDataUrl] = useState('');
  const [base64Value, setBase64Value] = useState('');
  const [warning, setWarning] = useState('');

  const onFiles = (files) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setWarning(`Large image selected (${(file.size / 1024 / 1024).toFixed(1)} MB). Processing may be slow.`);
    } else {
      setWarning('');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setDataUrl(result);
      setBase64Value(stripDataUrlPrefix(result));
    };
    reader.readAsDataURL(file);
  };

  const decode = () => {
    if (!base64Value.trim()) {
      return;
    }
    setDataUrl(ensureDataUrlPrefix(base64Value.trim(), 'image/png'));
  };

  return (
    <div className="space-y-3">
      <FileUploader
        label="Select an image"
        accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
        onChange={onFiles}
        helperText="Files are converted locally with FileReader."
      />
      {warning ? <p className="text-sm text-amber-400">{warning}</p> : null}
      <textarea
        className="input"
        rows={5}
        value={base64Value}
        onChange={(event) => setBase64Value(event.target.value)}
        placeholder="Base64 output"
      />
      <div className="flex gap-2">
        <CopyButton value={base64Value} />
        <button type="button" className="btn-secondary" onClick={decode}>
          Decode To Preview
        </button>
      </div>
      {dataUrl ? (
        <div className="rounded border border-slate-700 p-2">
          <p className="mb-2 text-xs text-slate-400">Preview</p>
          <img
            src={dataUrl}
            alt="preview"
            className="block w-full rounded object-contain"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      ) : null}
    </div>
  );
}
