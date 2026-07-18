"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { LabelOverlay } from "@/src/landing/components/LabelOverlay";
import { LandingNav } from "@/src/landing/components/LandingNav";
import { PresetGlow } from "@/src/landing/components/PresetGlow";
import { ScrollLogo } from "@/src/landing/components/ScrollLogo";
import { SectionNav } from "@/src/landing/components/SectionNav";
import { isEditableKeyTarget } from "@/src/landing/keyboard";
import type { ProjectedLabel } from "@/src/landing/engine/label-projection";
import { loadModelPoints, type ModelData } from "@/src/landing/engine/model-loader";
import { presets } from "@/src/landing/engine/presets";
import { DEFAULT_SETTINGS, type SystemSettings } from "@/src/landing/engine/types";
import { clamp } from "@/src/landing/utils/math";
import {
  initReducedMotion,
  motionScrollBehavior,
  reducedMotion,
} from "@/src/landing/utils/reduced-motion";
import type { ParticleCanvasProps } from "@/src/landing/components/ParticleCanvas";

const SCROLL_MORPH_PLATEAU = 0.34;

function morphPlateauWithinUnitSpan(t: number, plateau: number): number {
  if (plateau <= 1e-6) return t;
  const lo = plateau * 0.5;
  const hi = 1 - lo;
  if (t <= lo) return 0;
  if (t >= hi) return 1;
  return (t - lo) / (hi - lo);
}

function scrollMorphPlateauForSegment(
  segmentIndex: number,
  maxMorph: number,
  plateau: number,
): number {
  if (plateau <= 1e-6 || segmentIndex === 0 || segmentIndex === maxMorph - 1) {
    return 0;
  }
  return plateau;
}

function morphPlateauAcrossIndices(
  linearMorph: number,
  maxValue: number,
  plateau: number,
): number {
  const clamped = clamp(linearMorph, 0, maxValue);
  if (maxValue < 1) return clamped;
  const base = Math.floor(clamped);
  if (base >= maxValue) return maxValue;
  const frac = clamped - base;
  const p = scrollMorphPlateauForSegment(base, maxValue, plateau);
  return base + morphPlateauWithinUnitSpan(frac, p);
}

const KONAMI_KEYS = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
  "Enter",
] as const;

const KONAMI_IDLE_MS = 4000;
const LOADING_SCREEN_MIN_MS = 1000;
const LOADING_SCREEN_SELECTOR = ".loading-screen-overlay";
const LOADING_SCREEN_DISMISSED_CLASS = "is-dismissed";
const BRAND_MODE_SETTINGS: SystemSettings = {
  ...DEFAULT_SETTINGS,
  colorMode: 2,
};
const LANDING_SECTION_IDS = [
  "the-framework",
  "full-stack",
  "ai-ready",
  "powerful-components",
  "use-cases",
  "contact",
] as const;

type ParticleCanvasStatus = "idle" | "loaded" | "ready" | "failed";

function konamiKeyMatches(event: KeyboardEvent, expected: string): boolean {
  if (expected.startsWith("Arrow")) return event.key === expected;
  if (expected === "Enter") return event.key === "Enter";
  return event.key.length === 1 && event.key.toLowerCase() === expected;
}

export function LandingEnhancements() {
  const [brandMode, setBrandMode] = useState(false);
  const [ParticleCanvasComponent, setParticleCanvasComponent] =
    useState<ComponentType<ParticleCanvasProps> | null>(null);
  const [, setRenderTick] = useState(0);

  const konamiRef = useRef({
    index: 0,
    idleTimer: null as ReturnType<typeof setTimeout> | null,
  });
  const modelDataRef = useRef<(ModelData | undefined)[]>(
    presets.map(() => undefined),
  );
  const modelLoadsRef = useRef({
    pendingUrls: new Set<string>(),
    failedUrls: new Set<string>(),
  });
  const scrollRef = useRef({
    morphValue: 0,
    currentY: 0,
    frame: 0,
    sectionStops: null as number[] | null,
  });
  const particleCanvasStatusRef = useRef<ParticleCanvasStatus>("idle");
  const loadingScreenRef = useRef({
    minElapsed: false,
    dismissed: false,
    minTimer: null as ReturnType<typeof setTimeout> | null,
  });
  const projectedLabelsRef = useRef<ProjectedLabel[]>([]);
  const labelOpacityRef = useRef(0);
  const morphValueRef = useRef(0);
  const scrollYRef = useRef(0);
  const activeIndexRef = useRef(0);
  const eagerModelIndexes = useRef(
    presets
      .map((preset, index) => (preset.preloadEager ? index : -1))
      .filter((index) => index >= 0),
  );

  const getScrollRange = useCallback(() => {
    return Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1,
    );
  }, []);

  const clampScrollY = useCallback(
    (scrollY: number) => clamp(scrollY, 0, getScrollRange()),
    [getScrollRange],
  );

  const getSectionScrollStop = useCallback(
    (index: number): number | undefined => {
      if (index === 0) return 0;
      const id = LANDING_SECTION_IDS[index];
      if (!id) return undefined;
      const el = document.getElementById(id);
      if (!el) return undefined;
      if (el.offsetHeight > window.innerHeight) {
        return clampScrollY(el.offsetTop);
      }
      const sectionCenter = el.offsetTop + el.offsetHeight / 2;
      return clampScrollY(sectionCenter - window.innerHeight / 2);
    },
    [clampScrollY],
  );

  const getSectionScrollStops = useCallback((): number[] | undefined => {
    if (scrollRef.current.sectionStops) return scrollRef.current.sectionStops;

    const stops: number[] = [];
    for (let index = 0; index < presets.length; index++) {
      const stop = getSectionScrollStop(index);
      if (stop === undefined) return undefined;
      stops.push(stop);
    }
    scrollRef.current.sectionStops = stops;
    return stops;
  }, [getSectionScrollStop]);

  const getMorphValueForScroll = useCallback(
    (scrollY: number) => {
      const maxValue = presets.length - 1;
      const stops = getSectionScrollStops();
      if (!stops) {
        const linearMorph =
          (clampScrollY(scrollY) / getScrollRange()) * maxValue;
        return morphPlateauAcrossIndices(
          linearMorph,
          maxValue,
          SCROLL_MORPH_PLATEAU,
        );
      }

      const clampedScrollY = clampScrollY(scrollY);
      if (clampedScrollY <= stops[0]) return 0;

      for (let index = 0; index < maxValue; index++) {
        const from = stops[index];
        const to = stops[index + 1];
        if (clampedScrollY > to) continue;
        const span = to - from;
        if (span <= 1) return index + 1;
        const t = (clampedScrollY - from) / span;
        const plateau = scrollMorphPlateauForSegment(
          index,
          maxValue,
          SCROLL_MORPH_PLATEAU,
        );
        return index + morphPlateauWithinUnitSpan(t, plateau);
      }

      return maxValue;
    },
    [clampScrollY, getScrollRange, getSectionScrollStops],
  );

  const assignModelData = useCallback((url: string, data: ModelData) => {
    presets.forEach((preset, index) => {
      if (preset.modelUrl === url) {
        modelDataRef.current[index] = data;
      }
    });
    setRenderTick((n) => n + 1);
  }, []);

  const requestModel = useCallback(
    async (index: number) => {
      const preset = presets[index];
      const url = preset?.modelUrl;
      const modelLoads = modelLoadsRef.current;
      const modelData = modelDataRef.current;

      if (
        !url ||
        modelData[index] !== undefined ||
        modelLoads.pendingUrls.has(url) ||
        modelLoads.failedUrls.has(url)
      ) {
        return;
      }

      modelLoads.pendingUrls.add(url);

      try {
        const data = await loadModelPoints(url);
        assignModelData(url, data);
      } catch (error) {
        modelLoads.failedUrls.add(url);
        console.error(error);
      } finally {
        modelLoads.pendingUrls.delete(url);
      }
    },
    [assignModelData],
  );

  const requestNearbyModels = useCallback(() => {
    for (const index of eagerModelIndexes.current) {
      void requestModel(index);
    }

    presets.forEach((preset, index) => {
      if (!preset.modelUrl) return;
      if (Math.abs(scrollRef.current.morphValue - index) < 1.1) {
        void requestModel(index);
      }
    });
  }, [requestModel]);

  const syncMorphToScroll = useCallback(() => {
    const rawMorphValue = getMorphValueForScroll(window.scrollY);
    const activeIndex = Math.round(
      clamp(rawMorphValue, 0, presets.length - 1),
    );
    scrollRef.current.morphValue = reducedMotion.current
      ? activeIndex
      : rawMorphValue;
    morphValueRef.current = scrollRef.current.morphValue;
    scrollRef.current.currentY = window.scrollY;
    scrollYRef.current = scrollRef.current.currentY;
    activeIndexRef.current = activeIndex;
    requestNearbyModels();
  }, [getMorphValueForScroll, requestNearbyModels]);

  const jumpToPreset = useCallback(
    (index: number) => {
      if (index === 0) {
        window.scrollTo({ top: 0, behavior: motionScrollBehavior() });
        return;
      }
      const targetY = getSectionScrollStop(index);
      if (targetY === undefined) return;
      window.scrollTo({ top: targetY, behavior: motionScrollBehavior() });
    },
    [getSectionScrollStop],
  );

  const scheduleMorphSync = useCallback(() => {
    if (scrollRef.current.frame) return;
    scrollRef.current.frame = window.requestAnimationFrame(() => {
      scrollRef.current.frame = 0;
      syncMorphToScroll();
    });
  }, [syncMorphToScroll]);

  const particleCanvasHasSettled = useCallback(() => {
    const status = particleCanvasStatusRef.current;
    return status === "ready" || status === "failed";
  }, []);

  const canDismissLoadingScreen = useCallback(() => {
    return loadingScreenRef.current.minElapsed && particleCanvasHasSettled();
  }, [particleCanvasHasSettled]);

  const syncLoadingScreenDismissal = useCallback(() => {
    if (loadingScreenRef.current.dismissed || !canDismissLoadingScreen()) {
      return;
    }

    const overlay = document.querySelector<HTMLElement>(
      LOADING_SCREEN_SELECTOR,
    );
    overlay?.classList.add(LOADING_SCREEN_DISMISSED_CLASS);
    loadingScreenRef.current.dismissed = true;
  }, [canDismissLoadingScreen]);

  const markParticleCanvasReady = useCallback(() => {
    if (particleCanvasStatusRef.current === "ready") return;
    particleCanvasStatusRef.current = "ready";
    syncLoadingScreenDismissal();
  }, [syncLoadingScreenDismissal]);

  const markParticleCanvasFailed = useCallback(
    (error: unknown) => {
      if (particleCanvasStatusRef.current === "failed") return;
      particleCanvasStatusRef.current = "failed";
      console.error(error);
      syncLoadingScreenDismissal();
      setRenderTick((n) => n + 1);
    },
    [syncLoadingScreenDismissal],
  );

  const clearKonamiIdleTimer = useCallback(() => {
    const konami = konamiRef.current;
    if (konami.idleTimer) {
      clearTimeout(konami.idleTimer);
      konami.idleTimer = null;
    }
  }, []);

  const armKonamiIdle = useCallback(() => {
    clearKonamiIdleTimer();
    konamiRef.current.idleTimer = setTimeout(() => {
      konamiRef.current.idleTimer = null;
      konamiRef.current.index = 0;
    }, KONAMI_IDLE_MS);
  }, [clearKonamiIdleTimer]);

  const onKonamiKeydown = useCallback(
    (event: KeyboardEvent) => {
      const konami = konamiRef.current;
      const expected = KONAMI_KEYS[konami.index];
      if (konamiKeyMatches(event, expected)) {
        konami.index += 1;
        if (konami.index >= KONAMI_KEYS.length) {
          event.preventDefault();
          clearKonamiIdleTimer();
          setBrandMode((prev) => !prev);
          konami.index = 0;
        } else {
          armKonamiIdle();
        }
      } else {
        konami.index = konamiKeyMatches(event, KONAMI_KEYS[0]) ? 1 : 0;
        if (konami.index > 0) armKonamiIdle();
        else clearKonamiIdleTimer();
      }
    },
    [armKonamiIdle, clearKonamiIdleTimer],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    initReducedMotion(signal, () => {
      syncMorphToScroll();
      setRenderTick((n) => n + 1);
    });

    loadingScreenRef.current.minTimer = setTimeout(() => {
      loadingScreenRef.current.minTimer = null;
      loadingScreenRef.current.minElapsed = true;
      syncLoadingScreenDismissal();
    }, LOADING_SCREEN_MIN_MS);

    syncMorphToScroll();

    void import("@/src/landing/components/ParticleCanvas")
      .then((module) => {
        if (signal.aborted) return;
        setParticleCanvasComponent(() => module.ParticleCanvas);
        particleCanvasStatusRef.current = "loaded";
        syncLoadingScreenDismissal();
        setRenderTick((n) => n + 1);
      })
      .catch((error: unknown) => {
        particleCanvasStatusRef.current = "failed";
        console.error(error);
        syncLoadingScreenDismissal();
      });

    const onScroll = () => scheduleMorphSync();
    const onResize = () => {
      scrollRef.current.sectionStops = null;
      scheduleMorphSync();
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableKeyTarget(event)) return;
      onKonamiKeydown(event);
    };

    window.addEventListener("scroll", onScroll, { passive: true, signal });
    window.addEventListener("resize", onResize, { signal });
    window.addEventListener("keydown", onKeydown, { signal });

    return () => {
      controller.abort();
      window.cancelAnimationFrame(scrollRef.current.frame);
      if (loadingScreenRef.current.minTimer) {
        clearTimeout(loadingScreenRef.current.minTimer);
      }
      clearKonamiIdleTimer();
      konamiRef.current.index = 0;
    };
  }, [
    armKonamiIdle,
    clearKonamiIdleTimer,
    onKonamiKeydown,
    scheduleMorphSync,
    syncLoadingScreenDismissal,
    syncMorphToScroll,
  ]);

  const settings = brandMode ? BRAND_MODE_SETTINGS : DEFAULT_SETTINGS;

  return (
    <div className="landing-enhancements">
      {ParticleCanvasComponent ? (
        <ParticleCanvasComponent
          settings={settings}
          presets={presets}
          morphValueRef={morphValueRef}
          modelData={modelDataRef.current}
          labelsRef={projectedLabelsRef}
          labelOpacityRef={labelOpacityRef}
          onReady={markParticleCanvasReady}
          onError={markParticleCanvasFailed}
        />
      ) : null}
      <LabelOverlay
        labelsRef={projectedLabelsRef}
        opacityRef={labelOpacityRef}
      />
      <PresetGlow
        morphValueRef={morphValueRef}
        brandGradientMode={brandMode}
      />
      <ScrollLogo />
      <div className="landing-enhancements__blur-shell" />
      <div className="landing-enhancements__top-fade" />
      <LandingNav
        activeIndexRef={activeIndexRef}
        totalSections={presets.length}
        onJump={jumpToPreset}
        scrollYRef={scrollYRef}
        shouldBlockBlogShortcut={() => konamiRef.current.index > 0}
      />
      <SectionNav
        activeIndexRef={activeIndexRef}
        morphValueRef={morphValueRef}
        onJump={jumpToPreset}
      />
    </div>
  );
}
