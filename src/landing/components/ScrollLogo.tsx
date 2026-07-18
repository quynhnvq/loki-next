"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Wordmark } from "@/src/landing/components/Wordmark";
import { clamp01, lerp } from "@/src/landing/utils/math";
import {
  motionScrollBehavior,
  reducedMotion,
} from "@/src/landing/utils/reduced-motion";

const LARGE_MAX_WIDTH = 880;
const SMALL_WIDTH = 160;
const LARGE_TOP = 92;
const SMALL_TOP = 24;
const LEFT = 24;
const SCROLL_PX = 120;
const SVG_RATIO = 440 / 143;
/** Fixed SSR/client first-paint width so hydration styles match. */
const INITIAL_VIEWPORT_WIDTH = 1024;

function getLargeWidth(viewportWidth: number) {
  return Math.min(viewportWidth - LEFT * 2, LARGE_MAX_WIDTH);
}

function getLogoLeft(width: number, viewportWidth: number, t: number) {
  return lerp((viewportWidth - width) / 2, LEFT, t);
}

const BRAND_COLORS = ["#2dacf9", "#7ce95a", "#ffdf5f", "#fa73da", "#ff3c32"];
const GHOST_TAUS = [0.018, 0.03, 0.045, 0.06, 0.08];
const OPACITY_FALLOFF_PX = 18;
const SETTLE_EPSILON = 0.2;

function getScrollProgress(scrollY: number) {
  const linear = clamp01(scrollY / SCROLL_PX);
  return linear < 0.5
    ? 4 * linear * linear * linear
    : 1 - Math.pow(-2 * linear + 2, 3) / 2;
}

async function replaceCurrentUrl(href: string) {
  const navigation = window.navigation;

  if (!navigation) {
    window.history.replaceState(window.history.state, "", href);
    return;
  }

  const state = navigation.currentEntry?.getState();
  const transition = navigation.navigate(href, { history: "replace" });
  await transition.committed;
  navigation.updateCurrentEntry({ state });
}

export function ScrollLogo() {
  const [, setTick] = useState(0);
  // Never read window during render — SSR and hydration must share the same
  // initial layout; real viewport is applied in the effect below.
  const viewportWidthRef = useRef(INITIAL_VIEWPORT_WIDTH);
  const largeWidthRef = useRef(getLargeWidth(INITIAL_VIEWPORT_WIDTH));
  const scrollYRef = useRef(0);
  const rafIdRef = useRef(0);
  const lastTimeRef = useRef(0);

  const initialT = getScrollProgress(0);
  const initialWidth = lerp(largeWidthRef.current, SMALL_WIDTH, initialT);
  const initialTop = lerp(LARGE_TOP, SMALL_TOP, initialT);
  const initialLeft = getLogoLeft(
    initialWidth,
    INITIAL_VIEWPORT_WIDTH,
    initialT,
  );

  const ghostStateRef = useRef(
    GHOST_TAUS.map(() => ({
      width: initialWidth,
      top: initialTop,
      left: initialLeft,
    })),
  );

  const tick = useCallback((now: number) => {
    const dt =
      lastTimeRef.current === 0
        ? 0
        : Math.min((now - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = now;

    scrollYRef.current = window.scrollY;
    viewportWidthRef.current = window.innerWidth;
    largeWidthRef.current = getLargeWidth(viewportWidthRef.current);
    const t = getScrollProgress(scrollYRef.current);
    const targetWidth = lerp(largeWidthRef.current, SMALL_WIDTH, t);
    const targetTop = lerp(LARGE_TOP, SMALL_TOP, t);

    let active = false;
    for (let i = 0; i < GHOST_TAUS.length; i++) {
      const gs = ghostStateRef.current[i];
      const gsTargetLeft = getLogoLeft(
        gs.width,
        viewportWidthRef.current,
        t,
      );
      const alpha = reducedMotion.current
        ? 1
        : 1 - Math.exp(-dt / GHOST_TAUS[i]);
      gs.width += (targetWidth - gs.width) * alpha;
      gs.top += (targetTop - gs.top) * alpha;
      gs.left += (gsTargetLeft - gs.left) * alpha;
      if (
        Math.abs(targetWidth - gs.width) > SETTLE_EPSILON ||
        Math.abs(targetTop - gs.top) > SETTLE_EPSILON ||
        Math.abs(gsTargetLeft - gs.left) > SETTLE_EPSILON
      ) {
        active = true;
      }
    }

    setTick((n) => n + 1);

    if (active && !reducedMotion.current) {
      rafIdRef.current = requestAnimationFrame(tick);
    } else {
      for (const gs of ghostStateRef.current) {
        gs.width = targetWidth;
        gs.top = targetTop;
        gs.left = getLogoLeft(targetWidth, viewportWidthRef.current, t);
      }
      rafIdRef.current = 0;
      lastTimeRef.current = 0;
    }
  }, []);

  const ensureLoop = useCallback(() => {
    scrollYRef.current = window.scrollY;
    if (rafIdRef.current) return;
    lastTimeRef.current = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useLayoutEffect(() => {
    viewportWidthRef.current = window.innerWidth;
    largeWidthRef.current = getLargeWidth(viewportWidthRef.current);
    scrollYRef.current = window.scrollY;

    const t = getScrollProgress(scrollYRef.current);
    const width = lerp(largeWidthRef.current, SMALL_WIDTH, t);
    const top = lerp(LARGE_TOP, SMALL_TOP, t);
    const left = getLogoLeft(width, viewportWidthRef.current, t);
    for (const gs of ghostStateRef.current) {
      gs.width = width;
      gs.top = top;
      gs.left = left;
    }
    setTick((n) => n + 1);

    const onScroll = () => ensureLoop();
    const onResize = () => {
      viewportWidthRef.current = window.innerWidth;
      largeWidthRef.current = getLargeWidth(viewportWidthRef.current);
      ensureLoop();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    ensureLoop();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [ensureLoop]);

  const scrollHomeToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      void replaceCurrentUrl("/");
      window.scrollTo({ top: 0, behavior: motionScrollBehavior() });
    }
  };

  const t = getScrollProgress(scrollYRef.current);
  const mainWidth = lerp(largeWidthRef.current, SMALL_WIDTH, t);
  const mainTop = lerp(LARGE_TOP, SMALL_TOP, t);
  const mainLeft = getLogoLeft(mainWidth, viewportWidthRef.current, t);
  const isCollapsed = t >= 1;

  return (
    <div className="scroll-logo">
      {BRAND_COLORS.map((color, i) => {
        const gs = ghostStateRef.current[i];
        const deltaW = gs.width - mainWidth;
        const intensity = clamp01(Math.abs(deltaW) / OPACITY_FALLOFF_PX);
        const opacity = intensity * (0.55 - i * 0.075);
        return (
          <Wordmark
            key={i}
            aria-hidden
            width={gs.width}
            height={gs.width / SVG_RATIO}
            className="scroll-logo__ghost"
            style={{
              color,
              opacity,
              transform: `translate3d(${gs.left}px, ${gs.top}px, 0)`,
            }}
          />
        );
      })}
      {isCollapsed ? (
        <a
          href="/"
          aria-label="Loki home"
          className="scroll-logo__link"
          style={{
            width: `${mainWidth}px`,
            transform: `translate3d(${mainLeft}px, ${mainTop}px, 0)`,
          }}
          onClick={scrollHomeToTop}
        >
          <Wordmark
            aria-hidden
            width={mainWidth}
            height={mainWidth / SVG_RATIO}
            className="scroll-logo__inner-svg"
          />
        </a>
      ) : (
        <Wordmark
          aria-hidden
          width={mainWidth}
          height={mainWidth / SVG_RATIO}
          className="scroll-logo__main"
          style={{
            transform: `translate3d(${mainLeft}px, ${mainTop}px, 0)`,
          }}
        />
      )}
    </div>
  );
}
