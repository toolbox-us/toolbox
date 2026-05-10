import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CopyButton from '../shared/CopyButton';

export default function UuidGenerator() {
  const [value, setValue] = useState(uuidv4());

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Generate RFC4122 UUID v4 values.</p>
      <input className="input font-mono" value={value} readOnly />
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => setValue(uuidv4())}>
          Generate New UUID
        </button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

