import { useState } from 'react';
import CopyButton from '../shared/CopyButton';

function parseXml(input) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML. Please fix syntax and try again.');
  }
  return doc;
}

function formatXml(input) {
  const doc = parseXml(input);
  const serializer = new XMLSerializer();
  const raw = serializer.serializeToString(doc);
  const withSpacing = raw.replace(/(>)(<)(\/*)/g, '$1\n$2$3');

  let indent = 0;
  const lines = withSpacing.split('\n').map((line) => line.trim()).filter(Boolean);

  return lines
    .map((line) => {
      if (line.match(/^<\//)) {
        indent = Math.max(indent - 1, 0);
      }

      const padded = `${'  '.repeat(indent)}${line}`;

      if (line.match(/^<[^!?][^>]*[^/]>/) && !line.includes('</')) {
        indent += 1;
      }

      return padded;
    })
    .join('\n');
}

function minifyXml(input) {
  const doc = parseXml(input);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc).replace(/>\s+</g, '><').trim();
}

export default function JsonXmlFormatter() {
  const [mode, setMode] = useState('json');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const onFormat = () => {
    try {
      if (mode === 'json') {
        const parsed = JSON.parse(input);
        setOutput(JSON.stringify(parsed, null, 2));
      } else {
        setOutput(formatXml(input));
      }
      setError('');
    } catch (err) {
      setOutput('');
      setError(mode === 'json' ? 'Invalid JSON. Please fix syntax and try again.' : err.message);
    }
  };

  const onMinify = () => {
    try {
      if (mode === 'json') {
        const parsed = JSON.parse(input);
        setOutput(JSON.stringify(parsed));
      } else {
        setOutput(minifyXml(input));
      }
      setError('');
    } catch (err) {
      setOutput('');
      setError(mode === 'json' ? 'Invalid JSON. Please fix syntax and try again.' : err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={mode === 'json' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('json')}
        >
          JSON
        </button>
        <button
          type="button"
          className={mode === 'xml' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMode('xml')}
        >
          XML
        </button>
      </div>

      <textarea
        rows={8}
        className="input font-mono text-xs"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={mode === 'json' ? '{"hello":"world"}' : '<root><item>Hello</item></root>'}
      />

      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-primary" onClick={onFormat}>
          Format
        </button>
        <button type="button" className="btn-secondary" onClick={onMinify}>
          Minify
        </button>
        <CopyButton value={output} />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <textarea
        rows={8}
        readOnly
        className="input font-mono text-xs"
        value={output}
        placeholder={`Formatted ${mode.toUpperCase()} output`}
      />
    </div>
  );
}

