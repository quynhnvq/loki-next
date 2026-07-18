"use client";

import { useEffect, useRef } from "react";
import { presets } from "@/src/landing/engine/presets";
import { clamp, lerp } from "@/src/landing/utils/math";

const BRAND_GRADIENT =
  "radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--brand-cycle) 42%, transparent) 0%, color-mix(in srgb, var(--brand-cycle) 14%, transparent) 42%, transparent 72%)";

function buildGradient(morphValue: number, brandGradientMode: boolean): string {
  if (brandGradientMode) return BRAND_GRADIENT;

  const maxIdx = presets.length - 1;
  const clamped = clamp(morphValue, 0, maxIdx);
  const fromIndex = Math.floor(clamped);
  const toIndex = Math.min(fromIndex + 1, maxIdx);
  const blend = clamped - fromIndex;
  const fallback: [number, number, number] = [0.3, 0.3, 0.3];
  const a = presets[fromIndex]?.glowColor ?? fallback;
  const b = presets[toIndex]?.glowColor ?? fallback;
  const r = Math.round(lerp(a[0], b[0], blend) * 255);
  const g = Math.round(lerp(a[1], b[1], blend) * 255);
  const bl = Math.round(lerp(a[2], b[2], blend) * 255);

  return `radial-gradient(ellipse at 50% 50%, rgba(${r},${g},${bl},0.40) 0%, rgba(${r},${g},${bl},0.12) 40%, transparent 70%)`;
}

type PresetGlowProps = {
  morphValueRef: React.MutableRefObject<number>;
  brandGradientMode: boolean;
};

export function PresetGlow({
  morphValueRef,
  brandGradientMode,
}: PresetGlowProps) {
  const glowRef = useRef<HTMLDivElement>(null);
  const frameIdRef = useRef(0);
  const lastBackgroundRef = useRef("");
  const brandModeRef = useRef(brandGradientMode);

  brandModeRef.current = brandGradientMode;

  useEffect(() => {
    if (brandModeRef.current !== brandGradientMode) {
      lastBackgroundRef.current = "";
    }
  }, [brandGradientMode]);

  useEffect(() => {
    function tick() {
      frameIdRef.current = 0;
      const glowEl = glowRef.current;
      if (!glowEl) return;

      const quantized = Math.round(morphValueRef.current * 100) / 100;
      const background = buildGradient(quantized, brandModeRef.current);
      if (background !== lastBackgroundRef.current) {
        glowEl.style.background = background;
        lastBackgroundRef.current = background;
      }

      frameIdRef.current = requestAnimationFrame(tick);
    }

    frameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = 0;
      }
    };
  }, [morphValueRef]);

  return <div ref={glowRef} className="preset-glow" />;
}
