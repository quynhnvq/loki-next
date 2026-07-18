"use client";

import { CodeSnippet } from "@/src/landing/components/CodeSnippet";
import { motionScrollBehavior } from "@/src/landing/utils/reduced-motion";

function scrollToContactSection(event: React.MouseEvent<HTMLAnchorElement>) {
  const contactSection = document.getElementById("contact");
  if (!contactSection) return;

  event.preventDefault();
  const targetY =
    contactSection.offsetHeight > window.innerHeight
      ? contactSection.offsetTop
      : Math.max(
          0,
          contactSection.offsetTop +
            contactSection.offsetHeight / 2 -
            window.innerHeight / 2,
        );
  window.scrollTo({ top: targetY, behavior: motionScrollBehavior() });
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}#contact`,
  );
}

export function LandingHero() {
  return (
    <section id="the-framework" className="landing-hero">
      <div className="landing-hero__text-group">
        <h1 className="landing-hero__heading">
          In Tech We Trust
          <br />
          Growing Brands with Technology
        </h1>
        <p className="landing-hero__body">
          We help businesses grow with technology, data, and creativity.
          <br />
          Just{" "}
          <a
            href="#contact"
            aria-label="Scroll to contact section"
            className="landing-hero__contact-link"
            onClick={scrollToContactSection}
          >
            <CodeSnippet>contact us</CodeSnippet>
          </a>
          , and you&apos;re off to the races
        </p>
      </div>
    </section>
  );
}
