import {
  RUNNER_AVIF_SRC,
  RUNNER_GIF_SRC,
  RUNNER_STATIC_SRC,
  RUNNER_WEBP_SRC,
} from "@/src/landing/runner-media";

export function LoadingScreen() {
  return (
    <div className="loading-screen-overlay">
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={RUNNER_STATIC_SRC}
          type="image/png"
        />
        <source srcSet={RUNNER_AVIF_SRC} type="image/avif" />
        <source srcSet={RUNNER_WEBP_SRC} type="image/webp" />
        <img
          src={RUNNER_GIF_SRC}
          alt="Loading Loki homepage"
          width={384}
          height={384}
          loading="eager"
          fetchPriority="high"
          className="loading-screen__runner"
        />
      </picture>
    </div>
  );
}
