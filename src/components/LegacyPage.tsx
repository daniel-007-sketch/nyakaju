"use client";

import { useEffect } from "react";
import type { LegacyPageId } from "@/lib/legacy";
import { setupLegacyEnhancements } from "@/lib/legacy-enhancements";
import { LegacyChrome } from "@/components/LegacyChrome";
import { SiteIntro } from "@/components/SiteIntro";

type LegacyPageProps = {
  pageId: LegacyPageId;
  bodyClassName: string;
  headStyleCss: string;
  tailwindConfigJs: string;
  stylesheetHrefs: string[];
  preHeaderMarkup: string;
  headerMarkup: string;
  contentMarkup: string;
  footerMarkup: string;
  postFooterMarkup: string;
};

export function LegacyPage({
  pageId,
  bodyClassName,
  headStyleCss,
  stylesheetHrefs,
  preHeaderMarkup,
  headerMarkup,
  contentMarkup,
  footerMarkup,
  postFooterMarkup,
}: LegacyPageProps) {
  useEffect(() => {
    const previousBodyClassName = document.body.className;
    document.body.className = bodyClassName;
    const cleanupEnhancements = setupLegacyEnhancements(pageId);

    return () => {
      cleanupEnhancements();
      document.body.className = previousBodyClassName;
    };
  }, [bodyClassName, pageId]);

  return (
    <>
      {pageId === "index" ? <SiteIntro /> : null}
      {stylesheetHrefs.map((href) => (
        <link href={href} key={href} rel="stylesheet" />
      ))}
      {headStyleCss ? <style dangerouslySetInnerHTML={{ __html: headStyleCss }} /> : null}
      <LegacyChrome
        preHeaderMarkup={preHeaderMarkup}
        headerMarkup={headerMarkup}
        contentMarkup={contentMarkup}
        footerMarkup={footerMarkup}
        postFooterMarkup={postFooterMarkup}
      />
    </>
  );
}
