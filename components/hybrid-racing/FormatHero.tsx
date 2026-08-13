import type { CSSProperties } from "react";
import Link from "next/link";

type FormatHeroProps = {
  eyebrow: string;
  title: string;
  dek: string;
  photoSrc: string;
  photoAlt: string;
  ctaHref: string;
  ctaLabel: string;
};

export function FormatHero({
  eyebrow,
  title,
  dek,
  photoSrc,
  photoAlt,
  ctaHref,
  ctaLabel,
}: FormatHeroProps) {
  const photoStyle = {
    "--format-hero-photo": `url(${photoSrc})`,
  } as CSSProperties;

  return (
    <section className="format-hero">
      <div className="format-hero__text">
        <p className="format-hero__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="format-hero__dek">{dek}</p>
        <Link className="btn btn--primary btn--lg" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>
      <div
        className="format-hero__photo"
        role="img"
        aria-label={photoAlt}
        style={photoStyle}
      />
    </section>
  );
}
