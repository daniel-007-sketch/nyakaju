import { LegacyPage } from "@/components/LegacyPage";
import { getLegacyPageMeta, type LegacyPageId } from "@/lib/legacy";
import { getLegacyPageChrome } from "@/lib/legacy.server";

type LegacyRouteProps = {
  pageId: LegacyPageId;
};

export function LegacyRoute({ pageId }: LegacyRouteProps) {
  const meta = getLegacyPageMeta(pageId);
  const chrome = getLegacyPageChrome(pageId);

  return (
    <LegacyPage
      pageId={pageId}
      bodyClassName={meta.bodyClassName}
      headStyleCss={chrome.headStyleCss}
      tailwindConfigJs={chrome.tailwindConfigJs}
      stylesheetHrefs={chrome.stylesheetHrefs}
      preHeaderMarkup={chrome.preHeaderMarkup}
      headerMarkup={chrome.headerMarkup}
      contentMarkup={chrome.contentMarkup}
      footerMarkup={chrome.footerMarkup}
      postFooterMarkup={chrome.postFooterMarkup}
    />
  );
}
