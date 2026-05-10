import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FONT_MAP = {
  Helvetica: StandardFonts.Helvetica,
  TimesRoman: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier
};

export async function mergePDFFiles(files) {
  const targetDoc = await PDFDocument.create();

  for (const file of files) {
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    const sourceDoc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageIndices = sourceDoc.getPageIndices();
    const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
    copiedPages.forEach((page) => targetDoc.addPage(page));
  }

  return targetDoc.save();
}

function getSafePage(pages, pageNumber) {
  const pageIndex = Math.max(0, Math.min(pages.length - 1, Number(pageNumber || 1) - 1));
  return pages[pageIndex];
}

function toRgbColor(hexColor, fallback = '#262626') {
  const value = String(hexColor || fallback).replace('#', '').trim();
  if (value.length !== 6) {
    return rgb(0.15, 0.15, 0.15);
  }
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return rgb(0.15, 0.15, 0.15);
  }
  return rgb(red, green, blue);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hexColor, alpha = 1) {
  const value = String(hexColor || '#000000').replace('#', '').trim();
  if (value.length !== 6) {
    return `rgba(0,0,0,${alpha})`;
  }

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return `rgba(0,0,0,${alpha})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = clamp(Number(radius) || 0, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text ?? '').replace(/\r/g, '').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';

    const flush = () => {
      if (line) {
        lines.push(line);
        line = '';
      }
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }

      if (!line) {
        let chunk = '';
        for (const ch of word) {
          const next = chunk + ch;
          if (ctx.measureText(next).width <= maxWidth || !chunk) {
            chunk = next;
          } else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
        continue;
      }

      flush();
      line = word;
    }

    flush();
  }

  return lines.length ? lines : [''];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderBannerOperationToDataUrl(operation) {
  const width = Math.max(80, Number(operation.width ?? 360));
  const height = Math.max(40, Number(operation.height ?? 150));
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  const padding = clamp(Number(operation.bannerPadding ?? 18), 0, Math.min(width, height) / 2);
  const radius = clamp(Number(operation.bannerRadius ?? 16), 0, Math.min(width, height) / 2);
  const opacity = clamp(Number(operation.bannerOpacity ?? 0.96), 0.05, 1);
  const bgStart = operation.bannerBgStart ?? '#2563eb';
  const bgEnd = operation.bannerBgEnd ?? bgStart;
  const borderColor = operation.bannerBorderColor ?? '#ffffff';
  const borderWidth = clamp(Number(operation.bannerBorderWidth ?? 2), 0, 12);
  const isWatermark = Boolean(operation.watermark);
  const alignment = operation.bannerAlignment === 'center' ? 'center' : operation.bannerAlignment === 'right' ? 'right' : 'left';
  const bannerHeight = height - (padding * 2);

  if (!isWatermark && operation.bannerShadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    drawRoundedRect(ctx, 0, 0, width, height, radius);
    ctx.fillStyle = bgEnd;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = isWatermark ? Math.min(opacity, 0.28) : opacity;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, bgStart);
  gradient.addColorStop(1, bgEnd);
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.fill();
  ctx.restore();

  if (borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    if (operation.bannerBorderStyle === 'dashed') {
      ctx.setLineDash([10, 8]);
    } else if (operation.bannerBorderStyle === 'dotted') {
      ctx.setLineDash([3, 6]);
    } else if (operation.bannerBorderStyle === 'double') {
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1, borderWidth / 1.5);
      drawRoundedRect(ctx, borderWidth + 2, borderWidth + 2, width - ((borderWidth + 2) * 2), height - ((borderWidth + 2) * 2), Math.max(0, radius - borderWidth));
      ctx.stroke();
      ctx.lineWidth = borderWidth;
    }
    drawRoundedRect(ctx, borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth, Math.max(0, radius - (borderWidth / 2)));
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = `${Math.max(12, Number(operation.bannerTitleSize ?? 22)) * (operation.bannerFont === 'Courier' ? 0.98 : 1)}px ${operation.bannerFont === 'TimesRoman' ? 'Georgia, "Times New Roman", serif' : operation.bannerFont === 'Courier' ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, sans-serif'}`;
  ctx.textBaseline = 'top';

  const rowY = padding;
  let rowX = padding;

  const iconSize = Math.max(16, Math.min(32, bannerHeight * 0.22));
  const hasLogo = Boolean(operation.logoDataUrl || operation.logoText || operation.icon);
  if (hasLogo) {
    if (operation.logoDataUrl) {
      const img = await loadImage(operation.logoDataUrl);
      ctx.drawImage(img, rowX, rowY, iconSize, iconSize);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(operation.logoText || operation.icon || '', rowX, rowY + 1);
    }
    rowX += iconSize + 8;
  }

  if (operation.badge) {
    const badgeText = String(operation.badge);
    ctx.font = `700 ${Math.max(10, Math.round(iconSize * 0.4))}px Arial, Helvetica, sans-serif`;
    const badgeWidth = ctx.measureText(badgeText).width + 18;
    const badgeHeight = Math.max(20, Math.round(iconSize * 0.72));
    ctx.fillStyle = hexToRgba('#ffffff', 0.18);
    drawRoundedRect(ctx, rowX, rowY + 1, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText.toUpperCase(), rowX + 9, rowY + 4);
    rowX += badgeWidth + 8;
  }

  if (operation.timestamp && operation.showTimestamp) {
    const stamp = String(operation.timestamp);
    ctx.font = `500 ${Math.max(10, Math.round(iconSize * 0.38))}px Arial, Helvetica, sans-serif`;
    const stampWidth = ctx.measureText(stamp).width;
    ctx.fillStyle = hexToRgba('#ffffff', 0.85);
    ctx.fillText(stamp, width - padding - stampWidth, rowY + 3);
  }

  const titleX = alignment === 'center' ? padding : alignment === 'right' ? padding : rowX;
  const titleWidth = Math.max(40, width - padding * 2 - (alignment === 'right' ? 0 : rowX - padding));
  const title = String(operation.bannerTitle ?? '').trim();
  const subtitle = String(operation.bannerSubtitle ?? '').trim();

  ctx.fillStyle = operation.bannerTitleColor ?? '#ffffff';
  ctx.font = `800 ${Math.max(12, Number(operation.bannerTitleSize ?? 22))}px ${operation.bannerFont === 'TimesRoman' ? 'Georgia, "Times New Roman", serif' : operation.bannerFont === 'Courier' ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, sans-serif'}`;
  const titleLines = wrapLines(ctx, title, Math.max(40, titleWidth));
  let cursorY = rowY + iconSize + 8;
  const lineHeightTitle = Math.max(18, Math.round((Number(operation.bannerTitleSize ?? 22) * 1.22)));
  for (const line of titleLines.slice(0, 3)) {
    const lineWidth = ctx.measureText(line).width;
    const tx = alignment === 'center' ? (width - lineWidth) / 2 : alignment === 'right' ? width - padding - lineWidth : titleX;
    ctx.fillText(line, tx, cursorY);
    cursorY += lineHeightTitle;
  }

  if (subtitle) {
    ctx.fillStyle = operation.bannerSubtitleColor ?? '#dbeafe';
    ctx.font = `400 ${Math.max(10, Number(operation.bannerSubtitleSize ?? 14))}px ${operation.bannerFont === 'TimesRoman' ? 'Georgia, "Times New Roman", serif' : operation.bannerFont === 'Courier' ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, sans-serif'}`;
    const subtitleLines = wrapLines(ctx, subtitle, Math.max(40, titleWidth));
    const lineHeightSubtitle = Math.max(14, Math.round((Number(operation.bannerSubtitleSize ?? 14) * 1.35)));
    for (const line of subtitleLines.slice(0, 4)) {
      const lineWidth = ctx.measureText(line).width;
      const tx = alignment === 'center' ? (width - lineWidth) / 2 : alignment === 'right' ? width - padding - lineWidth : titleX;
      ctx.fillText(line, tx, cursorY + 2);
      cursorY += lineHeightSubtitle;
    }
  }

  if (operation.ctaLabel) {
    const ctaLabel = String(operation.ctaLabel);
    ctx.font = `700 12px Arial, Helvetica, sans-serif`;
    const pillWidth = ctx.measureText(ctaLabel).width + 26;
    const pillHeight = 26;
    const pillY = height - padding - pillHeight;
    const pillX = alignment === 'center' ? (width - pillWidth) / 2 : alignment === 'right' ? width - padding - pillWidth : padding;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 999);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillText(ctaLabel, pillX + 13, pillY + 5);
    if (operation.ctaUrl) {
      ctx.font = `500 10px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = hexToRgba('#ffffff', 0.9);
      const linkText = String(operation.ctaUrl).slice(0, 90);
      const linkWidth = ctx.measureText(linkText).width;
      const lx = alignment === 'center' ? (width - linkWidth) / 2 : alignment === 'right' ? width - padding - linkWidth : padding;
      ctx.fillText(linkText, lx, pillY - 14);
    }
  }

  return canvas.toDataURL('image/png');
}

function wrapTextToWidth(text, font, size, maxWidth) {
  if (!maxWidth || maxWidth <= 0) {
    return [String(text ?? '')];
  }

  const wrapped = [];
  const paragraphs = String(text ?? '').replace(/\r/g, '').split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      wrapped.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';

    const flushLine = () => {
      if (line) {
        wrapped.push(line);
        line = '';
      }
    };

    const splitLongWord = (word) => {
      let chunk = '';
      for (const ch of word) {
        const candidate = chunk + ch;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !chunk) {
          chunk = candidate;
        } else {
          wrapped.push(chunk);
          chunk = ch;
        }
      }
      if (chunk) {
        line = chunk;
      }
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (!line) {
        splitLongWord(word);
        continue;
      }

      flushLine();
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        splitLongWord(word);
      }
    }

    flushLine();
  }

  return wrapped.length ? wrapped : [''];
}

// ─── Shape canvas renderer ────────────────────────────────────────
// Draws any shapeKind onto an off-screen canvas and returns a PNG data URL.
// The canvas has a transparent background so shapes without fill won't
// cover content under them in the PDF.
function renderShapeToDataUrl(op) {
  const W  = Math.max(20, Number(op.width  ?? 120));
  const H  = Math.max(10, Number(op.height ?? 60));
  const SC = 2; // retina scale
  const canvas = document.createElement('canvas');
  canvas.width  = W * SC;
  canvas.height = H * SC;
  const ctx = canvas.getContext('2d');
  ctx.scale(SC, SC);

  const stroke = op.borderColor ?? '#ef4444';
  const fill   = op.fillColor   ?? '#ffffff';
  const lw     = Math.max(0.5, Number(op.borderWidth ?? 2));
  const kind   = op.shapeKind ?? 'rect';
  const noFill = kind === 'line' || kind === 'arrow' || fill === 'none';

  ctx.strokeStyle = stroke;
  ctx.lineWidth   = lw;
  ctx.fillStyle   = fill;

  switch (kind) {
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, Math.max(1, W / 2 - lw / 2), Math.max(1, H / 2 - lw / 2), 0, 0, Math.PI * 2);
      if (!noFill) ctx.fill();
      ctx.stroke();
      break;

    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(W / 2, lw / 2);
      ctx.lineTo(W - lw / 2, H - lw / 2);
      ctx.lineTo(lw / 2, H - lw / 2);
      ctx.closePath();
      if (!noFill) ctx.fill();
      ctx.stroke();
      break;

    case 'line':
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lw / 2, H / 2);
      ctx.lineTo(W - lw / 2, H / 2);
      ctx.stroke();
      break;

    case 'arrow': {
      const ah = Math.min(H * 0.45, W * 0.25);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lw / 2, H / 2);
      ctx.lineTo(W - ah, H / 2);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(W - lw / 2, H / 2);
      ctx.lineTo(W - ah, H / 2 - ah / 2);
      ctx.lineTo(W - ah, H / 2 + ah / 2);
      ctx.closePath();
      ctx.fillStyle = stroke;
      ctx.fill();
      break;
    }

    case 'star': {
      const cx = W / 2, cy = H / 2;
      const outerR = Math.min(W, H) / 2 - lw;
      const innerR = outerR * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (!noFill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'rect':
    default:
      ctx.beginPath();
      ctx.rect(lw / 2, lw / 2, W - lw, H - lw);
      if (!noFill) ctx.fill();
      ctx.stroke();
      break;
  }

  return canvas.toDataURL('image/png');
}

export async function getPdfPageCount(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

async function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function convertAnyImageToPngDataUrl(file) {
  const rawDataUrl = await readBlobAsDataUrl(file);
  if (rawDataUrl.startsWith('data:image/png') || rawDataUrl.startsWith('data:image/jpeg')) {
    return rawDataUrl;
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = reject;
    image.src = rawDataUrl;
  });
}

export async function imagesToPdfBytes(files) {
  const doc = await PDFDocument.create();

  for (const file of files) {
    const imageDataUrl = await convertAnyImageToPngDataUrl(file);
    const page = doc.addPage();

    let embedded;
    if (imageDataUrl.startsWith('data:image/jpeg')) {
      embedded = await doc.embedJpg(imageDataUrl);
    } else {
      embedded = await doc.embedPng(imageDataUrl);
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const imageRatio = embedded.width / embedded.height;
    const pageRatio = pageWidth / pageHeight;

    let drawWidth = pageWidth;
    let drawHeight = pageHeight;
    if (imageRatio > pageRatio) {
      drawHeight = pageWidth / imageRatio;
    } else {
      drawWidth = pageHeight * imageRatio;
    }

    page.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
  }

  return doc.save({ useObjectStreams: true });
}

export async function compressPdfBytes(pdfBytes, level = 'medium') {
  const source = await PDFDocument.load(pdfBytes);

  if (level === 'high') {
    const cleanDoc = await PDFDocument.create();
    const pages = await cleanDoc.copyPages(source, source.getPageIndices());
    pages.forEach((page) => cleanDoc.addPage(page));
    return cleanDoc.save({ useObjectStreams: true, addDefaultPage: false });
  }

  if (level === 'low') {
    return source.save({ useObjectStreams: false });
  }

  return source.save({ useObjectStreams: true });
}

export async function applyPdfOperations({ pdfBytes, operations = [] }) {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const fontCache = new Map();
  const imageCache = new Map();

  for (const operation of operations) {
    const page = getSafePage(pages, operation.pageNumber);
    const x = Number(operation.x ?? 72);
    const y = Number(operation.y ?? 72);

    if (operation.type === 'sign') {
      const key = operation.signaturePngDataUrl;
      if (!key) {
        continue;
      }

      let image = imageCache.get(key);
      if (!image) {
        const imageBytes = await fetch(key).then((response) => response.arrayBuffer());
        image = await doc.embedPng(imageBytes);
        imageCache.set(key, image);
      }

      const imageWidth = Number(operation.width ?? 160);
      const imageHeight = Number(operation.height ?? 70);
      page.drawImage(image, { x, y, width: imageWidth, height: imageHeight });
      continue;
    }

    if (operation.type === 'shape') {
      const shapeDataUrl   = renderShapeToDataUrl(operation);
      const shapeBytes     = await fetch(shapeDataUrl).then(r => r.arrayBuffer());
      const shapeImage     = await doc.embedPng(shapeBytes);
      page.drawImage(shapeImage, {
        x,
        y,
        width:  Number(operation.width  ?? 120),
        height: Number(operation.height ?? 60)
      });
      continue;
    }

    if (operation.type === 'banner') {
      const bannerDataUrl = await renderBannerOperationToDataUrl(operation);
      const bannerBytes = await fetch(bannerDataUrl).then((response) => response.arrayBuffer());
      const bannerImage = await doc.embedPng(bannerBytes);
      page.drawImage(bannerImage, {
        x,
        y,
        width: Number(operation.width ?? 360),
        height: Number(operation.height ?? 150)
      });
      continue;
    }

    const text = String(operation.text ?? '').trim();
    if (!text) {
      continue;
    }

    const fontKey = operation.font || 'Helvetica';
    let font = fontCache.get(fontKey);
    if (!font) {
      const mappedFont = FONT_MAP[fontKey] || StandardFonts.Helvetica;
      font = await doc.embedFont(mappedFont);
      fontCache.set(fontKey, font);
    }

    const size = Number(operation.size ?? 16);
    const color = toRgbColor(operation.color, '#262626');

    // Keep legacy behavior for direct addTextToPDF calls with no text-box geometry.
    if (operation.width == null && operation.height == null) {
      page.drawText(text, { x, y, size, font, color });
      continue;
    }

    const boxWidth = Math.max(size, Number(operation.width ?? size * 8));
    const boxHeight = Math.max(size * 1.2, Number(operation.height ?? size * 1.4));
    const paddingX = Number(operation.paddingX ?? 2);
    const paddingY = Number(operation.paddingY ?? 2);
    const lineHeight = Number(operation.lineHeight ?? size * 1.25);
    const maxTextWidth = Math.max(8, boxWidth - (paddingX * 2));
    const lines = wrapTextToWidth(text, font, size, maxTextWidth);

    let currentY = y + boxHeight - size - paddingY;
    const minY = y + paddingY;
    for (const line of lines) {
      if (currentY < minY) {
        break;
      }
      page.drawText(line, {
        x: x + paddingX,
        y: currentY,
        size,
        font,
        color
      });
      currentY -= lineHeight;
    }
  }

  return doc.save();
}

export async function signPDF({ pdfFile, signaturePngDataUrl, pageNumber = 1, x = 80, y = 80, width = 160, height = 70 }) {
  const bytes = await pdfFile.arrayBuffer();
  return applyPdfOperations({
    pdfBytes: bytes,
    operations: [{ type: 'sign', signaturePngDataUrl, pageNumber, x, y, width, height }]
  });
}

export async function addTextToPDF({ pdfFile, text, pageNumber = 1, x = 72, y = 72, size = 16 }) {
  const bytes = await pdfFile.arrayBuffer();
  return applyPdfOperations({
    pdfBytes: bytes,
    operations: [{ type: 'text', text, pageNumber, x, y, size }]
  });
}

export function downloadPdfBytes(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

