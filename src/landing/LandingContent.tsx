import { FeatureSection } from "@/src/landing/components/FeatureSection";
import { LandingFooter } from "@/src/landing/components/LandingFooter";
import { LandingHero } from "@/src/landing/components/LandingHero";

const storySections = [
  {
    id: "full-stack",
    kicker: "Technology and Marketing, Unified",
    title: "A competitive edge across every dimension",
    body: "Our connected capabilities give brands a measurable advantage in the modern world of marketing and sales.",
    align: "left" as const,
  },
  {
    id: "ai-ready",
    kicker: "AI-POWERED MARKETING",
    title: "Smarter Marketing. Faster Growth.",
    body: "Loki combines AI, data, and marketing expertise to uncover opportunities, optimize campaigns, and help brands achieve measurable growth with greater speed and precision.",
    align: "left" as const,
  },
  {
    id: "powerful-components",
    kicker: "WORLD-CLASS ENGINEERING",
    title: "Powerful Digital Solutions Built for Brand Growth",
    body: "Our engineering team builds high-performance websites, mobile apps, and custom digital solutions that help brands grow, streamline operations, and deliver exceptional customer experiences.",
    align: "left" as const,
    codeSnippet: `import { type Handle, on } from 'loki/ui'
import button from 'loki/ui/button'

type LokiRealizeDreamInput = {
  idea: string
  technology: string
  ai: boolean
}

async function growLokiBrand(input: LokiRealizeDreamInput) {
  // Loki hiện thực hóa ý tưởng thành sản phẩm và tăng trưởng thương hiệu
  return launchWithLokiStack(input)
}

function LokiRealizeDreamButton(handle: Handle<LokiRealizeDreamInput>) {
  let phase: "idle" | "realizing" | "growing" = "idle";

  return () => {
    let label =
      phase === "idle"
        ? "Hiện thực giấc mơ cùng Loki"
        : phase === "realizing"
          ? "Loki đang hiện thực hóa..."
          : "Thương hiệu đang tăng trưởng";

    return (
      <button
        aria-label={label}
        aria-live="polite"
        mix={[
          ...button({ tone: "neutral" }),
          on("click", async (_, signal) => {
            phase = "realizing";
            handle.update();

            await growLokiBrand({
              idea: handle.props.idea,
              technology: handle.props.technology,
              ai: handle.props.ai,
            });
            if (signal.aborted) return;

            phase = "growing";
            handle.update();
          }),
        ]}
      >
        <span aria-hidden="true">
          {phase === "growing" ? "✓" : "✦"}
        </span>
      </button>
    );
  };
}`,
  },
  {
    id: "use-cases",
    kicker: "Technology & Marketing for Every Stage",
    title: "A store launched overnight.\nA brand built for growth.",
    body: "Marketing or technology—Loki meets your project at every stage. Start something new, grow it into a successful brand, or build on what already exists. From strategy and development to growth and optimization, Loki is with you every step of the way.",
    align: "right" as const,
  },
  {
    id: "contact",
    kicker: "Get in touch",
    title: "Let's grow your brand together",
    body: "Reach out to the Loki team—we're ready to help with technology, marketing, and everything in between.",
    align: "left" as const,
    contact: {
      email: "lokidt.com@gmail.com",
      phone: "+84 91 216 3733",
      whatsapp: "+84 91 216 3733",
    },
  },
];

export function LandingContent() {
  return (
    <>
      <LandingHero />
      {storySections.map((section) => (
        <FeatureSection
          key={section.id}
          id={section.id}
          kicker={section.kicker}
          title={section.title}
          body={section.body}
          align={section.align}
          codeSnippet={
            "codeSnippet" in section ? section.codeSnippet : undefined
          }
          contact={"contact" in section ? section.contact : undefined}
        />
      ))}
      <LandingFooter />
    </>
  );
}
