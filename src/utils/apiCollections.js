const COLLECTION_VERSION = 1;

function sanitizeRequest(entry) {
  return {
    id: entry.id || Date.now(),
    method: entry.method || 'GET',
    url: entry.url || '',
    params: Array.isArray(entry.params) ? entry.params : [{ key: '', value: '' }],
    headers: Array.isArray(entry.headers) ? entry.headers : [{ key: '', value: '' }],
    body: entry.body || '',
    authType: entry.authType || 'none',
    token: entry.token || '',
    username: entry.username || '',
    password: entry.password || ''
  };
}

export function serializeCollections({ history }) {
  return JSON.stringify(
    {
      version: COLLECTION_VERSION,
      exportedAt: new Date().toISOString(),
      history: Array.isArray(history) ? history : []
    },
    null,
    2
  );
}

export function parseCollections(rawText) {
  const parsed = JSON.parse(rawText);

  const history = Array.isArray(parsed?.history)
    ? parsed.history.map((item) => sanitizeRequest(item))
    : [];

  return { history };
}

