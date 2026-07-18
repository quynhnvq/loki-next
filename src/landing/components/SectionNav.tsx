"use client";

import { useCallback, useEffect, useState } from "react";
import { clamp } from "@/src/landing/utils/math";

const TRACK_WIDTH = 11;
const ITEM_HEIGHT = 16;
const ITEM_GAP = 8;
const VIEWPORT_GUTTER = 24;

const SECTIONS = [
  { label: "In Tech We Trust", anchor: "the-framework" },
  { label: "Tech & Marketing", anchor: "full-stack" },
  { label: "AI Marketing", anchor: "ai-ready" },
  { label: "Engineering", anchor: "powerful-components" },
  { label: "Every Stage", anchor: "use-cases" },
  { label: "Contact", anchor: "contact" },
];

type NavigateEventWithManualScroll = NavigateEvent & {
  intercept(options: {
    handler: () => Promise<void>;
    scroll?: "manual" | "after-transition";
  }): void;
};

async function replaceHash(anchor: string) {
  const navigation = window.navigation;
  const url = new URL(window.location.href);
  url.hash = anchor;

  if (!navigation) {
    window.history.replaceState(window.history.state, "", url);
    return;
  }

  const state = navigation.currentEntry?.getState();

  const preventNativeHashScroll = (event: NavigateEvent) => {
    if (!event.canIntercept || event.destination.url !== url.href) return;
    (event as NavigateEventWithManualScroll).intercept({
      scroll: "manual",
      async handler() {},
    });
  };

  navigation.addEventListener("navigate", preventNativeHashScroll, {
    capture: true,
    once: true,
  });

  const transition = navigation.navigate(url.href, {
    history: "replace",
  });

  try {
    await transition.committed;
    navigation.updateCurrentEntry({ state });
  } finally {
    navigation.removeEventListener("navigate", preventNativeHashScroll, {
      capture: true,
    });
  }
}

type SectionNavProps = {
  activeIndexRef: React.MutableRefObject<number>;
  morphValueRef: React.MutableRefObject<number>;
  onJump: (index: number) => void;
};

export function SectionNav({
  activeIndexRef,
  morphValueRef,
  onJump,
}: SectionNavProps) {
  const [, setTick] = useState(0);

  const scheduleScrollUpdate = useCallback(() => {
    requestAnimationFrame(() => setTick((n) => n + 1));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    return () => window.removeEventListener("scroll", scheduleScrollUpdate);
  }, [scheduleScrollUpdate]);

  const count = SECTIONS.length;
  const maxMorph = count - 1;
  const step = ITEM_HEIGHT + ITEM_GAP;
  const trackHeight = (count - 1) * step + ITEM_HEIGHT;
  const morph = clamp(morphValueRef.current, 0, maxMorph);
  const activeIndex = clamp(activeIndexRef.current, 0, maxMorph);
  const dotCenterY = (index: number) => index * step + ITEM_HEIGHT / 2;
  const scrollFillPx =
    maxMorph > 0
      ? ITEM_HEIGHT / 2 + (morph / maxMorph) * (trackHeight - ITEM_HEIGHT / 2)
      : trackHeight;
  const fillPx = Math.max(TRACK_WIDTH, scrollFillPx, dotCenterY(activeIndex));

  return (
    <aside
      className="section-nav"
      style={{
        bottom: `${VIEWPORT_GUTTER}px`,
        left: `${VIEWPORT_GUTTER}px`,
      }}
    >
      <div className="section-nav__layout">
        <div
          className="section-nav__track-container"
          style={{ width: `${TRACK_WIDTH}px` }}
        >
          <div className="section-nav__track-bg" />
          <div
            className="section-nav__track-fill"
            style={{
              width: `${TRACK_WIDTH}px`,
              height: `${fillPx}px`,
            }}
          />
        </div>
        <ul
          className="section-nav__list"
          style={{ gap: `${ITEM_GAP}px` }}
        >
          {SECTIONS.map((section, i) => {
            const bulletCenter = i * step + ITEM_HEIGHT / 2;
            const covered = fillPx >= bulletCenter;
            const isActive = i === activeIndex;
            return (
              <li
                key={section.anchor}
                className="section-nav__item"
                style={{
                  paddingLeft: `${TRACK_WIDTH + 16}px`,
                  minHeight: `${ITEM_HEIGHT}px`,
                }}
              >
                <div
                  className={
                    covered
                      ? "section-nav__bullet section-nav__bullet--hidden"
                      : "section-nav__bullet"
                  }
                  style={{
                    left: `${(TRACK_WIDTH - 4) / 2}px`,
                    top: `${bulletCenter - 2}px`,
                  }}
                />
                <a
                  href={`#${section.anchor}`}
                  className={
                    isActive
                      ? "section-nav__link section-nav__link--active"
                      : "section-nav__link"
                  }
                  style={{
                    lineHeight: `${ITEM_HEIGHT}px`,
                    height: `${ITEM_HEIGHT}px`,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    void replaceHash(section.anchor).then(
                      () => onJump(i),
                      () => onJump(i),
                    );
                  }}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
