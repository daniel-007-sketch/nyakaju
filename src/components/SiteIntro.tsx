"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./SiteIntro.module.css";

const INTRO_DURATION_MS = 2_000;

export function SiteIntro() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
      document.body.style.overflow = previousOverflow;
    }, INTRO_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div id="site-intro" className={styles.overlay} role="status" aria-label="Loading The Nyakaju">
      <Image
        className={styles.logo}
        src="/remote-images/AB6AXuBug833spFtV4UfdEQd.png"
        alt="The Nyakaju"
        width={512}
        height={116}
        priority
      />
    </div>
  );
}
