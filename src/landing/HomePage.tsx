"use client";

import { LandingContent } from "@/src/landing/LandingContent";
import { LandingEnhancements } from "@/src/landing/LandingEnhancements";
import { LoadingScreen } from "@/src/landing/components/LoadingScreen";

export function HomePage() {
  return (
    <div id="loki-landing-app" className="loki-landing-app">
      <div>
        <LandingEnhancements />
      </div>
      <main id="main-content" tabIndex={-1} className="loki-landing-content">
        <LandingContent />
      </main>
      <LoadingScreen />
    </div>
  );
}
