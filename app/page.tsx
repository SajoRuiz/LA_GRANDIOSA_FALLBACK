import Link from "next/link";
import styles from "./page.module.css";
import { withNext } from "@/lib/auth/paths";

const videoHighlights = [
  {
    index: "01",
    title: "The Arrival Experience",
    description: "A cinematic view of the landmark approach and the energy of the space.",
    poster: "/la-grandiosa-experience-poster.jpg",
    src: "/la-grandiosa-experience.mp4",
  },
  {
    index: "02",
    title: "The Landmark in Motion",
    description: "A closer look at visibility, movement, and the scale of the screen wall.",
    poster: "/la-grandiosa-tour-poster.jpg",
    src: "/la-grandiosa-tour.mp4",
  },
];

const heroPackages = [
  {
    name: "Side Frame",
    size: "Left + Right",
    rate: "$3,037.50",
    plays: "14,880 plays at 15 sec",
  },
  {
    name: "Center Impact",
    size: "Center",
    rate: "$13,500",
    plays: "7,440 plays at 30 sec",
  },
  {
    name: "Signature Takeover",
    size: "All 3 screens",
    rate: "$49,140",
    plays: "3,720 plays at 60 sec",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="La Grandiosa home">
          <img className={styles.logo} src="/la-grandiosa-logo.png" alt="La Grandiosa" />
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>La Grandiosa · Mall of San Juan</p>
          <h1>Premium mall media with private-portal power behind it.</h1>
          <p className={styles.lead}>
            The front page now loads as a public brand experience first, then reveals the
            agency controls below. Videos, hero packages, and the private portal all live
            in the same visual system.
          </p>

          <div className={styles.actions}>
            <Link className={styles.primaryButton} href={withNext("/auth/login", "/portal") }>
              PLACE ORDER
            </Link>
            <Link className={styles.secondaryButton} href="#packages">
              View hero packages
            </Link>
          </div>
        </div>

        <aside className={styles.heroPanel} aria-label="Private portal brand preview">
          <p className={styles.panelEyebrow}>Private portal preview</p>
          <h2>Invite-only access. Agency pricing. Credit controls.</h2>
          <p>
            Selecting PLACE ORDER opens the protected La Grandiosa Private Portal. Login and
            portal links appear after the public videos and hero packages.
          </p>
          <ul className={styles.featureList}>
            <li>Secure login and TOTP MFA</li>
            <li>Purchase-order and invoice flow</li>
            <li>Asset submission tracking</li>
          </ul>
        </aside>
      </section>

      <section className={styles.sectionBlock} id="videos">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Front page video previews</p>
          <h2>See the environment before you enter the portal.</h2>
        </div>

        <div className={styles.videoGrid}>
          {videoHighlights.map((video) => (
            <article className={styles.videoCard} key={video.index}>
              <video
                controls
                playsInline
                preload="metadata"
                poster={video.poster}
                aria-label={video.title}
              >
                <source src={video.src} type="video/mp4" />
                Your browser does not support embedded video.
              </video>
              <div className={styles.videoCaption}>
                <span>{video.index}</span>
                <div>
                  <h3>{video.title}</h3>
                  <p>{video.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionBlock} id="packages">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Hero packages</p>
          <h2>Public rate-card highlights for premium placements.</h2>
        </div>

        <div className={styles.packageGrid}>
          {heroPackages.map((pkg) => (
            <article className={styles.packageCard} key={pkg.name}>
              <p className={styles.packageLabel}>{pkg.size}</p>
              <h3>{pkg.name}</h3>
              <strong>{pkg.rate}</strong>
              <span>{pkg.plays}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h2>How it works</h2>
            <p className={styles.flow}>PLACE ORDER → Sign in → /portal</p>
            <p>
              Selecting PLACE ORDER opens agency sign-in first, while the public page stays
              visible until the visitor chooses to enter.
            </p>
          </article>

          <article className={styles.card}>
            <h2>Private portal theme</h2>
            <p>
              Deep navy panels, electric blue accents, orange action buttons, and the La
              Grandiosa hero image unify the experience with the internal portal.
            </p>
          </article>

          <article className={styles.card}>
            <h2>Start now</h2>
            <p>
              If your agency already has credentials, continue to the private sign-in.
            </p>
            <Link className={styles.inlineButton} href={withNext("/auth/login", "/portal") }>
              PLACE ORDER
            </Link>
          </article>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>La Grandiosa · The Mall of San Juan</span>
        <Link href="mailto:ventas@lagrandiosapr.com">ventas@lagrandiosapr.com</Link>
      </footer>
    </main>
  );
}
