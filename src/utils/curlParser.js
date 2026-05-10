function tokenizeCurl(input) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseCurlCommand(rawCurl) {
  const trimmed = String(rawCurl || '').trim();
  if (!trimmed) {
    throw new Error('Paste a cURL command first.');
  }

  const tokens = tokenizeCurl(trimmed.replace(/\r?\n/g, ' '));
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('Command must start with curl.');
  }

  let method = 'GET';
  let url = '';
  let body = '';
  let authType = 'none';
  let username = '';
  let password = '';
  const headers = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];

    if ((token === '-X' || token === '--request') && tokens[i + 1]) {
      method = tokens[i + 1].toUpperCase();
      i += 1;
      continue;
    }

    if ((token === '-H' || token === '--header') && tokens[i + 1]) {
      const rawHeader = tokens[i + 1];
      const splitAt = rawHeader.indexOf(':');
      if (splitAt > 0) {
        const key = rawHeader.slice(0, splitAt).trim();
        const value = rawHeader.slice(splitAt + 1).trim();
        headers.push({ key, value });
      }
      i += 1;
      continue;
    }

    if ((token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') && tokens[i + 1]) {
      body = tokens[i + 1];
      if (method === 'GET') {
        method = 'POST';
      }
      i += 1;
      continue;
    }

    if ((token === '--url') && tokens[i + 1]) {
      url = tokens[i + 1];
      i += 1;
      continue;
    }

    if ((token === '-u' || token === '--user') && tokens[i + 1]) {
      const userToken = tokens[i + 1];
      const splitAt = userToken.indexOf(':');
      authType = 'basic';
      if (splitAt >= 0) {
        username = userToken.slice(0, splitAt);
        password = userToken.slice(splitAt + 1);
      } else {
        username = userToken;
        password = '';
      }
      i += 1;
      continue;
    }

    if (!token.startsWith('-') && /^https?:\/\//i.test(token) && !url) {
      url = token;
    }
  }

  if (!url) {
    throw new Error('Could not find request URL in cURL command.');
  }

  return {
    method,
    url,
    params: [{ key: '', value: '' }],
    headers: headers.length ? headers : [{ key: '', value: '' }],
    body,
    authType,
    username,
    password,
    token: ''
  };
}

