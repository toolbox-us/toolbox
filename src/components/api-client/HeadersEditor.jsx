export default function HeadersEditor({ headers, setHeaders }) {
  const update = (index, field, value) => {
    const next = [...headers];
    next[index] = { ...next[index], [field]: value };
    setHeaders(next);
  };

  const add = () => setHeaders([...headers, { key: '', value: '' }]);
  const remove = (index) => setHeaders(headers.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {headers.map((entry, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input"
            value={entry.key}
            onChange={(event) => update(index, 'key', event.target.value)}
            placeholder="Header name"
          />
          <input
            className="input"
            value={entry.value}
            onChange={(event) => update(index, 'value', event.target.value)}
            placeholder="Header value"
          />
          <button type="button" className="btn-secondary" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={add}>
        Add Header
      </button>
    </div>
  );
}

