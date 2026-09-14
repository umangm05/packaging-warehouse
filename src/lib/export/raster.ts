import {
  type DesignObject,
  type Fill,
  getObjectBounds,
} from '@/lib/designerTypes';
import { colorToCss } from '@/lib/colorUtils';
import { PT_TO_MM } from '@/lib/fonts';
import { buildFilterString, applyBgRemoval } from '@/lib/imageFilters';

export interface RasterExportOptions {
  widthMm: number;
  heightMm: number;
  dpi: number;
  background: Fill;
  objects: DesignObject[];
  format: 'png' | 'jpg';
  backgroundFill?: string; // for transparent PNG: 'transparent' or hex
}

/**
 * Export the designer scene as a raster image (PNG/JPG) at the specified DPI.
 *
 * Pixel dimensions = physical size in inches × DPI.
 * Uses an offscreen canvas for rendering.
 */
export async function exportRaster(opts: RasterExportOptions): Promise<Blob> {
  const { widthMm, heightMm, dpi, background, objects, format, backgroundFill } = opts;

  const MM_PER_INCH = 25.4;
  const widthPx = Math.round((widthMm / MM_PER_INCH) * dpi);
  const heightPx = Math.round((heightMm / MM_PER_INCH) * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  const scale = widthPx / widthMm; // px per mm

  // Background
  if (backgroundFill === 'transparent' && format === 'png') {
    ctx.clearRect(0, 0, widthPx, heightPx);
  } else if (background.type === 'solid') {
    ctx.fillStyle = backgroundFill || background.color;
    ctx.fillRect(0, 0, widthPx, heightPx);
  } else if (background.type === 'linear-gradient') {
    const angle = background.angle;
    const rad = ((angle - 90) * Math.PI) / 180;
    const x1 = widthPx / 2 - Math.cos(rad) * widthPx / 2;
    const y1 = heightPx / 2 - Math.sin(rad) * heightPx / 2;
    const x2 = widthPx / 2 + Math.cos(rad) * widthPx / 2;
    const y2 = heightPx / 2 + Math.sin(rad) * heightPx / 2;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    background.stops.forEach((s) => grad.addColorStop(s.offset, s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, widthPx, heightPx);
  } else {
    ctx.fillStyle = backgroundFill || '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
  }

  // Render objects
  for (const obj of objects) {
    if (!obj.visible) continue;
    await renderObjectRaster(ctx, obj, scale, widthPx, heightPx);
  }

  return new Promise((resolve, reject) => {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpg' ? 0.92 : undefined;
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image blob'));
      },
      mimeType,
      quality,
    );
  });
}

async function renderObjectRaster(
  ctx: CanvasRenderingContext2D,
  obj: DesignObject,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<void> {
  ctx.save();

  const b = getObjectBounds(obj);
  const cx = (b.x + b.width / 2) * scale;
  const cy = (b.y + b.height / 2) * scale;

  // Apply rotation
  if (obj.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Set fill
  if (obj.fill.type === 'solid') {
    ctx.fillStyle = colorToCss(obj.fill.color, obj.fillOpacity);
  } else if (obj.fill.type === 'linear-gradient') {
    const angle = obj.fill.angle;
    const rad = ((angle - 90) * Math.PI) / 180;
    const x1 = cx - Math.cos(rad) * b.width * scale * 0.5;
    const y1 = cy - Math.sin(rad) * b.height * scale * 0.5;
    const x2 = cx + Math.cos(rad) * b.width * scale * 0.5;
    const y2 = cy + Math.sin(rad) * b.height * scale * 0.5;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    obj.fill.stops.forEach((s) => grad.addColorStop(s.offset, s.color));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = 'transparent';
  }

  // Set stroke
  if (obj.stroke !== 'transparent') {
    ctx.strokeStyle = colorToCss(obj.stroke, obj.fillOpacity);
    ctx.lineWidth = obj.strokeWidth * scale;
  } else {
    ctx.strokeStyle = 'transparent';
  }

  switch (obj.type) {
    case 'rect':
      ctx.fillRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
      if (obj.stroke !== 'transparent') {
        ctx.strokeRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
      }
      break;

    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(cx, cy, obj.rx * scale, obj.ry * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      if (obj.stroke !== 'transparent') ctx.stroke();
      break;

    case 'line':
      ctx.beginPath();
      ctx.moveTo(obj.x * scale, obj.y * scale);
      ctx.lineTo(obj.x2 * scale, obj.y2 * scale);
      ctx.strokeStyle = obj.stroke !== 'transparent' ? colorToCss(obj.stroke, obj.fillOpacity) : '#000000';
      ctx.lineWidth = obj.strokeWidth * scale;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;

    case 'polygon':
      if (obj.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo((obj.x + obj.points[0].x) * scale, (obj.y + obj.points[0].y) * scale);
        for (let i = 1; i < obj.points.length; i++) {
          ctx.lineTo((obj.x + obj.points[i].x) * scale, (obj.y + obj.points[i].y) * scale);
        }
        ctx.closePath();
        ctx.fill();
        if (obj.stroke !== 'transparent') ctx.stroke();
      }
      break;

    case 'text': {
      const textColor = obj.textColor || '#000000';
      ctx.fillStyle = colorToCss(textColor, obj.fillOpacity);
      ctx.font = `${obj.fontStyle} ${obj.fontWeight} ${obj.fontSize * scale}px ${obj.fontFamily}, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = obj.textAlign;
      const lines = obj.content.split('\n');
      const lineHeightMm = obj.fontSize * PT_TO_MM * obj.lineHeight;
      lines.forEach((line, i) => {
        const yPos = (b.y + i * lineHeightMm) * scale;
        let xPos = b.x * scale;
        if (obj.textAlign === 'center') xPos = (b.x + b.width / 2) * scale;
        else if (obj.textAlign === 'right') xPos = (b.x + b.width) * scale;
        ctx.fillText(line || ' ', xPos, yPos);
      });
      break;
    }

    case 'image': {
      await renderImageRaster(ctx, obj, scale);
      break;
    }
  }

  ctx.restore();
}

async function renderImageRaster(
  ctx: CanvasRenderingContext2D,
  obj: Extract<DesignObject, { type: 'image' }>,
  scale: number,
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dx = obj.x * scale;
      const dy = obj.y * scale;
      const dw = obj.width * scale;
      const dh = obj.height * scale;

      ctx.save();

      // Apply CSS filter adjustments (blur, brightness, contrast, saturate)
      const filterStr = buildFilterString(obj.adjustments);
      if (filterStr !== 'none') {
        ctx.filter = filterStr;
      }

      // Apply flip via transform
      if (obj.adjustments.flipH || obj.adjustments.flipV) {
        const sx = obj.adjustments.flipH ? -1 : 1;
        const sy = obj.adjustments.flipV ? -1 : 1;
        ctx.translate(dx + dw / 2, dy + dh / 2);
        ctx.scale(sx, sy);
        ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
      }

      // Crop region
      const crop = obj.crop;
      const sx = crop ? crop.x : 0;
      const sy = crop ? crop.y : 0;
      const sw = crop ? crop.width : img.width;
      const sh = crop ? crop.height : img.height;

      if (obj.maskType === 'ellipse') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(dx + dw / 2, dy + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
        ctx.clip();
      }

      if (obj.imageFit === 'stretch') {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      } else if (obj.imageFit === 'cover') {
        const imgAspect = sw / sh;
        const boxAspect = dw / dh;
        let cropX = 0, cropY = 0, cropW = sw, cropH = sh;
        if (imgAspect > boxAspect) {
          cropW = sh * boxAspect;
          cropX = (sw - cropW) / 2;
        } else {
          cropH = sw / boxAspect;
          cropY = (sh - cropH) / 2;
        }
        ctx.drawImage(img, sx + cropX, sy + cropY, cropW, cropH, dx, dy, dw, dh);
      } else {
        // Contain: fit within box
        const imgAspect = sw / sh;
        const boxAspect = dw / dh;
        let dw2 = dw, dh2 = dh;
        if (imgAspect > boxAspect) {
          dh2 = dw / imgAspect;
        } else {
          dw2 = dh * imgAspect;
        }
        const dx2 = dx + (dw - dw2) / 2;
        const dy2 = dy + (dh - dh2) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, dx2, dy2, dw2, dh2);
      }

      if (obj.maskType === 'ellipse') {
        ctx.restore();
      }

      // Background removal: post-process pixels
      if (obj.adjustments.bgRemoval && obj.adjustments.bgRemoval.tolerance >= 0) {
        const bg = obj.adjustments.bgRemoval;
        try {
          const imageData = ctx.getImageData(Math.floor(dx), Math.floor(dy), Math.floor(dw), Math.floor(dh));
          applyBgRemoval(imageData.data, { r: bg.r, g: bg.g, b: bg.b }, bg.tolerance);
          ctx.putImageData(imageData, Math.floor(dx), Math.floor(dy));
        } catch {
          // getImageData may fail for tainted canvas (SVG data URL) — silently skip bg removal
        }
      }

      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = obj.src;
  });
}
