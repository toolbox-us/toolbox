import { useState } from 'react';

export default function XMLJsonCompare() {
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');
  const [result, setResult] = useState(null);
  const [differences, setDifferences] = useState([]);
  const [error, setError] = useState('');

  const parseXml = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML');
    }
    return xmlToJson(xmlDoc.documentElement);
  };

  const xmlToJson = (element) => {
    const result = {};
    const name = element.nodeName;
    
    if (element.attributes.length > 0) {
      result['@attributes'] = {};
      for (let i = 0; i < element.attributes.length; i++) {
        result['@attributes'][element.attributes[i].nodeName] = element.attributes[i].nodeValue;
      }
    }

    if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
      return { [name]: element.childNodes[0].nodeValue };
    }

    const children = {};
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (child.nodeType === 1) {
        const childJson = xmlToJson(child);
        const childName = child.nodeName;
        if (children[childName]) {
          if (!Array.isArray(children[childName])) {
            children[childName] = [children[childName]];
          }
          children[childName].push(childJson[childName]);
        } else {
          children[childName] = childJson[childName];
        }
      }
    }

    return { [name]: Object.keys(children).length > 0 ? children : null };
  };

  const compare = () => {
    try {
      setError('');
      setDifferences([]);
      let obj1, obj2;

      try {
        obj1 = JSON.parse(input1);
      } catch {
        obj1 = parseXml(input1);
      }

      try {
        obj2 = JSON.parse(input2);
      } catch {
        obj2 = parseXml(input2);
      }

      const diffs = diffValues(obj1, obj2, '$');
      const isSame = diffs.length === 0;
      setResult({
        isSame,
        message: isSame ? '✅ Both inputs are equivalent' : `❌ Found ${diffs.length} difference(s)`
      });
      setDifferences(diffs);
    } catch (err) {
      setError('Invalid JSON or XML format');
      setResult(null);
      setDifferences([]);
    }
  };

  const diffValues = (left, right, path) => {
    if (left === right) {
      return [];
    }

    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    const leftIsObject = left !== null && typeof left === 'object';
    const rightIsObject = right !== null && typeof right === 'object';

    if (leftIsArray || rightIsArray) {
      if (!leftIsArray || !rightIsArray) {
        return [{ path, left, right, type: 'type-mismatch' }];
      }

      const max = Math.max(left.length, right.length);
      let diffs = [];
      for (let i = 0; i < max; i += 1) {
        const itemPath = `${path}[${i}]`;
        if (i >= left.length) {
          diffs.push({ path: itemPath, left: undefined, right: right[i], type: 'missing-left' });
        } else if (i >= right.length) {
          diffs.push({ path: itemPath, left: left[i], right: undefined, type: 'missing-right' });
        } else {
          diffs = diffs.concat(diffValues(left[i], right[i], itemPath));
        }
      }
      return diffs;
    }

    if (leftIsObject || rightIsObject) {
      if (!leftIsObject || !rightIsObject) {
        return [{ path, left, right, type: 'type-mismatch' }];
      }

      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      let diffs = [];
      keys.forEach((key) => {
        const keyPath = `${path}.${key}`;
        const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
        const hasRight = Object.prototype.hasOwnProperty.call(right, key);

        if (!hasLeft) {
          diffs.push({ path: keyPath, left: undefined, right: right[key], type: 'missing-left' });
        } else if (!hasRight) {
          diffs.push({ path: keyPath, left: left[key], right: undefined, type: 'missing-right' });
        } else {
          diffs = diffs.concat(diffValues(left[key], right[key], keyPath));
        }
      });
      return diffs;
    }

    return [{ path, left, right, type: 'value-mismatch' }];
  };

  const formatValue = (value) => {
    if (value === undefined) return '(missing)';
    if (typeof value === 'string') return `"${value}"`;
    return JSON.stringify(value);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Input 1 (JSON or XML)</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={input1}
            onChange={(event) => setInput1(event.target.value)}
            placeholder="Paste JSON or XML..."
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Input 2 (JSON or XML)</label>
          <textarea
            rows={10}
            className="input font-mono text-xs w-full"
            value={input2}
            onChange={(event) => setInput2(event.target.value)}
            placeholder="Paste JSON or XML..."
          />
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={compare}>
        Compare
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {result && (
        <div className="rounded border border-slate-700 p-4 bg-slate-900 space-y-3">
          <p className={`text-lg font-semibold ${result.isSame ? 'text-emerald-400' : 'text-rose-400'}`}>
            {result.message}
          </p>
          {!result.isSame ? (
            <div className="max-h-72 overflow-auto rounded border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800 text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2">Path</th>
                    <th className="p-2">Input 1</th>
                    <th className="p-2">Input 2</th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((diff, index) => (
                    <tr key={`${diff.path}-${index}`} className="border-t border-slate-800 align-top">
                      <td className="p-2 text-sky-300 break-all">{diff.path}</td>
                      <td className="p-2 text-rose-300 break-all">{formatValue(diff.left)}</td>
                      <td className="p-2 text-emerald-300 break-all">{formatValue(diff.right)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
