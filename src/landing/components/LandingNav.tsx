"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isEditableKeyTarget } from "@/src/landing/keyboard";
import { clamp01 } from "@/src/landing/utils/math";

const SHOW_HEADER_NAV = false;

type LandingNavProps = {
  activeIndexRef: React.MutableRefObject<number>;
  totalSections: number;
  onJump: (index: number) => void;
  scrollYRef: React.MutableRefObject<number>;
  shouldBlockBlogShortcut: () => boolean;
};

export function LandingNav({
  activeIndexRef,
  totalSections,
  onJump,
  scrollYRef,
  shouldBlockBlogShortcut,
}: LandingNavProps) {
  const [, setTick] = useState(0);
  const onJumpRef = useRef(onJump);
  const activeIndexRefStable = useRef(activeIndexRef);
  const scrollYRefStable = useRef(scrollYRef);
  const shouldBlockBlogShortcutRef = useRef(shouldBlockBlogShortcut);
  const totalSectionsRef = useRef(totalSections);

  onJumpRef.current = onJump;
  activeIndexRefStable.current = activeIndexRef;
  scrollYRefStable.current = scrollYRef;
  shouldBlockBlogShortcutRef.current = shouldBlockBlogShortcut;
  totalSectionsRef.current = totalSections;

  const scheduleScrollUpdate = useCallback(() => {
    requestAnimationFrame(() => setTick((n) => n + 1));
  }, []);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableKeyTarget(e)) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(
          activeIndexRefStable.current.current + 1,
          totalSectionsRef.current - 1,
        );
        onJumpRef.current(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(activeIndexRefStable.current.current - 1, 0);
        onJumpRef.current(prev);
        return;
      }

      if (!SHOW_HEADER_NAV) return;
      void shouldBlockBlogShortcutRef.current;
    };

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("scroll", scheduleScrollUpdate);
    };
  }, [scheduleScrollUpdate]);

  const hintOpacity = clamp01(1 - scrollYRef.current / 80);

  return (
    <header className="landing-nav">
      <span
        className="landing-nav__hint"
        style={{ opacity: `${hintOpacity}` }}
      >
        scroll or press ↓ and ↑
      </span>
    </header>
  );
}
