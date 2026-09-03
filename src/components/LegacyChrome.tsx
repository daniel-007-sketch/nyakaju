import { SiteFooter } from "@/components/SiteFooter";

type LegacyChromeProps = {
  preHeaderMarkup: string;
  headerMarkup: string;
  footerMarkup: string;
  contentMarkup: string;
  postFooterMarkup: string;
};

export function LegacyChrome({ preHeaderMarkup, headerMarkup, footerMarkup, contentMarkup, postFooterMarkup }: LegacyChromeProps) {
  return (
    <>
      {preHeaderMarkup ? <div dangerouslySetInnerHTML={{ __html: preHeaderMarkup }} /> : null}
      {headerMarkup ? <div dangerouslySetInnerHTML={{ __html: headerMarkup }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: contentMarkup }} />
      {footerMarkup ? <SiteFooter /> : null}
      {postFooterMarkup ? <div dangerouslySetInnerHTML={{ __html: postFooterMarkup }} /> : null}
    </>
  );
}
