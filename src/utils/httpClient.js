function toQueryString(params) {
  const clean = params.filter((entry) => entry.key.trim() !== '');
  if (!clean.length) {
    return '';
  }
  return `?${new URLSearchParams(clean.map((entry) => [entry.key, entry.value]))}`;
}

export async function makeRequest({ method, url, params = [], headers = [], body, auth }) {
  const requestUrl = `${url}${toQueryString(params)}`;
  const headerPairs = headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]);

  if (auth?.type === 'bearer' && auth.token) {
    headerPairs.push(['Authorization', `Bearer ${auth.token}`]);
  }
  if (auth?.type === 'basic' && auth.username) {
    const raw = `${auth.username}:${auth.password ?? ''}`;
    headerPairs.push(['Authorization', `Basic ${btoa(raw)}`]);
  }

  const start = performance.now();
  try {
    const response = await fetch(requestUrl, {
      method,
      headers: new Headers(headerPairs),
      body: body ? body : undefined,
      mode: 'cors'
    });
    const end = performance.now();
    const contentType = response.headers.get('content-type') || '';
    const responseHeaders = Object.fromEntries(response.headers.entries());

    if (contentType.startsWith('image/')) {
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        headers: responseHeaders,
        body: '',
        dataUrl,
        time: Math.round(end - start)
      };
    }

    const responseText = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
      time: Math.round(end - start)
    };
  } catch (error) {
    return {
      error:
        error instanceof TypeError
          ? 'Request blocked or failed (possible CORS/network issue).'
          : String(error)
    };
  }
}
