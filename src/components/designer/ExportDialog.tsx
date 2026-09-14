'use client';

import { useState } from 'react';
import { useDesignerStore } from '@/store/designer';
import { exportSvg, exportPdf, exportRaster } from '@/lib/export';

type ExportFormat = 'svg' | 'pdf' | 'png' | 'jpg';
type ExportScope = 'canvas' | 'content';

const DPI_OPTIONS = [72, 150, 300, 600];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [dpi, setDpi] = useState(300);
  const [scope, setScope] = useState<ExportScope>('canvas');
  const [background, setBackground] = useState<'solid' | 'transparent'>('solid');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const storeDpi = useDesignerStore((s) => s.dpi);
  const backgroundFill = useDesignerStore((s) => s.background);
  const objects = useDesignerStore((s) => s.objects);

  const mmToInch = (mm: number) => mm / 25.4;
  const expectedPx = Math.round(mmToInch(widthMm) * dpi);
  const expectedPy = Math.round(mmToInch(heightMm) * dpi);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const exportArgs = {
        widthMm,
        heightMm,
        dpi,
        background: backgroundFill,
        objects,
      };

      if (format === 'svg') {
        const svg = await exportSvg(exportArgs);
        downloadFile(
          new Blob([svg], { type: 'image/svg+xml' }),
          `design-${widthMm}x${heightMm}mm.svg`,
        );
      } else if (format === 'pdf') {
        const pdfBytes = await exportPdf(exportArgs);
        downloadFile(
          new Blob([pdfBytes as any], { type: 'application/pdf' }),
          `design-${widthMm}x${heightMm}mm.pdf`,
        );
      } else {
        const blob = await exportRaster({
          ...exportArgs,
          format,
          backgroundFill: background === 'transparent' && format === 'png' ? 'transparent' : undefined,
        });
        downloadFile(blob, `design-${widthMm}x${heightMm}mm-${dpi}dpi.${format}`);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-100">Export Design</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Format */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Format</label>
            <div className="grid grid-cols-4 gap-1">
              {(['svg', 'pdf', 'png', 'jpg'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded px-3 py-1.5 text-xs font-medium uppercase ${
                    format === f
                      ? 'bg-amber-500 text-neutral-900'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* DPI (raster only) */}
          {(format === 'png' || format === 'jpg') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">
                DPI ({dpi} — {expectedPx} × {expectedPy} px)
              </label>
              <div className="grid grid-cols-4 gap-1">
                {DPI_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDpi(d)}
                    className={`rounded px-3 py-1.5 text-xs ${
                      dpi === d
                        ? 'bg-amber-500 text-neutral-900'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Background (PNG only) */}
          {format === 'png' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">Background</label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setBackground('solid')}
                  className={`rounded px-3 py-1.5 text-xs ${
                    background === 'solid'
                      ? 'bg-amber-500 text-neutral-900'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Solid
                </button>
                <button
                  onClick={() => setBackground('transparent')}
                  className={`rounded px-3 py-1.5 text-xs ${
                    background === 'transparent'
                      ? 'bg-amber-500 text-neutral-900'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Transparent
                </button>
              </div>
            </div>
          )}

          {/* Scope */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Scope</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setScope('canvas')}
                className={`rounded px-3 py-1.5 text-xs ${
                  scope === 'canvas'
                    ? 'bg-amber-500 text-neutral-900'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                Full Canvas
              </button>
              <button
                onClick={() => setScope('content')}
                className={`rounded px-3 py-1.5 text-xs ${
                  scope === 'content'
                    ? 'bg-amber-500 text-neutral-900'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                Content Only
              </button>
            </div>
          </div>

          {/* Color space note */}
          <div className="rounded border border-neutral-700 bg-neutral-800/50 p-2 text-[11px] text-neutral-400">
            <strong className="text-neutral-300">Color space:</strong> Exports are RGB/sRGB. 
            CMYK conversion and print color profiles are handled downstream in CorelDRAW or by your print partner.
            SVG is CorelDRAW&apos;s interchange format — CDR files cannot be generated outside CorelDRAW.
          </div>

          {/* Error */}
          {error && (
            <div className="rounded border border-red-800 bg-red-900/30 p-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Canvas info */}
          <div className="text-[11px] text-neutral-500">
            Canvas: {widthMm} × {heightMm} mm ({mmToInch(widthMm).toFixed(2)} × {mmToInch(heightMm).toFixed(2)} in)
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 rounded bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
