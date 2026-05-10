# ToolBox Web App

A static, client-side React + Vite utilities app designed for GitHub Pages.

## Included features

- Base64 tools
  - Text encode/decode (Unicode-safe)
  - Image Base64 encode/decode preview
  - PDF Base64 encode/decode download
- PDF utilities (browser-only)
  - Merge PDFs (drag-and-drop + keyboard-friendly up/down controls)
  - Unified tool-based Edit PDF module: Text, Sign Date, Shape, Signature
  - Interactive click-to-place frame on PDF preview with zoom and maximize/minimize
  - Font, color, size, and shape styling controls
  - Queue multiple operations and apply in one pass
  - Image to PDF converter
  - PDF compression (browser-side rewrite, results vary by source PDF)
- API client (Postman-like basics)
  - HTTP methods, query params, headers, auth, raw body
  - Response status, timing, headers, and formatted body
  - Request history and favorites persisted in localStorage
  - Delete favorites, clear history/favorites, and import/export collections as JSON
  - Import cURL commands into request fields
- Extra utilities
  - JSON formatter/validator
  - UUID v4 generator
  - JWT decoder (decode only, no signature verification)
  - QR code generator and PNG download

## Tech stack

- React + Vite
- Tailwind CSS
- `pdf-lib` for PDF manipulation
- Native `fetch`, `FileReader`, and browser APIs

## Local development

```bash
npm install
npm run dev
```

## Build and preview

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

1. Update `base` in `vite.config.js` to your repo name.
2. Build and publish:

```bash
npm run deploy
```

3. In GitHub repository settings, set Pages source to `gh-pages` branch.

## Security notes

- Files are processed locally in browser memory.
- Avoid third-party CORS proxies for sensitive APIs.
- Auth tokens are kept in memory only in this app implementation.


