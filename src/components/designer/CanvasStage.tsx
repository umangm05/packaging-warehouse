"use client";

import { useDesignerStore } from "@/store/designer";
import {
  type DesignObject,
  type Fill,
  type ImageAdjustments,
  type ImageFit,
  type MaskType,
  DEFAULT_IMAGE_ADJUSTMENTS,
  getObjectBounds,
  OPEN_LICENSED_FONTS,
} from "@/lib/designerTypes";
import { colorToCss } from "@/lib/colorUtils";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCEPTED_MIME_TYPES,
  computeDownscale,
  formatFileSize,
  isSvgFile,
  validateFile,
  type ValidationResult,
} from "@/lib/fileValidation";
import { buildFilterString, buildFlipTransform } from "@/lib/imageFilters";

const FIT_PADDING = 40;
const HANDLE_SIZE = 6;
const ROTATE_HANDLE_OFFSET = 18;

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface DragState {
  type: "move" | "draw" | "resize" | "rotate" | "text";
  startMmX: number;
  startMmY: number;
  tool?: "rect" | "ellipse" | "line" | "polygon" | "text";
  // resize state
  handle?: HandleId;
  aspectLocked?: boolean;
  origBounds?: { x: number; y: number; w: number; h: number };
  // rotate state
  origRotation?: number;
  center?: { x: number; y: number };
  // draw/text state
  currentMmX?: number;
  currentMmY?: number;
}

export function CanvasStage({
  onReady,
}: {
  onReady?: (el: SVGSVGElement) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const zoom = useDesignerStore((s) => s.zoom);
  const panX = useDesignerStore((s) => s.panX);
  const panY = useDesignerStore((s) => s.panY);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const setPan = useDesignerStore((s) => s.setPan);
  const fit = useDesignerStore((s) => s.fit);
  const objects = useDesignerStore((s) => s.objects);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const selectObject = useDesignerStore((s) => s.selectObject);
  const selectAdd = useDesignerStore((s) => s.selectAdd);
  const clearSelection = useDesignerStore((s) => s.clearSelection);
  const activeTool = useDesignerStore((s) => s.activeTool);
  const setActiveTool = useDesignerStore((s) => s.setActiveTool);
  const cropMode = useDesignerStore((s) => s.cropMode);
  const setCropMode = useDesignerStore((s) => s.setCropMode);
  const addObject = useDesignerStore((s) => s.addObject);
  const moveSelected = useDesignerStore((s) => s.moveSelected);
  const updateObject = useDesignerStore((s) => s.updateObject);
  const deleteSelected = useDesignerStore((s) => s.deleteSelected);
  const beginInteraction = useDesignerStore((s) => s.beginInteraction);
  const liveUpdateObject = useDesignerStore((s) => s.liveUpdateObject);
  const endInteraction = useDesignerStore((s) => s.endInteraction);
  const background = useDesignerStore((s) => s.background);

  const [mouseMm, setMouseMm] = useState<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const dragState = useRef<DragState | null>(null);

  // Inline text editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editingRef = useRef<HTMLTextAreaElement>(null);

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    src: string;
    naturalWidth: number;
    naturalHeight: number;
    isSvg: boolean;
    fileName: string;
    fileSize: number;
  } | null>(null);

  // Handle file selection (shared by drag-drop and file picker)
  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    setUploadError(null);

    const validation: ValidationResult = validateFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      setIsDecoding(false);
      return;
    }

    setIsDecoding(true);
    const isSvg = isSvgFile(file);

    if (isSvg) {
      // SVG: read as text, render as vector
      const reader = new FileReader();
      reader.onload = () => {
        const svgText = reader.result as string;
        // Extract viewBox dimensions for aspect ratio
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgEl = doc.documentElement;
        const vb = svgEl.getAttribute("viewBox");
        let naturalW = 100;
        let naturalH = 100;
        if (vb) {
          const parts = vb.split(/\s+/).map(Number);
          if (parts.length === 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
            naturalW = parts[2];
            naturalH = parts[3];
          }
        }
        const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
        setPendingImage({
          src: dataUrl,
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          isSvg: true,
          fileName: file.name,
          fileSize: file.size,
        });
        setIsDecoding(false);
      };
      reader.onerror = () => {
        setUploadError("Failed to read SVG file.");
        setIsDecoding(false);
      };
      reader.readAsText(file);
    } else {
      // Raster: decode image to get dimensions
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        let cancelled = false;
        const cleanup = () => {
          cancelled = true;
        };
        img.onload = () => {
          if (cancelled) return;
          // Downscale large images before placing
          const scaled = computeDownscale(img.naturalWidth, img.naturalHeight);
          // If downscaling needed, draw to canvas and re-export
          if (scaled.width !== img.naturalWidth || scaled.height !== img.naturalHeight) {
            const canvas = document.createElement("canvas");
            canvas.width = scaled.width;
            canvas.height = scaled.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
            const downscaledUrl = canvas.toDataURL("image/png");
            setPendingImage({
              src: downscaledUrl,
              naturalWidth: scaled.width,
              naturalHeight: scaled.height,
              isSvg: false,
              fileName: file.name,
              fileSize: file.size,
            });
          } else {
            setPendingImage({
              src: dataUrl,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              isSvg: false,
              fileName: file.name,
              fileSize: file.size,
            });
          }
          setIsDecoding(false);
        };
        img.onerror = () => {
          setUploadError("Failed to decode image file.");
          setIsDecoding(false);
        };
        img.src = dataUrl;
        // Store cleanup ref (not used beyond this)
        void cleanup;
      };
      reader.onerror = () => {
        setUploadError("Failed to read image file.");
        setIsDecoding(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Drag-drop handlers
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // File picker
  const onFilePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = ""; // allow re-selecting same file
  };

  // Place pending image on canvas
  const placePendingImage = useCallback(
    (mmX: number, mmY: number) => {
      if (!pendingImage) return;
      // Default size: fit within canvas at natural aspect ratio
      const maxPlaceW = 80; // mm
      const aspect = pendingImage.naturalHeight / pendingImage.naturalWidth;
      let placeW = maxPlaceW;
      let placeH = maxPlaceW * aspect;
      // If taller than wide, cap height instead
      if (placeH > 80) {
        placeH = 80;
        placeW = 80 / aspect;
      }
      const id = addObject({
        type: "image",
        x: mmX - placeW / 2,
        y: mmY - placeH / 2,
        width: placeW,
        height: placeH,
        rotation: 0,
        fill: { type: "solid", color: "#ffffff" },
        fillOpacity: 1,
        stroke: "transparent",
        strokeWidth: 0,
        visible: true,
        locked: false,
        src: pendingImage.src,
        imageFit: "contain",
        maskType: "none",
        isSvg: pendingImage.isSvg,
        naturalWidth: pendingImage.naturalWidth,
        naturalHeight: pendingImage.naturalHeight,
        crop: null,
        adjustments: { ...DEFAULT_IMAGE_ADJUSTMENTS },
      } as any);
      setPendingImage(null);
      // Stay in select tool so user can immediately transform
      setActiveTool("select");
      // Select the newly placed image
      useDesignerStore.getState().selectObject(id);
    },
    [pendingImage, addObject, setActiveTool]
  );

  // Fit zoom
  const [fitZoom, setFitZoom] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      const availW = rect.width - FIT_PADDING * 2;
      const availH = rect.height - FIT_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;
      const z = Math.min(availW / widthMm, availH / heightMm);
      setFitZoom(z);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthMm, heightMm]);

  const effectiveZoom = zoom === "fit" ? fitZoom : zoom;

  // Keep a ref to effectiveZoom for use in event handlers
  const effectiveZoomRef = useRef(effectiveZoom);
  effectiveZoomRef.current = effectiveZoom;

  const screenToMm = useCallback(
    (px: number, py: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = px - rect.left;
      const sy = py - rect.top;
      return {
        x: (sx - panX) / effectiveZoom,
        y: (sy - panY) / effectiveZoom,
      };
    },
    [panX, panY, effectiveZoom]
  );

  const mmToScreen = useCallback(
    (mmX: number, mmY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: rect.left + panX + mmX * effectiveZoom,
        y: rect.top + panY + mmY * effectiveZoom,
      };
    },
    [panX, panY, effectiveZoom]
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (zoom === "fit") {
      const next = Math.max(0.05, Math.min(20, fitZoom - e.deltaY * 0.001 * fitZoom));
      setZoom(next);
      return;
    }
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.max(0.05, Math.min(20, (zoom as number) * factor));
    setZoom(next);
  };

  const objectAt = useCallback(
    (mmX: number, mmY: number): DesignObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!obj.visible || obj.locked) continue;
        const b = getObjectBounds(obj);
        if (mmX >= b.x && mmX <= b.x + b.width && mmY >= b.y && mmY <= b.y + b.height) {
          return obj;
        }
      }
      return null;
    },
    [objects]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    // Don't interfere with editing
    if (editingId) return;

    const mm = screenToMm(e.clientX, e.clientY);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    // Text tool: start drag-to-size or click-to-place
    if (activeTool === "text") {
      dragState.current = {
        type: "text",
        startMmX: mm.x,
        startMmY: mm.y,
        tool: "text",
        currentMmX: mm.x,
        currentMmY: mm.y,
      };
      return;
    }

    // Image tool: place pending image or trigger file picker
    if (activeTool === "image") {
      if (pendingImage) {
        placePendingImage(mm.x, mm.y);
      } else {
        fileInputRef.current?.click();
      }
      return;
    }

    if (activeTool === "select") {
      const obj = objectAt(mm.x, mm.y);
      if (obj) {
        if (e.shiftKey) selectAdd(obj.id);
        else if (!selectedIds.includes(obj.id)) selectObject(obj.id);
        dragState.current = { type: "move", startMmX: mm.x, startMmY: mm.y };
      } else {
        clearSelection();
      }
      return;
    }

    // Drawing tools
    if (["rect", "ellipse", "line", "polygon"].includes(activeTool)) {
      dragState.current = {
        type: "draw",
        startMmX: mm.x,
        startMmY: mm.y,
        tool: activeTool as any,
        currentMmX: mm.x,
        currentMmY: mm.y,
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pyY = e.clientY - rect.top;
    const mmX = (pxX - panX) / effectiveZoom;
    const mmY = (pyY - panY) / effectiveZoom;
    setMouseMm({ x: mmX, y: mmY });

    if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setPan(panX + dx, panY + dy);
      return;
    }

    const ds = dragState.current;
    if (!ds) return;

    if (ds.type === "move" && selectedIds.length > 0 && activeTool === "select") {
      const dx = mmX - ds.startMmX;
      const dy = mmY - ds.startMmY;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        moveSelected(dx, dy);
        ds.startMmX = mmX;
        ds.startMmY = mmY;
      }
    }

    if (ds.type === "draw" || ds.type === "text") {
      ds.currentMmX = mmX;
      ds.currentMmY = mmY;
    }

    if (ds.type === "resize" && ds.origBounds && ds.handle) {
      const newBounds = computeResize(ds.origBounds, ds.handle, mmX, mmY, ds.aspectLocked ?? false);
      // Apply to all selected objects (use the primary one for the drag)
      const primaryId = selectedIds[0];
      if (primaryId) {
        const obj = objects.find((o) => o.id === primaryId);
        if (obj) {
          if (obj.type === "rect") {
            updateObject(primaryId, {
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.w,
              height: newBounds.h,
            } as any);
          } else if (obj.type === "ellipse") {
            updateObject(primaryId, {
              x: newBounds.x + newBounds.w / 2,
              y: newBounds.y + newBounds.h / 2,
              rx: Math.max(1, newBounds.w / 2),
              ry: Math.max(1, newBounds.h / 2),
            } as any);
          } else if (obj.type === "image") {
            updateObject(primaryId, {
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.w,
              height: newBounds.h,
            } as any);
          }
        }
      }
    }

    if (ds.type === "rotate" && ds.center && ds.origRotation !== undefined) {
      const primaryId = selectedIds[0];
      if (primaryId) {
        const angle = Math.atan2(mmY - ds.center.y, mmX - ds.center.x) * (180 / Math.PI);
        const delta = angle - ds.startMmX; // startMmX stores start angle
        let newRot = (ds.origRotation + delta) % 360;
        if (newRot < 0) newRot += 360;
        updateObject(primaryId, { rotation: newRot } as any);
      }
    }
  };

  const onMouseUp = () => {
    isPanning.current = false;

    const ds = dragState.current;

    // Text tool: create text object
    if (ds && ds.type === "text" && ds.currentMmX !== undefined && ds.currentMmY !== undefined) {
      const x1 = ds.startMmX;
      const y1 = ds.startMmY;
      const x2 = ds.currentMmX;
      const y2 = ds.currentMmY;
      const dx = x2 - x1;
      const dy = y2 - y1;

      // If dragged more than a threshold, use drag width; otherwise default width
      const minDrag = 5;
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(dx) > minDrag ? Math.abs(dx) : 60;
      const height = Math.abs(dy) > minDrag ? Math.abs(dy) : 20;

      if (width > 2 && height > 2) {
        const id = addObject({
          type: "text",
          x,
          y,
          content: "Text",
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: 400,
          fontStyle: "normal",
          textColor: "#000000",
          textAlign: "left",
          lineHeight: 1.4,
          letterSpacing: 0,
          textTransform: "none",
          convertOutlines: false,
        } as any);
        // Enter editing mode for the new text
        const obj = useDesignerStore.getState().objects.find((o) => o.id === id);
        if (obj && obj.type === "text") {
          setEditingId(id);
          setEditingText(obj.content);
        }
      }
    }

    // Drawing tools: create shape objects
    if (ds && ds.type === "draw" && ds.currentMmX !== undefined && ds.currentMmY !== undefined) {
      const x1 = ds.startMmX;
      const y1 = ds.startMmY;
      const x2 = ds.currentMmX;
      const y2 = ds.currentMmY;
      const dx = x2 - x1;
      const dy = y2 - y1;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const defaultFill: Fill = { type: "solid", color: "#4f8cff" };
        const defaultStroke = "#1e3a5f";

        if (ds.tool === "rect") {
          addObject({
            type: "rect",
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(dx),
            height: Math.abs(dy),
            rotation: 0,
            fill: defaultFill,
            fillOpacity: 1,
            stroke: defaultStroke,
            strokeWidth: 1,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "ellipse") {
          addObject({
            type: "ellipse",
            x: x1,
            y: y1,
            rx: Math.max(1, Math.abs(dx) / 2),
            ry: Math.max(1, Math.abs(dy) / 2),
            rotation: 0,
            fill: defaultFill,
            fillOpacity: 1,
            stroke: defaultStroke,
            strokeWidth: 1,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "line") {
          addObject({
            type: "line",
            x: x1,
            y: y1,
            x2: x2,
            y2: y2,
            rotation: 0,
            fill: { type: "solid", color: "#000000" },
            fillOpacity: 1,
            stroke: "#1e3a5f",
            strokeWidth: 2,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "polygon") {
          const radius = Math.sqrt(dx * dx + dy * dy);
          const sides = 6;
          if (radius > 2) {
            const points = Array.from({ length: sides }, (_, i) => {
              const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
              return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
            });
            addObject({
              type: "polygon",
              x: x1,
              y: y1,
              points,
              sides,
              rotation: 0,
              fill: defaultFill,
              fillOpacity: 1,
              stroke: defaultStroke,
              strokeWidth: 1,
              visible: true,
              locked: false,
            });
          }
        }
      }
    }

    dragState.current = null;
  };

  // Double-click to edit text
  const onDoubleClick = (e: React.MouseEvent) => {
    if (editingId) return;
    const mm = screenToMm(e.clientX, e.clientY);
    const obj = objectAt(mm.x, mm.y);
    if (obj && obj.type === "text") {
      selectObject(obj.id);
      setEditingId(obj.id);
      setEditingText(obj.content);
    }
  };

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingId && editingRef.current) {
      editingRef.current.focus();
      editingRef.current.select();
    }
  }, [editingId]);

  // Commit or cancel editing
  const commitEdit = () => {
    if (editingId) {
      updateObject(editingId, { content: editingText } as any);
    }
    setEditingId(null);
    setEditingText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  useEffect(() => {
    if (svgRef.current) onReady?.(svgRef.current);
  }, [onReady]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts while editing (except Escape)
      if (editingId) {
        if (e.key === "Escape") {
          cancelEdit();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "v" || e.key === "V") setActiveTool("select");
        if (e.key === "t" || e.key === "T") setActiveTool("text");
        if (e.key === "r" || e.key === "R") setActiveTool("rect");
        if (e.key === "o" || e.key === "O") setActiveTool("ellipse");
        if (e.key === "l" || e.key === "L") setActiveTool("line");
        if (e.key === "p" || e.key === "P") setActiveTool("polygon");
        if (e.key === "i" || e.key === "I") setActiveTool("image");
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) useDesignerStore.getState().redo();
        else useDesignerStore.getState().undo();
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        useDesignerStore.getState().redo();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearSelection, setActiveTool, deleteSelected, editingId]);

  // Preview rect/text while drawing
  const previewObj = (() => {
    const ds = dragState.current;
    if (!ds || ds.type !== "draw" || ds.currentMmX === undefined || ds.currentMmY === undefined) return null;
    const x1 = ds.startMmX;
    const y1 = ds.startMmY;
    const x2 = ds.currentMmX;
    const y2 = ds.currentMmY;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (ds.tool === "rect") {
      return (
        <rect
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(dx)}
          height={Math.abs(dy)}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "ellipse") {
      return (
        <ellipse
          cx={x1}
          cy={y1}
          rx={Math.abs(dx) / 2}
          ry={Math.abs(dy) / 2}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "line") {
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#4f8cff"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "polygon") {
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < 2) return null;
      const sides = 6;
      const pts = Array.from({ length: sides }, (_, i) => {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        return `${x1 + Math.cos(angle) * radius},${y1 + Math.sin(angle) * radius}`;
      }).join(" ");
      return (
        <polygon
          points={pts}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    return null;
  })();

  // Text preview while dragging
  const previewText = (() => {
    const ds = dragState.current;
    if (!ds || ds.type !== "text" || ds.currentMmX === undefined || ds.currentMmY === undefined) return null;
    const x1 = ds.startMmX;
    const y1 = ds.startMmY;
    const x2 = ds.currentMmX;
    const y2 = ds.currentMmY;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 2 || h < 2) return null;
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(79,140,255,0.1)"
        stroke="#4f8cff"
        strokeWidth={0.5}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
    );
  })();

  // Compute editing overlay position
  const editingOverlay = (() => {
    if (!editingId) return null;
    const obj = objects.find((o) => o.id === editingId);
    if (!obj || obj.type !== "text") return null;
    const screen = mmToScreen(obj.x, obj.y);
    const b = getObjectBounds(obj);
    const screenW = b.width * effectiveZoom;
    const screenH = b.height * effectiveZoom;
    const fontSize = obj.fontSize * effectiveZoom;
    return (
      <div
        style={{
          position: "fixed",
          left: screen.x,
          top: screen.y,
          width: Math.max(screenW, 100),
          height: Math.max(screenH, 40),
          zIndex: 1000,
        }}
      >
        <textarea
          ref={editingRef}
          value={editingText}
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancelEdit();
              e.stopPropagation();
            }
          }}
          style={{
            width: "100%",
            height: "100%",
            background: "rgba(10, 13, 18, 0.95)",
            color: obj.textColor,
            border: "1px solid #3b82f6",
            borderRadius: 4,
            padding: 4,
            fontFamily: obj.fontFamily,
            fontSize: `${fontSize}px`,
            fontWeight: obj.fontWeight,
            fontStyle: obj.fontStyle,
            textAlign: obj.textAlign,
            lineHeight: obj.lineHeight,
            letterSpacing: `${obj.letterSpacing * effectiveZoom}px`,
            textTransform: obj.textTransform,
            resize: "none",
            outline: "none",
          }}
        />
      </div>
    );
  })();

  const cursor = activeTool === "select" ? "default" : "crosshair";

  return (
    <>
      {/* Hidden file input — triggered by image tool */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(",")}
        onChange={onFilePickerChange}
        className="hidden"
        aria-label="Upload image"
        style={{ position: "absolute", left: -9999 }}
      />

      <svg
        ref={svgRef}
        className={`h-full w-full select-none ${isDragging ? "ring-2 ring-amber-400 ring-inset" : ""}`}
        style={{ cursor: isPanning.current ? "grabbing" : cursor }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp as any}
        onMouseLeave={onMouseUp as any}
        onDoubleClick={onDoubleClick}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <rect x={0} y={0} width="100%" height="100%" fill="#0a0d12" />

        <g transform={`translate(${panX}, ${panY}) scale(${effectiveZoom})`}>
          {/* Canvas background */}
          {background.type !== "transparent" && (
            <rect
              x={0}
              y={0}
              width={widthMm}
              height={heightMm}
              fill={
                background.type === "solid"
                  ? background.color
                  : "url(#canvas-bg-gradient)"
              }
              stroke="#3b82f6"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {background.type === "transparent" && (
            <rect
              x={0}
              y={0}
              width={widthMm}
              height={heightMm}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={0.5}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {background.type === "linear-gradient" && (
            <defs>
              <linearGradient
                id="canvas-bg-gradient"
                x1="0%"
                y1="0%"
                x2={`${
                  Math.cos(((background.angle - 90) * Math.PI) / 180) * 50 + 50
                }%`}
                y2={`${
                  Math.sin(((background.angle - 90) * Math.PI) / 180) * 50 + 50
                }%`}
              >
                {background.stops.map((s, i) => (
                  <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
                ))}
              </linearGradient>
            </defs>
          )}

          {/* Objects */}
          {objects.map((obj) => (
            <ObjectRenderer key={obj.id} obj={obj} />
          ))}

          {/* Drawing preview */}
          {previewObj}
          {previewText}

          {/* Selection handles — render for ALL selected objects */}
          {selectedIds.map((id) => {
            const obj = objects.find((o) => o.id === id);
            if (!obj) return null;
            return <SelectionHandles key={id} obj={obj} svgRef={svgRef} effectiveZoomRef={effectiveZoomRef} />;
          })}

          {/* Crop overlay — when cropMode active on a selected image with crop */}
          {cropMode && selectedIds[0] && (() => {
            const found = objects.find((o) => o.id === selectedIds[0] && o.type === "image");
            if (!found || found.type !== "image" || !found.crop) return null;
            return <CropOverlay key={`crop-${found.id}`} obj={found as Extract<DesignObject, { type: "image" }> & { crop: { x: number; y: number; width: number; height: number } }} svgRef={svgRef} effectiveZoomRef={effectiveZoomRef} screenToMm={screenToMm} />;
          })()}

          {/* Crosshair */}
          {mouseMm &&
            mouseMm.x >= 0 &&
            mouseMm.x <= widthMm &&
            mouseMm.y >= 0 &&
            mouseMm.y <= heightMm && (
              <g
                pointerEvents="none"
                stroke="#3b82f6"
                strokeWidth={0.2}
                vectorEffect="non-scaling-stroke"
              >
                <line x1={mouseMm.x} y1={0} x2={mouseMm.x} y2={heightMm} />
                <line x1={0} y1={mouseMm.y} x2={widthMm} y2={mouseMm.y} />
              </g>
            )}
        </g>
      </svg>

      {/* Image upload overlay */}
      {(activeTool === "image" || pendingImage || uploadError || isDecoding) && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="pointer-events-auto max-w-sm rounded-lg border border-neutral-700 bg-neutral-900/95 p-6 text-center shadow-2xl">
            {isDecoding ? (
              <>
                <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <div className="text-sm text-neutral-200">Decoding image…</div>
                <div className="mt-1 text-xs text-neutral-500">
                  Large images are downscaled automatically
                </div>
              </>
            ) : uploadError ? (
              <>
                <div className="mb-3 text-2xl">⚠</div>
                <div className="text-sm font-medium text-red-400">Upload error</div>
                <div className="mt-1 text-xs text-neutral-400">{uploadError}</div>
                <div className="mt-3 text-[11px] text-neutral-500">
                  Accepted: PNG, JPG, WebP, GIF, SVG ≤ 50 MB
                </div>
              </>
            ) : pendingImage ? (
              <>
                <div className="mb-3 text-xs font-medium text-amber-400">
                  {pendingImage.isSvg ? "SVG (vector)" : "Image"} ready — click to place
                </div>
                <div className="mb-1 text-sm text-neutral-200">
                  {pendingImage.naturalWidth} × {pendingImage.naturalHeight} px
                  {pendingImage.isSvg ? " (vector)" : " (raster)"}
                </div>
                <div className="text-xs text-neutral-500">
                  {pendingImage.fileName} · {formatFileSize(pendingImage.fileSize)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setPendingImage(null)}
                    className="flex-1 rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-600"
                  >
                    Replace
                  </button>
                </div>
              </>
            ) : activeTool === "image" ? (
              <>
                <div className="mb-3 text-3xl">📁</div>
                <div className="text-sm font-medium text-neutral-200">
                  Drop an image or click to upload
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  PNG, JPG, WebP, GIF, SVG · drag anywhere on canvas
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {editingOverlay}
    </>
  );
}

/** Compute new bounds from a handle drag. */
function computeResize(
  orig: { x: number; y: number; w: number; h: number },
  handle: HandleId,
  mmX: number,
  mmY: number,
  aspectLocked: boolean
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = orig;
  const right = x + w;
  const bottom = y + h;

  // Determine new edges based on handle
  if (handle.includes("w")) {
    x = Math.min(mmX, right - 1);
    w = right - x;
  }
  if (handle.includes("e")) {
    w = Math.max(1, mmX - x);
  }
  if (handle.includes("n")) {
    y = Math.min(mmY, bottom - 1);
    h = bottom - y;
  }
  if (handle.includes("s")) {
    h = Math.max(1, mmY - y);
  }

  // Aspect lock: adjust the dimension that changed less
  if (aspectLocked && w > 0 && h > 0) {
    const origAspect = orig.w / orig.h;
    const newAspect = w / h;
    if (newAspect > origAspect) {
      // width grew too much — adjust
      if (handle.includes("e") || handle.includes("w")) {
        w = h * origAspect;
      } else {
        h = w / origAspect;
      }
    } else {
      if (handle.includes("n") || handle.includes("s")) {
        h = w / origAspect;
      } else {
        w = h * origAspect;
      }
    }
  }

  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

function ObjectRenderer({ obj }: { obj: DesignObject }) {
  if (!obj.visible) return null;

  const fillCss =
    obj.fill.type === "transparent"
      ? "none"
      : obj.fill.type === "solid"
      ? colorToCss(obj.fill.color, obj.fillOpacity)
      : `url(#grad-${obj.id})`;

  const strokeCss =
    obj.stroke === "transparent" ? "none" : colorToCss(obj.stroke, obj.fillOpacity);

  const transform = obj.rotation ? `rotate(${obj.rotation})` : undefined;

  switch (obj.type) {
    case "rect":
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );

    case "ellipse":
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <ellipse
            cx={obj.x}
            cy={obj.y}
            rx={obj.rx}
            ry={obj.ry}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );

    case "line":
      return (
        <line
          x1={obj.x}
          y1={obj.y}
          x2={obj.x2}
          y2={obj.y2}
          stroke={strokeCss === "none" ? "#000000" : strokeCss}
          strokeWidth={obj.strokeWidth}
          strokeLinecap="round"
        />
      );

    case "polygon": {
      const pts = obj.points
        .map((p) => `${obj.x + p.x},${obj.y + p.y}`)
        .join(" ");
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <polygon
            points={pts}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );
    }

    case "text": {
      const textColor = obj.textColor || "#000000";
      const textFill = colorToCss(textColor, obj.fillOpacity);
      const lines = obj.content.split("\n");
      const lineHeightMm = obj.fontSize * obj.lineHeight;
      const anchor = obj.textAlign === "center" ? "middle" : obj.textAlign === "right" ? "end" : "start";
      const xPos = obj.textAlign === "center" ? obj.x + (getObjectBounds(obj).width / 2) : obj.textAlign === "right" ? obj.x + getObjectBounds(obj).width : obj.x;

      return (
        <g transform={transform}>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <text
            x={xPos}
            y={obj.y}
            fontFamily={`"${obj.fontFamily}", sans-serif`}
            fontSize={obj.fontSize}
            fontWeight={obj.fontWeight}
            fontStyle={obj.fontStyle}
            fill={textFill}
            dominantBaseline="hanging"
            textAnchor={anchor}
            letterSpacing={obj.letterSpacing}
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={xPos}
                dy={i === 0 ? 0 : lineHeightMm}
              >
                {line || " "}
              </tspan>
            ))}
          </text>
        </g>
      );
    }

    case "image": {
      // Map imageFit to preserveAspectRatio
      const preserveAspectRatio =
        obj.imageFit === "stretch"
          ? "none"
          : obj.imageFit === "cover"
          ? "xMidYMid slice"
          : "xMidYMid meet"; // contain

      // Build clip path for mask
      const clipId = `clip-${obj.id}`;
      const needsClip = obj.maskType === "rect" || obj.maskType === "ellipse";

      // Build filter attribute from adjustments
      const filterAttr = buildFilterString(obj.adjustments);
      const hasFilter = filterAttr !== "none";

      // Flip transform (applied in addition to rotation)
      const flipTransform = buildFlipTransform(obj.adjustments);
      const baseTransform = obj.rotation ? `rotate(${obj.rotation})` : undefined;

      return (
        <g>
          {needsClip && (
            <defs>
              <clipPath id={clipId}>
                {obj.maskType === "rect" ? (
                  <rect
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                  />
                ) : obj.maskType === "ellipse" ? (
                  <ellipse
                    cx={obj.x + obj.width / 2}
                    cy={obj.y + obj.height / 2}
                    rx={obj.width / 2}
                    ry={obj.height / 2}
                  />
                ) : null}
              </clipPath>
            </defs>
          )}
          <image
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            href={obj.src}
            preserveAspectRatio={preserveAspectRatio}
            clipPath={needsClip ? `url(#${clipId})` : undefined}
            filter={hasFilter ? filterAttr : undefined}
            transform={[baseTransform, flipTransform].filter(Boolean).join(" ") || undefined}
            style={obj.isSvg ? { shapeRendering: "geometricPrecision" } : undefined}
          />
        </g>
      );
    }

    default:
      return null;
  }
}

function GradientDef({ id, fill }: { id: string; fill: Fill }) {
  if (fill.type !== "linear-gradient") return null;
  return (
    <linearGradient
      id={id}
      x1="0%"
      y1="0%"
      x2={`${Math.cos(((fill.angle - 90) * Math.PI) / 180) * 50 + 50}%`}
      y2={`${Math.sin(((fill.angle - 90) * Math.PI) / 180) * 50 + 50}%`}
    >
      {fill.stops.map((s, i) => (
        <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
      ))}
    </linearGradient>
  );
}

function SelectionHandles({ obj, svgRef, effectiveZoomRef }: { obj: DesignObject; svgRef: React.RefObject<SVGSVGElement | null>; effectiveZoomRef: React.RefObject<number> }) {
  if (!obj) return null;
  const b = getObjectBounds(obj);
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };

  const handles: Array<{ id: HandleId; x: number; y: number }> = [
    { id: "nw", x: b.x, y: b.y },
    { id: "n", x: center.x, y: b.y },
    { id: "ne", x: b.x + b.width, y: b.y },
    { id: "e", x: b.x + b.width, y: center.y },
    { id: "se", x: b.x + b.width, y: b.y + b.height },
    { id: "s", x: center.x, y: b.y + b.height },
    { id: "sw", x: b.x, y: b.y + b.height },
    { id: "w", x: b.x, y: center.y },
  ];

  const selectObject = useDesignerStore((s) => s.selectObject);
  const liveUpdateObject = useDesignerStore((s) => s.liveUpdateObject);
  const beginInteraction = useDesignerStore((s) => s.beginInteraction);
  const endInteraction = useDesignerStore((s) => s.endInteraction);

  const onHandleMouseDown = (e: React.MouseEvent, handleId: HandleId) => {
    e.stopPropagation();
    selectObject(obj.id);
    beginInteraction();

    const svg = svgRef.current;
    if (!svg) return;

    const onMove = (ev: MouseEvent) => {
      const state = useDesignerStore.getState();
      const zoom = effectiveZoomRef.current;
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const mmX = (px - state.panX) / zoom;
      const mmY = (py - state.panY) / zoom;

      const orig = { x: b.x, y: b.y, w: b.width, h: b.height };
      const newBounds = computeResize(orig, handleId, mmX, mmY, ev.shiftKey);

      if (obj.type === "rect") {
        liveUpdateObject(obj.id, {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.w,
          height: newBounds.h,
        } as any);
      } else if (obj.type === "ellipse") {
        liveUpdateObject(obj.id, {
          x: newBounds.x + newBounds.w / 2,
          y: newBounds.y + newBounds.h / 2,
          rx: Math.max(1, newBounds.w / 2),
          ry: Math.max(1, newBounds.h / 2),
        } as any);
      } else if (obj.type === "text") {
        // For text, resize changes fontSize proportionally
        const scale = newBounds.h / b.height;
        const newSize = Math.max(4, obj.fontSize * scale);
        liveUpdateObject(obj.id, {
          x: newBounds.x,
          y: newBounds.y,
          fontSize: newSize,
        } as any);
      } else if (obj.type === "image") {
        liveUpdateObject(obj.id, {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.w,
          height: newBounds.h,
        } as any);
      }
    };

    const onUp = () => {
      endInteraction();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectObject(obj.id);
    beginInteraction();

    const svg = svgRef.current;
    if (!svg) return;

    let startAngle: number | null = null;
    let origRotation = obj.rotation;

    const onMove = (ev: MouseEvent) => {
      const state = useDesignerStore.getState();
      const zoom = effectiveZoomRef.current;
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const mmX = (px - state.panX) / zoom;
      const mmY = (py - state.panY) / zoom;

      const angle = Math.atan2(mmY - center.y, mmX - center.x) * (180 / Math.PI);
      if (startAngle === null) {
        startAngle = angle;
      }
      const delta = angle - startAngle;
      let newRot = (origRotation + delta) % 360;
      if (newRot < 0) newRot += 360;
      liveUpdateObject(obj.id, { rotation: newRot } as any);
    };

    const onUp = () => {
      endInteraction();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <g pointerEvents="all">
      <rect
        x={b.x}
        y={b.y}
        width={b.width}
        height={b.height}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={0.5}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {/* Rotate handle line + circle */}
      <line
        x1={center.x}
        y1={b.y}
        x2={center.x}
        y2={b.y - ROTATE_HANDLE_OFFSET}
        stroke="#3b82f6"
        strokeWidth={0.3}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <circle
        cx={center.x}
        cy={b.y - ROTATE_HANDLE_OFFSET}
        r={HANDLE_SIZE / 2}
        fill="#3b82f6"
        stroke="#fff"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
        onMouseDown={onRotateMouseDown}
        style={{ cursor: "grab" }}
      />
      {handles.map((h) => (
        <circle
          key={h.id}
          cx={h.x}
          cy={h.y}
          r={HANDLE_SIZE / 2}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
          onMouseDown={(e) => onHandleMouseDown(e, h.id)}
          style={{ cursor: getCursorForHandle(h.id) }}
        />
      ))}
    </g>
  );
}

function getCursorForHandle(handle: HandleId): string {
  switch (handle) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    default:
      return "pointer";
  }
}

function CropOverlay({
  obj,
  svgRef,
  effectiveZoomRef,
  screenToMm,
}: {
  obj: Extract<DesignObject, { type: "image" }> & { crop: { x: number; y: number; width: number; height: number } };
  svgRef: React.RefObject<SVGSVGElement | null>;
  effectiveZoomRef: React.RefObject<number>;
  screenToMm: (px: number, py: number) => { x: number; y: number };
}) {
  const { crop } = obj;
  if (!crop) return null;

  const displayX = obj.x;
  const displayY = obj.y;
  const displayW = obj.width;
  const displayH = obj.height;

  const imgAspect = obj.naturalWidth / obj.naturalHeight;
  const boxAspect = displayW / displayH;

  let drawX = displayX, drawY = displayY, drawW = displayW, drawH = displayH;
  if (obj.imageFit === "contain") {
    if (imgAspect > boxAspect) {
      drawH = displayW / imgAspect;
      drawY = displayY + (displayH - drawH) / 2;
    } else {
      drawW = displayH * imgAspect;
      drawX = displayX + (displayW - drawW) / 2;
    }
  } else if (obj.imageFit === "cover") {
    if (imgAspect > boxAspect) {
      drawW = displayH * imgAspect;
      drawX = displayX + (displayW - drawW) / 2;
    } else {
      drawH = displayW / imgAspect;
      drawY = displayY + (displayH - drawH) / 2;
    }
  }

  const cropMmX = drawX + (crop.x / obj.naturalWidth) * drawW;
  const cropMmY = drawY + (crop.y / obj.naturalHeight) * drawH;
  const cropMmW = (crop.width / obj.naturalWidth) * drawW;
  const cropMmH = (crop.height / obj.naturalHeight) * drawH;

  const updateObject = useDesignerStore((s) => s.updateObject);

  const makeCropDragHandler = (corner: "nw" | "se") => {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;

      const onMove = (ev: MouseEvent) => {
        const zoom = effectiveZoomRef.current;
        const rect = svg.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const mmX = (px - useDesignerStore.getState().panX) / zoom;
        const mmY = (py - useDesignerStore.getState().panY) / zoom;

        const sx = Math.max(0, Math.min(obj.naturalWidth, Math.round(((mmX - drawX) / drawW) * obj.naturalWidth)));
        const sy = Math.max(0, Math.min(obj.naturalHeight, Math.round(((mmY - drawY) / drawH) * obj.naturalHeight)));

        if (corner === "se") {
          const sw = Math.max(10, Math.min(obj.naturalWidth - crop.x, sx - crop.x));
          const sh = Math.max(10, Math.min(obj.naturalHeight - crop.y, sy - crop.y));
          updateObject(obj.id, { crop: { x: crop.x, y: crop.y, width: sw, height: sh } } as any);
        } else {
          const newX = Math.max(0, Math.min(crop.x + crop.width - 10, sx));
          const newY = Math.max(0, Math.min(crop.y + crop.height - 10, sy));
          updateObject(obj.id, { crop: { x: newX, y: newY, width: crop.x + crop.width - newX, height: crop.y + crop.height - newY } } as any);
        }
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  };

  return (
    <g pointerEvents="all">
      <rect x={displayX} y={displayY} width={displayW} height={displayH} fill="rgba(0,0,0,0.5)" />
      <rect x={cropMmX} y={cropMmY} width={cropMmW} height={cropMmH} fill="transparent" stroke="#fbbf24" strokeWidth={1} />
      <rect x={cropMmX - 3} y={cropMmY - 3} width={6} height={6} fill="#fbbf24" stroke="#000" strokeWidth={0.5} onMouseDown={makeCropDragHandler("nw")} style={{ cursor: "nw-resize" }} />
      <rect x={cropMmX + cropMmW - 3} y={cropMmY + cropMmH - 3} width={6} height={6} fill="#fbbf24" stroke="#000" strokeWidth={0.5} onMouseDown={makeCropDragHandler("se")} style={{ cursor: "se-resize" }} />
      <line x1={cropMmX + cropMmW / 3} y1={cropMmY} x2={cropMmX + cropMmW / 3} y2={cropMmY + cropMmH} stroke="rgba(255,255,255,0.3)" strokeWidth={0.3} />
      <line x1={cropMmX + 2 * cropMmW / 3} y1={cropMmY} x2={cropMmX + 2 * cropMmW / 3} y2={cropMmY + cropMmH} stroke="rgba(255,255,255,0.3)" strokeWidth={0.3} />
      <line x1={cropMmX} y1={cropMmY + cropMmH / 3} x2={cropMmX + cropMmW} y2={cropMmY + cropMmH / 3} stroke="rgba(255,255,255,0.3)" strokeWidth={0.3} />
      <line x1={cropMmX} y1={cropMmY + 2 * cropMmH / 3} x2={cropMmX + cropMmW} y2={cropMmY + 2 * cropMmH / 3} stroke="rgba(255,255,255,0.3)" strokeWidth={0.3} />
    </g>
  );
}
