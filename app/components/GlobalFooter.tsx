import styles from "./global-footer.module.css";

export default function GlobalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <img
            className={styles.footerLogo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
          <span>THE MALL OF SAN JUAN · PREMIUM DIGITAL MEDIA</span>
        </div>

        <nav className={styles.footerNav} aria-label="Footer navigation">
          <a href="/#experience">Experience</a>
          <a href="/#canvas">The Canvas</a>
          <a href="/#rates">Rates</a>
        </nav>

        <div className={styles.footerMeta}>
          <a href="mailto:ventas@lagrandiosapr.com">ventas@lagrandiosapr.com</a>
          <span>Subject to availability</span>
        </div>
      </div>
    </footer>
  );
}
