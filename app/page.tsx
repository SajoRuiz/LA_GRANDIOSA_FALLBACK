import Link from "next/link";
import styles from "./page.module.css";
import { withNext } from "@/lib/auth/paths";

const stillRates = [
  ["Center", "$6,750", "$13,500", "$27,000"],
  ["Left + Right", "$3,037.50", "$6,075", "$12,150"],
  ["All 3 Screens", "$8,775", "$17,550", "$35,100"],
];

const videoRates = [
  ["Center", "$9,450", "$18,900", "$37,800"],
  ["Left + Right", "$4,252.50", "$8,505", "$17,010"],
  ["All 3 Screens", "$12,285", "$24,570", "$49,140"],
];

const packages = [
  {
    tier: "Entry Monthly Package",
    promise: "Frame the landmark",
    items: [
      ["Side Frame 15", "Left + Right · 15-sec still", "14,880 plays", "$3,037.50"],
      ["Side Frame 30", "Left + Right · 30-sec still", "7,440 plays", "$6,075"],
      ["Side Frame 60", "Left + Right · 60-sec still", "3,720 plays", "$12,150"],
    ],
  },
  {
    tier: "Mid-Tier Monthly Package",
    promise: "Command the center",
    items: [
      ["Center Impact", "Center · 30-sec still", "7,440 plays", "$13,500"],
      ["Center Motion", "Center · 30-sec silent video", "7,440 plays", "$18,900"],
    ],
  },
  {
    tier: "Flagship Monthly Package",
    promise: "Own the complete structure",
    items: [
      ["Landmark Takeover", "All 3 screens · 60-sec still", "3,720 plays", "$35,100"],
      ["Signature Takeover", "All 3 screens · 60-sec silent video", "3,720 plays", "$49,140"],
    ],
  },
];

function RateTable({ title, rates, accent = false }: { title: string; rates: string[][]; accent?: boolean }) {
  return (
    <div className={`${styles.rateCard} ${accent ? styles.rateCardAccent : ""}`}>
      <div className={styles.rateTitleRow}>
        <h3>{title} · Monthly</h3>
        <span>Prime monthly rates</span>
      </div>
      <div className={`${styles.rateRow} ${styles.rateHead}`}>
        <span>Screen package</span>
        <span>15 sec</span>
        <span>30 sec</span>
        <span>60 sec</span>
      </div>
      {rates.map(([name, fifteen, thirty, sixty]) => (
        <div className={styles.rateRow} key={name}>
          <strong>{name}</strong>
          <span>{fifteen}</span>
          <span>{thirty}</span>
          <span className={styles.accentPrice}>{sixty}</span>
        </div>
      ))}
      <p className={styles.delivery}>Estimated delivery: 14,880 plays at 15 seconds · 7,440 at 30 seconds · 3,720 at 60 seconds</p>
    </div>
  );
}

export default function HomePage() {
  const orderPath = withNext("/auth/login", "/portal");

  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <a className={styles.brand} href="#top" aria-label="La Grandiosa home">
          <img className={styles.brandMark} src="/la-grandiosa-logo.png" alt="La Grandiosa" />
        </a>
        <nav className={styles.mainNav} aria-label="Main navigation">
          <a href="#experience">Experience</a>
          <a href="#canvas">The Canvas</a>
          <a href="#packages">Packages</a>
          <a href="#rates">Rates</a>
          <Link className={styles.navCta} href={orderPath}>
            PLACE ORDER
          </Link>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>THE NEW MALL OF SAN JUAN DIGITAL AD SPACE IS NOW AVAILABLE.</p>
          <h1>THE ONLY PREMIER DIGITAL LANDMARK IN PUERTO RICO</h1>
          <div className={styles.orangeRule} />
          <p className={styles.heroLede}>
            A one-of-a-kind three-screen digital canvas, designed to give premium brands commanding visibility in a premium environment.
          </p>
          <div className={styles.heroActions}>
            <Link className={`${styles.button} ${styles.primary}`} href={orderPath}>
              PLACE ORDER
            </Link>
            <Link className={`${styles.button} ${styles.secondary}`} href="#experience">
              WATCH VIDEO
            </Link>
          </div>
        </div>
        <div className={styles.heroImage} role="img" aria-label="La Grandiosa digital screen inside The Mall of San Juan" />
      </section>

      <section className={`${styles.section} ${styles.experienceSection}`} id="experience">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>EXPERIENCE LA GRANDIOSA</p>
          <h2>See your brand come to life.</h2>
          <p>Explore the arrival experience and the scale of the environment through two cinematic views captured inside The Mall of San Juan.</p>
        </div>
        <div className={styles.videoGrid}>
          <article className={styles.videoCard}>
            <video controls playsInline preload="metadata" poster="/la-grandiosa-tour-poster.jpg" aria-label="La Grandiosa arrival experience video">
              <source src="/la-grandiosa-tour.mp4" type="video/mp4" />
              Your browser does not support embedded video.
            </video>
            <div className={styles.videoCaption}>
              <span>01</span>
              <div>
                <h3>The Arrival Experience</h3>
                <p>A dynamic approach through the mall environment.</p>
              </div>
            </div>
          </article>
          <article className={styles.videoCard}>
            <video controls playsInline preload="metadata" poster="/la-grandiosa-experience-poster.jpg" aria-label="La Grandiosa location tour video">
              <source src="/la-grandiosa-experience.mp4" type="video/mp4" />
              Your browser does not support embedded video.
            </video>
            <div className={styles.videoCaption}>
              <span>02</span>
              <div>
                <h3>The Landmark in Motion</h3>
                <p>A closer look at visibility, movement, and scale.</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.canvasSection}`} id="canvas">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>ONE LANDMARK. THREE SYNCHRONIZED FACES.</p>
          <h2>Scale that turns presence into authority.</h2>
          <p>Choose the center for singular impact, pair both sides for framing, or activate all three faces for the most immersive expression.</p>
        </div>
        <div className={styles.screenDiagram}>
          <article className={styles.sideScreen}>
            <span>Left</span>
            <strong>6&apos;8&quot;w × 31&apos;2&quot;h</strong>
          </article>
          <article className={styles.centerScreen}>
            <span>Center</span>
            <strong>29&apos;6&quot;w × 31&apos;2&quot;h</strong>
            <p>The hero canvas for premium storytelling and landmark-scale brand presence.</p>
          </article>
          <article className={styles.sideScreen}>
            <span>Right</span>
            <strong>6&apos;8&quot;w × 31&apos;2&quot;h</strong>
          </article>
        </div>
        <div className={styles.metrics}>
          <div><strong>12 HOURS</strong><span>Daily visibility</span></div>
          <div><strong>31 DAYS</strong><span>Monthly presence</span></div>
          <div><strong>80%</strong><span>Commercial capacity</span></div>
          <div><strong className={styles.orange}>PRIME</strong><span>Premium daypart</span></div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.ratesSection}`} id="rates">
        <div className={`${styles.sectionHeading} ${styles.narrow}`}>
          <p className={styles.eyebrow}>HIGH-VALUE COMBINATIONS</p>
          <h2>Premium formats designed to command attention.</h2>
        </div>
        <div className={styles.ratesGrid}>
          <RateTable title="Still Image" rates={stillRates} />
          <RateTable title="Silent Video" rates={videoRates} accent />
        </div>
        <p className={styles.finePrint}>Silent video rates include the 40% format premium. Prime daypart pricing is included. Creative production is not included.</p>
      </section>

      <section className={`${styles.section} ${styles.packageSection}`} id="packages">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>A CLEAR PATH TO OWNERSHIP</p>
          <h2>Seven packages. Three levels of impact.</h2>
          <p>Move from a strong architectural frame to complete three-screen ownership.</p>
        </div>
        <div className={styles.packageGrid}>
          {packages.map((pkg, index) => (
            <article className={`${styles.packageCard} ${index === 2 ? styles.featured : ""}`} key={pkg.tier}>
              <p className={styles.tier}>{pkg.tier}</p>
              <h3>{pkg.promise}</h3>
              {pkg.items.map(([name, description, plays, price]) => (
                <div className={styles.packageItem} key={name}>
                  <h4>{name}</h4>
                  <p>{description}</p>
                  <div>
                    <span>{plays}</span>
                    <strong>{price}</strong>
                  </div>
                </div>
              ))}
              <Link className={`${styles.button} ${styles.primary} ${styles.packageButton}`} href={orderPath}>
                PLACE ORDER
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.signature} id="availability">
        <div className={styles.signaturePanel}>
          <p className={`${styles.eyebrow} ${styles.orange}`}>SIGNATURE PRIME PACKAGE</p>
          <h2>All 3 screens.<br />60-second silent video.</h2>
          <p className={styles.signaturePrice}>$49,140 <span>PER 31-DAY MONTH</span></p>
          <p>3,720 estimated plays</p>
        </div>
        <div className={styles.signatureCopy}>
          <p className={styles.eyebrow}>PLACE YOUR ORDER</p>
          <h3>Own the center. Frame the experience. Make the structure unmistakably yours.</h3>
          <p>Premium inventory is intentionally limited. Contact our sales team to place your order and confirm campaign availability.</p>
          <Link className={`${styles.button} ${styles.primary}`} href={orderPath}>
            PLACE ORDER
          </Link>
          <Link className={styles.requestAccess} href="mailto:ventas@lagrandiosapr.com?subject=Request%20Access%20-%20La%20Grandiosa">
            Request Access
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <strong>LA GRANDIOSA</strong>
        <span>The Mall of San Juan · Premium digital media · Subject to availability</span>
      </footer>
    </main>
  );
}