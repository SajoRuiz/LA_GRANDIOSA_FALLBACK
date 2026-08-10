import Link from "next/link";
import styles from "./page.module.css";
import { withNext } from "@/lib/auth/paths";

const stillRates = [
  ["Center", "$4,050", "$6,075", "$12,150", "$24,300"],
  ["Left + Right", "$1,822.50", "$2,733.75", "$5,467.50", "$10,935"],
  ["All 3 Screens", "$5,265", "$7,897.50", "$15,795", "$31,590"],
];

const videoRates = [
  ["Center", "$5,670", "$8,505", "$17,010", "$34,020"],
  ["Left + Right", "$2,551.50", "$3,827.25", "$7,654.50", "$15,309"],
  ["All 3 Screens", "$7,371", "$11,056.50", "$22,113", "$44,226"],
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
        <span>10 sec</span>
        <span>15 sec</span>
        <span>30 sec</span>
        <span>60 sec</span>
      </div>
      {rates.map(([name, ten, fifteen, thirty, sixty]) => (
        <div className={styles.rateRow} key={name}>
          <strong>{name}</strong>
          <span>{ten}</span>
          <span>{fifteen}</span>
          <span>{thirty}</span>
          <span className={styles.accentPrice}>{sixty}</span>
        </div>
      ))}
      <p className={styles.delivery}>
        Estimated delivery:
        <br />
        22,320 plays at 10 seconds
        <br />
        14,880 plays at 15 seconds
        <br />
        7,440 plays at 30 seconds
        <br />
        3,720 plays at 60 seconds
      </p>
    </div>
  );
}

export default function HomePage() {
  const orderPath = "/order";
  const signInPath = withNext("/auth/login", "/portal");

  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <a className={styles.brand} href="#top" aria-label="La Grandiosa home">
          <img className={styles.brandMark} src="/la-grandiosa-logo.png" alt="La Grandiosa" />
        </a>
        <nav className={styles.mainNav} aria-label="Main navigation">
          <a href="#experience">Experience</a>
          <a href="#canvas">The Canvas</a>
          <a href="#rates">Rates</a>
          <Link className={styles.navCta} href={orderPath}>
            PLACE ORDER
          </Link>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>THE NEW MALL OF SAN JUAN DIGITAL AD SPACE IS NOW AVAILABLE.</p>
          <h1>
            THE ONLY<br />
            PREMIER<br />
            DIGITAL<br />
            LANDMARK<br />
            <span className={styles.heroLocation}>IN PUERTO RICO</span>
          </h1>
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
        <div className={`${styles.sectionHeading} ${styles.ratesHeading} ${styles.narrow}`}>
          <p className={`${styles.eyebrow} ${styles.ratesEyebrow}`}>HIGH-VALUE COMBINATIONS</p>
          <h2 className={styles.ratesTitle}>Premium formats designed to command attention.</h2>
        </div>
        <div className={styles.ratesGrid}>
          <RateTable title="Still Image" rates={stillRates} />
          <RateTable title="Silent Video" rates={videoRates} accent />
        </div>
        <p className={`${styles.finePrint} ${styles.ratesDisclaimer}`}>These prices have a 10% discount for continuous runtime of 30-31 days. Creative production is not included.</p>
      </section>

      <section className={styles.signature} id="availability">
        <div className={styles.signatureOffer}>
          <div className={styles.signaturePanel}>
            <p className={`${styles.eyebrow} ${styles.orange}`}>SIGNATURE PRIME PACKAGE</p>
            <h2>All 3 screens.<br />60-second silent video.</h2>
            <p className={styles.signaturePrice}>$44,226 <span>PER 31-DAY MONTH</span></p>
            <p className={styles.signatureEstimatedPlays}>3,720 estimated plays</p>
          </div>
          <p className={styles.signatureDisclaimer}>These prices have a 10% discount for continuous runtime of 30-31 days. Creative production is not included.</p>
        </div>
        <div className={styles.signatureCopy}>
          <p className={styles.eyebrow}>PLACE YOUR ORDER</p>
          <h3>
            Own the center.<br />
            Frame the experience.<br />
            Make the structure<br />
            unmistakably yours.
          </h3>
          <p>Premium inventory is intentionally limited. Contact our sales team to place your order and confirm campaign availability.</p>
          <div className={styles.signatureActions}>
            <Link className={`${styles.button} ${styles.primary}`} href={signInPath}>
              SIGN IN
            </Link>
            <Link className={`${styles.button} ${styles.secondary}`} href="/auth/signup">
              SIGN UP
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}