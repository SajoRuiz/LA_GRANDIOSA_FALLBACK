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
    tier: "Entry",
    promise: "Frame the landmark",
    items: [
      ["Side Frame 15", "Left + Right · 15-sec still", "14,880 plays", "$3,037.50"],
      ["Side Frame 30", "Left + Right · 30-sec still", "7,440 plays", "$6,075"],
      ["Side Frame 60", "Left + Right · 60-sec still", "3,720 plays", "$12,150"],
    ],
  },
  {
    tier: "Mid-Tier",
    promise: "Command the center",
    items: [
      ["Center Impact", "Center · 30-sec still", "7,440 plays", "$13,500"],
      ["Center Motion", "Center · 30-sec silent video", "7,440 plays", "$18,900"],
    ],
  },
  {
    tier: "Flagship",
    promise: "Own the complete structure",
    items: [
      ["Landmark Takeover", "All 3 screens · 60-sec still", "3,720 plays", "$35,100"],
      ["Signature Takeover", "All 3 screens · 60-sec silent video", "3,720 plays", "$49,140"],
    ],
  },
];

const orderEmail =
  "mailto:ventas@lagrandiosapr.com?subject=La%20Grandiosa%20Place%20Order%20Request";

function RateTable({
  title,
  rates,
  accent = false,
}: {
  title: string;
  rates: string[][];
  accent?: boolean;
}) {
  return (
    <article className={`rate-card ${accent ? "rate-card-accent" : ""}`}>
      <div className="rate-title-row">
        <h3>{title}</h3>
        <span>Prime monthly rates</span>
      </div>

      <div className="rate-row rate-head" aria-hidden="true">
        <span>Screen package</span>
        <span>15 sec</span>
        <span>30 sec</span>
        <span>60 sec</span>
      </div>

      <div className="rate-list">
        {rates.map(([name, fifteen, thirty, sixty]) => (
          <div className="rate-row" key={name}>
            <strong className="rate-package">{name}</strong>
            <span className="rate-price">
              <small>15 sec</small>
              {fifteen}
            </span>
            <span className="rate-price">
              <small>30 sec</small>
              {thirty}
            </span>
            <span className="rate-price accent-price">
              <small>60 sec</small>
              {sixty}
            </span>
          </div>
        ))}
      </div>

      <p className="delivery">
        Estimated delivery: 14,880 plays at 15 seconds · 7,440 at 30 seconds ·
        3,720 at 60 seconds
      </p>
    </article>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="La Grandiosa home">
          <img
            className="brand-logo"
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#experience">Experience</a>
          <a href="#canvas">The Canvas</a>
          <a href="#packages">Packages</a>
          <a href="#rates">Rates</a>
          <a className="nav-cta" href={orderEmail}>
            Place Order
          </a>
        </nav>

        <details className="mobile-menu">
          <summary aria-label="Open navigation menu">
            <span />
            <span />
            <span />
          </summary>

          <nav aria-label="Mobile navigation">
            <a href="#experience">Experience</a>
            <a href="#canvas">The Canvas</a>
            <a href="#packages">Packages</a>
            <a href="#rates">Rates</a>
            <a className="nav-cta" href={orderEmail}>
              Place Order
            </a>
          </nav>
        </details>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow orange">The NEW Mall of San Juan Digital Ad Space is now available.</p>

          <h1>A Premier Digital Landmark</h1>

          <div className="orange-rule" />

          <p className="hero-lede">
            A one-of-a-kind three-screen digital canvas, designed to give premium brands commanding visibility in a
            premium environment.
          </p>

          <div className="hero-actions">
            <a className="button primary" href={orderEmail}>
              Place Order <span aria-hidden="true">→</span>
            </a>

            <a className="button ghost" href="#experience">
              Watch Video
            </a>
          </div>
        </div>
      </section>

      <section className="section experience-section" id="experience">
        <div className="section-heading">
          <p className="eyebrow">Experience La Grandiosa</p>
          <h2>See your brand come to life.</h2>
          <p>
            Explore the arrival experience and the scale of the environment
            through two cinematic views captured inside The Mall of San Juan.
          </p>
        </div>

        <div className="video-grid">
          <article className="video-card">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/la-grandiosa-experience-poster.jpg"
              aria-label="La Grandiosa arrival experience video"
            >
              <source src="/la-grandiosa-experience.mp4" type="video/mp4" />
              Your browser does not support embedded video.
            </video>
            <div className="video-caption">
              <span>01</span>
              <div>
                <h3>The Arrival Experience</h3>
                <p>A dynamic approach through the mall environment.</p>
              </div>
            </div>
          </article>

          <article className="video-card">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/la-grandiosa-tour-poster.jpg"
              aria-label="La Grandiosa arrival experience video"
            >
              <source src="/la-grandiosa-tour.mp4" type="video/mp4" />
              Your browser does not support embedded video.
            </video>
            <div className="video-caption">
              <span>02</span>
              <div>
                <h3>The Landmark in Motion</h3>
                <p>A closer look at visibility, movement, and scale.</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section canvas-section" id="canvas">
        <div className="section-heading">
          <p className="eyebrow">One landmark. Three synchronized faces.</p>
          <h2>Scale that turns presence into authority.</h2>
          <p>
            Choose the center for singular impact, pair both sides for framing,
            or activate all three faces for the most immersive expression.
          </p>
        </div>

        <div className="screen-diagram">
          <article className="side-screen">
            <span>Left</span>
            <strong>6&apos;8&quot; × 31&apos;2&quot;</strong>
          </article>

          <article className="center-screen">
            <span>Center</span>
            <strong>29&apos;6&quot; × 31&apos;2&quot;</strong>
            <p>
              The hero canvas for premium storytelling and landmark-scale brand
              presence.
            </p>
          </article>

          <article className="side-screen">
            <span>Right</span>
            <strong>6&apos;8&quot; × 31&apos;2&quot;</strong>
          </article>
        </div>

        <div className="metrics">
          <div>
            <strong>12 hours</strong>
            <span>Daily visibility</span>
          </div>
          <div>
            <strong>31 days</strong>
            <span>Monthly presence</span>
          </div>
          <div>
            <strong>80%</strong>
            <span>Commercial capacity</span>
          </div>
          <div>
            <strong className="orange">Prime</strong>
            <span>Premium daypart</span>
          </div>
        </div>
      </section>

      <section className="section rates-section" id="rates">
        <div className="section-heading narrow">
          <p className="eyebrow">High-value combinations</p>
          <h2>Premium formats designed to command attention.</h2>
        </div>

        <div className="rates-grid">
          <RateTable title="Still Image" rates={stillRates} />
          <RateTable title="Silent Video" rates={videoRates} accent />
        </div>

        <p className="fine-print">
          Silent video rates include the 40% format premium. Prime daypart
          pricing is included. Creative production is not included.
        </p>
      </section>

      <section className="section package-section" id="packages">
        <div className="section-heading">
          <p className="eyebrow">A clear path to ownership</p>
          <h2>Seven packages. Three levels of impact.</h2>
          <p>
            Move from a strong architectural frame to complete three-screen
            ownership.
          </p>
        </div>

        <div className="package-grid">
          {packages.map((pkg, index) => (
            <article
              className={`package-card ${index === 2 ? "featured" : ""}`}
              key={pkg.tier}
            >
              <p className="tier">{pkg.tier}</p>
              <h3>{pkg.promise}</h3>

              {pkg.items.map(([name, description, plays, price]) => (
                <div className="package-item" key={name}>
                  <h4>{name}</h4>
                  <p>{description}</p>
                  <div>
                    <span>{plays}</span>
                    <strong>{price}</strong>
                  </div>
                </div>
              ))}

              <a className="package-order" href={orderEmail}>
                Place Order
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="signature" id="order">
        <div className="signature-offer">
          <p className="eyebrow orange">Signature Prime Package</p>

          <h2>
            All 3 screens.
            <br />
            60-second silent video.
          </h2>

          <p className="signature-price">
            $49,140 <span>per 31-day month</span>
          </p>

          <p>3,720 estimated plays</p>
        </div>

        <div className="signature-copy">
          <p className="eyebrow">Place your order</p>

          <h3>
            Own the center. Frame the experience. Make the structure
            unmistakably yours.
          </h3>

          <p>
            Premium inventory is intentionally limited. Contact our sales team
            to place your order and confirm campaign availability.
          </p>

          <a className="button primary" href={orderEmail}>
            Place Order <span aria-hidden="true">→</span>
          </a>

          <a className="sales-email" href="mailto:ventas@lagrandiosapr.com">
            ventas@lagrandiosapr.com
          </a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <img
            className="footer-logo"
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
          <span>The Mall of San Juan · Premium digital media</span>
        </div>

        <div className="footer-links">
          <a href="#experience">Experience</a>
          <a href="#canvas">The Canvas</a>
          <a href="#packages">Packages</a>
          <a href="#rates">Rates</a>
        </div>

        <div className="footer-contact">
          <a href="mailto:ventas@lagrandiosapr.com">
            ventas@lagrandiosapr.com
          </a>
          <span>Subject to availability</span>
        </div>
      </footer>
    </main>
  );
}
