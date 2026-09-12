"use client";

import { useEffect, useState } from "react";
import {
  DIM_LIMITS,
  parseDimension,
  validateDimension,
  type DimKey,
  type ValidationResult,
} from "@/lib/dimValidation";

export interface DimInputState {
  text: string;
  error: string | null;
  committed: number;
  setText: (raw: string) => void;
  onTextBlur: () => void;
  onTextKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSliderChange: (raw: string) => void;
  setCommitted: (n: number) => void;
}

/**
 * Manages a single dimension input (number + slider) with two-way sync
 * and inline validation. Text input is free-form during typing; commits
 * to the store only on blur / slider-release / Enter — never mid-keystroke.
 */
export function useDimInput(
  committed: number,
  onCommit: (n: number) => void,
  dimKey: DimKey,
): DimInputState {
  const [text, setText] = useState<string>(String(committed));
  const [error, setError] = useState<string | null>(null);
  const [localCommitted, setLocalCommitted] = useState<number>(committed);

  // When committed value changes externally (e.g. slider, reset),
  // sync the text field so slider drag doesn't fight the input.
  useEffect(() => {
    setLocalCommitted(committed);
    // Only sync text if we're not actively editing (no focus on this field).
    // We detect that via a data attribute set on focus/blur.
    const active = document.activeElement;
    const isFocused =
      active instanceof HTMLElement &&
      active.dataset.dimKey === dimKey;
    if (!isFocused) {
      setText(String(committed));
      setError(null);
    }
  }, [committed, dimKey]);

  const limits = DIM_LIMITS[dimKey];

  const commit = (raw: string) => {
    const parsed = parseDimension(raw);
    const result: ValidationResult = validateDimension(
      parsed,
      limits.min,
      limits.max,
    );
    if (!result.valid) {
      setError(result.error);
      // Don't update committed — reject invalid input
      return;
    }
    setError(null);
    setLocalCommitted(parsed);
    onCommit(parsed);
  };

  const onSliderChange = (raw: string) => {
    const parsed = Number(raw);
    // Slider always emits in-range values, so no validation needed here —
    // but we still parse to be safe.
    const result = validateDimension(parsed, limits.min, limits.max);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setLocalCommitted(parsed);
    onCommit(parsed);
    // Slider updates text immediately for live feedback
    setText(String(parsed));
  };

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return {
    text,
    error,
    committed: localCommitted,
    setText,
    onTextBlur: () => commit(text),
    onTextKeyDown,
    onSliderChange,
    setCommitted: setLocalCommitted,
  };
}
