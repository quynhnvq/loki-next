import { Wordmark } from "@/src/landing/components/Wordmark";

const COMPANY_NAME = "LOKI TECHNOLOGY AND MEDIA COMPANY LIMITED";
const ADDRESS =
  "208 Mai Thuc Loan Street, Cua Lo Ward, Nghe An Province, Vietnam";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__content">
        <Wordmark
          role="img"
          aria-label="Loki"
          height={36}
          className="landing-footer__wordmark"
        />
        <p className="landing-footer__company-name">{COMPANY_NAME}</p>
        <p className="landing-footer__address">{ADDRESS}</p>
      </div>
    </footer>
  );
}
