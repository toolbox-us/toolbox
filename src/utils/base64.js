export function encodeUnicodeText(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

export function decodeUnicodeText(input) {
  return decodeURIComponent(escape(atob(input)));
}

export function stripDataUrlPrefix(dataUrl) {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
}

export function ensureDataUrlPrefix(base64, mimeType) {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

