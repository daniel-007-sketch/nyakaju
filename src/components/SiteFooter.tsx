import Image from "next/image";
import styles from "./SiteFooter.module.css";

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="1" className={styles.iconFill} />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.filledIcon}>
      <path d="M14.5 3c.2 2 1.3 3.6 3 4.7v2.8a8 8 0 0 1-3.3-1.35v5.45a5.8 5.8 0 1 1-4.8-5.72v2.88a3 3 0 1 0 2 2.84V3h3.1Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.filledIcon}>
      <path d="M6.94 8.5a1.56 1.56 0 1 0 0-3.12 1.56 1.56 0 0 0 0 3.12ZM5.5 9.75h2.88V18H5.5V9.75Zm4.9 0h2.76v1.12h.04c.38-.72 1.32-1.48 2.72-1.48 2.9 0 3.44 1.91 3.44 4.39V18H16.9v-4.22c0-1.01-.02-2.31-1.41-2.31-1.41 0-1.63 1.1-1.63 2.24V18H10.4V9.75Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.imageSection}>
        <div className={styles.content}>
          <div className={styles.topRow}>
            <section className={styles.contact} aria-labelledby="footer-contact-heading">
              <p className={styles.eyebrow}>We are here to help</p>
              <h2 id="footer-contact-heading">Any Questions?</h2>
              <div className={styles.contactLinks}>
                <a href="tel:+256782173076">+256 782 173 076</a>
                <a href="mailto:info@nyakaju.com">info@nyakaju.com</a>
                <span>Tomosi Farm Rwakitura</span>
              </div>
            </section>

            <section className={styles.social} aria-labelledby="footer-social-heading">
              <p className={styles.eyebrow}>Follow the journey</p>
              <h2 id="footer-social-heading">Stay Connected</h2>
              <div className={styles.socialLinks}>
                <a href="#" aria-label="Instagram"><InstagramIcon /></a>
                <a href="#" aria-label="TikTok"><TikTokIcon /></a>
                <a href="#" aria-label="LinkedIn"><LinkedInIcon /></a>
              </div>
            </section>
          </div>

          <div className={styles.brandRow} aria-label="Nyakaju brands and location">
            <div className={`${styles.brand} ${styles.primaryBrand}`}>
              <Image
                src="/remote-images/AB6AXuCVKM6L1uOBsBdOrbb4.png"
                alt="The Nyakaju"
                width={251}
                height={58}
              />
            </div>
            <div className={styles.brand}>
              <span>Tomosi</span>
              <small>Farm</small>
            </div>
            <div className={styles.brand}>
              <span>Rwakitura</span>
              <small>Uganda</small>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.copyrightBar}>
        <p>© 2026 The Nyakaju. All rights reserved.</p>
      </div>
    </footer>
  );
}
