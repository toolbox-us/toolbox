import { useMemo, useState } from 'react';
import CopyButton from '../shared/CopyButton';

function isPrimitive(value) {
  return value === null || typeof value !== 'object';
}

function buildXmlNode(element) {
  const result = {};

  if (element.attributes.length > 0) {
    for (let i = 0; i < element.attributes.length; i += 1) {
      const attribute = element.attributes[i];
      result[`@${attribute.name}`] = attribute.value;
    }
  }

  const childElements = [];
  const textParts = [];

  for (let i = 0; i < element.childNodes.length; i += 1) {
    const child = element.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      childElements.push(child);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue?.trim();
      if (text) textParts.push(text);
    }
  }

  for (let i = 0; i < childElements.length; i += 1) {
    const child = childElements[i];
    const parsedChild = buildXmlNode(child);
    if (Object.prototype.hasOwnProperty.call(result, child.nodeName)) {
      const existing = result[child.nodeName];
      result[child.nodeName] = Array.isArray(existing) ? [...existing, parsedChild] : [existing, parsedChild];
    } else {
      result[child.nodeName] = parsedChild;
    }
  }

  if (textParts.length > 0) {
    if (Object.keys(result).length === 0) {
      return textParts.join(' ');
    }
    result['#text'] = textParts.join(' ');
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseXmlToJson(input) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML format');
  }
  const root = doc.documentElement;
  return { [root.nodeName]: buildXmlNode(root) };
}

function collectExpandablePaths(value, path = 'root') {
  if (isPrimitive(value)) {
    return [];
  }

  const paths = [path];

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      paths.push(...collectExpandablePaths(value[i], `${path}[${i}]`));
    }
    return paths;
  }

  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    paths.push(...collectExpandablePaths(value[key], `${path}.${key}`));
  }

  return paths;
}

function TreeNode({ nodeKey, value, path, expandedPaths, onToggle, depth = 0 }) {
  const primitive = isPrimitive(value);
  const isExpanded = expandedPaths.has(path);
  const indentStyle = { paddingLeft: `${depth * 14}px` };

  if (primitive) {
    return (
      <div className="font-mono text-xs text-slate-300" style={indentStyle}>
        <span className="text-sky-300">{nodeKey}:</span>{' '}
        <span>{String(value)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="font-mono text-xs text-left text-slate-200 hover:text-white"
        style={indentStyle}
        onClick={() => onToggle(path)}
      >
        <span className="inline-block w-4">{isExpanded ? '-' : '+'}</span>
        <span className="text-sky-300">{nodeKey}</span>
        <span className="text-slate-500"> {isArray ? `[${value.length}]` : '{...}'}</span>
      </button>
      {isExpanded ? (
        <div className="space-y-1">
          {entries.map(([key, child]) => (
            <TreeNode
              key={`${path}.${String(key)}`}
              nodeKey={String(key)}
              value={child}
              path={`${path}.${String(key)}`}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function XMLJsonViewer() {
  const [input, setInput] = useState('');
  const [treeData, setTreeData] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [error, setError] = useState('');

  const output = useMemo(() => (treeData ? JSON.stringify(treeData, null, 2) : ''), [treeData]);

  const loadJson = () => {
    try {
      const parsed = JSON.parse(input);
      setTreeData(parsed);
      setExpandedPaths(new Set(['root']));
      setError('');
    } catch {
      setTreeData(null);
      setExpandedPaths(new Set());
      setError('Invalid JSON format');
    }
  };

  const loadXml = () => {
    try {
      const parsed = parseXmlToJson(input);
      setTreeData(parsed);
      setExpandedPaths(new Set(['root']));
      setError('');
    } catch {
      setTreeData(null);
      setExpandedPaths(new Set());
      setError('Invalid XML format');
    }
  };

  const onToggle = (path) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const onMaximizeAll = () => {
    if (!treeData) return;
    const allPaths = collectExpandablePaths(treeData, 'root');
    setExpandedPaths(new Set(allPaths));
  };

  const onMinimizeAll = () => {
    setExpandedPaths(new Set(['root']));
  };

  return (
    <div className="space-y-3">
      <textarea
        rows={8}
        className="input font-mono text-xs"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Paste JSON or XML here..."
      />
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-primary" onClick={loadJson}>
          Parse JSON
        </button>
        <button type="button" className="btn-primary" onClick={loadXml}>
          Parse XML
        </button>
        <button type="button" className="btn-secondary" onClick={onMaximizeAll} disabled={!treeData}>
          Maximize All
        </button>
        <button type="button" className="btn-secondary" onClick={onMinimizeAll} disabled={!treeData}>
          Minimize All
        </button>
        <CopyButton value={output} />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="input min-h-[220px] overflow-auto bg-slate-950 p-3">
        {treeData ? (
          <TreeNode
            nodeKey="root"
            value={treeData}
            path="root"
            expandedPaths={expandedPaths}
            onToggle={onToggle}
          />
        ) : (
          <p className="text-xs text-slate-400">Parsed tree will appear here.</p>
        )}
      </div>
    </div>
  );
}
