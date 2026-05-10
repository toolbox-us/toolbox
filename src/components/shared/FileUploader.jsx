export default function FileUploader({
  label,
  accept,
  multiple = false,
  onChange,
  helperText,
  required = false,
  loadedLabel = null,
  onClear = null
}) {
  if (loadedLabel) {
    return (
      <div className="tool-card mb-3 flex items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/[0.06]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-emerald-400" aria-hidden="true">✔</span>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-slate-300">{label}</span>
            <span className="block truncate text-xs text-emerald-300">{loadedLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 !py-1 !text-xs"
          onClick={onClear}
        >
          ✕ Change
        </button>
      </div>
    );
  }

  return (
    <label className="tool-card mb-3 block border-dashed border-brand-400/20 bg-brand-500/[0.04] transition hover:border-brand-400/35 hover:bg-brand-500/[0.06]">
      <span className="block text-sm font-semibold text-slate-100">{label}</span>
      <span className="mt-1 block text-xs text-slate-400">
        Choose {multiple ? 'one or more files' : 'a file'} from your device{required ? ' (required)' : ''}.
      </span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(event) => onChange?.(event.target.files)}
        className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border file:border-brand-600 file:bg-gradient-to-r file:from-brand-500 file:to-brand-600 file:px-4 file:py-2.5 file:font-medium file:text-white hover:file:brightness-110"
      />
      {helperText ? <span className="mt-3 block text-xs text-slate-400">{helperText}</span> : null}
    </label>
  );
}
