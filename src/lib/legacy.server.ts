import fs from "node:fs";
import path from "node:path";
import { getLegacyPageMeta, legacyLinkReplacements, replaceAllOccurrences, type LegacyPageId } from "@/lib/legacy";

const legacyJpegImagePrefixes = new Set([
  "AB6AXuB1mSUnHKODVdP20Try",
  "AB6AXuCE5vqtU4q47x76ze3w",
]);

const sharedInteriorNavPages = new Set<LegacyPageId>([
  "about",
  "gallery",
  "rooms",
  "contact-us",
  "complete-booking",
]);

const activeNavHrefByPage: Partial<Record<LegacyPageId, string>> = {
  about: "about.html",
  gallery: "gallery.html",
  rooms: "rooms.html",
  "contact-us": "contact us.html",
};

const activeNavClasses = ["border-b-2", "border-primary", "pb-1"];
const legacyActiveNavTextClasses = ["dark:text-primary-fixed"];

export function readLegacyPageSource(fileName: string) {
  const filePath = path.join(process.cwd(), "legacy", fileName);
  return fs.readFileSync(filePath, "utf8");
}

export function extractLegacyBodyMarkup(sourceHtml: string) {
  const bodyMatch = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch?.[1] ?? sourceHtml).trim();
}

export function extractLegacyChromeSections(sourceHtml: string) {
  const bodyMarkup = extractLegacyBodyMarkup(sourceHtml);
  const headerMatch = bodyMarkup.match(/<header[\s\S]*?<\/header>/i);
  const footerMatch = bodyMarkup.match(/<footer[\s\S]*?<\/footer>/i);

  if (!headerMatch || !footerMatch) {
    return {
      preHeaderMarkup: "",
      headerMarkup: "",
      contentMarkup: bodyMarkup.trim(),
      footerMarkup: "",
      postFooterMarkup: "",
    };
  }

  const headerStart = headerMatch.index!;
  const headerEnd = headerStart + headerMatch[0].length;
  const footerStart = footerMatch.index!;
  const footerEnd = footerStart + footerMatch[0].length;

  const preHeaderMarkup = bodyMarkup.slice(0, headerStart).trim();
  const contentMarkup = bodyMarkup
    .slice(headerEnd, footerStart)
    .trim();
  const postFooterMarkup = bodyMarkup.slice(footerEnd).trim();

  return {
    preHeaderMarkup,
    headerMarkup: headerMatch[0].trim(),
    contentMarkup,
    footerMarkup: footerMatch[0].trim(),
    postFooterMarkup,
  };
}

export function extractLegacyHeadStyleCss(sourceHtml: string) {
  const headMatch = sourceHtml.match(/<head[\s\S]*?<\/head>/i);
  const headMarkup = headMatch?.[0] ?? "";
  const styleMatches = Array.from(headMarkup.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));

  if (!styleMatches.length) {
    return "";
  }

  return styleMatches
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function extractLegacyTailwindConfig(sourceHtml: string) {
  const headMatch = sourceHtml.match(/<head[\s\S]*?<\/head>/i);
  const headMarkup = headMatch?.[0] ?? "";
  const scriptMatches = Array.from(headMarkup.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  const configScript = scriptMatches.find((match) => match[1]?.includes("tailwind.config"));

  return (configScript?.[1] ?? "").trim();
}

export function extractLegacyStylesheetHrefs(sourceHtml: string) {
  const headMatch = sourceHtml.match(/<head[\s\S]*?<\/head>/i);
  const headMarkup = headMatch?.[0] ?? "";
  const links = Array.from(headMarkup.matchAll(/<link\b[^>]*>/gi));

  return links
    .filter((match) => /\brel=["']stylesheet["']/i.test(match[0]))
    .map((match) => match[0].match(/\bhref=["']([^"']+)["']/i)?.[1] ?? "")
    .filter(Boolean)
    .filter((href, index, hrefs) => hrefs.indexOf(href) === index);
}

export function normalizeLegacyCss(css: string) {
  return css
    .replace(/url\("home_slides\//g, 'url("/home_slides/')
    .replace(/url\("room_images\//g, 'url("/room_images/')
    .replace(/url\("gallery\//g, 'url("/gallery/')
    .replace(/url\('home_slides\//g, "url('/home_slides/")
    .replace(/url\('room_images\//g, "url('/room_images/")
    .replace(/url\('gallery\//g, "url('/gallery/")
    .replace(/url\(home_slides\//g, "url(/home_slides/")
    .replace(/url\(room_images\//g, "url(/room_images/")
    .replace(/url\(gallery\//g, "url(/gallery/");
}

export function normalizeLegacyMarkup(markup: string) {
  let normalized = markup;

  for (const [search, replacement] of legacyLinkReplacements) {
    normalized = replaceAllOccurrences(normalized, search, replacement);
  }

  normalized = normalized
    .replace(/src="home_slides\//g, 'src="/home_slides/')
    .replace(/src="room_images\//g, 'src="/room_images/')
    .replace(/src="gallery\//g, 'src="/gallery/')
    .replace(/url\(&quot;home_slides\//g, 'url(&quot;/home_slides/')
    .replace(/url\(&quot;room_images\//g, 'url(&quot;/room_images/')
    .replace(/url\(&quot;gallery\//g, 'url(&quot;/gallery/')
    .replace(/url\("home_slides\//g, 'url("/home_slides/')
    .replace(/url\("room_images\//g, 'url("/room_images/')
    .replace(/url\("gallery\//g, 'url("/gallery/')
    .replace(
      /https:\/\/lh3\.googleusercontent\.com\/aida-public\/([A-Za-z0-9_-]{24})[A-Za-z0-9_-]*/g,
      (_url, prefix: string) => `/remote-images/${prefix}.${legacyJpegImagePrefixes.has(prefix) ? "jpg" : "png"}`,
    )
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  return normalized;
}

function getSharedInteriorHeader(pageId: LegacyPageId) {
  const roomsSourceHtml = readLegacyPageSource(getLegacyPageMeta("rooms").fileName);
  const roomsHeaderMarkup = extractLegacyChromeSections(roomsSourceHtml).headerMarkup;
  const activeHref = activeNavHrefByPage[pageId];

  const headerMarkup = roomsHeaderMarkup.replace(
    /(<nav\b[\s\S]*?<\/nav>)/gi,
    (navMarkup) =>
      navMarkup.replace(
        /(<a\s+href="([^"]+)"\s+class=")([^"]*)(")/gi,
        (_anchor, prefix: string, href: string, className: string, suffix: string) => {
          const classes = className
            .split(/\s+/)
            .filter(Boolean)
            .filter(
              (classToken) =>
                !activeNavClasses.includes(classToken) &&
                !legacyActiveNavTextClasses.includes(classToken),
            );

          if (href === activeHref) {
            classes.push(...activeNavClasses);
          }

          return `${prefix}${classes.join(" ")}${suffix}`;
        },
      ),
  );

  return normalizeLegacyMarkup(headerMarkup);
}

export function getLegacyPageMarkup(pageId: LegacyPageId) {
  const { fileName } = getLegacyPageMeta(pageId);
  const sourceHtml = readLegacyPageSource(fileName);
  return normalizeLegacyMarkup(extractLegacyBodyMarkup(sourceHtml));
}

export function getLegacyPageChrome(pageId: LegacyPageId) {
  const { fileName } = getLegacyPageMeta(pageId);
  const sourceHtml = readLegacyPageSource(fileName);
  const sections = extractLegacyChromeSections(sourceHtml);
  const headStyleCss = extractLegacyHeadStyleCss(sourceHtml);

  // The admin header and footer live inside its <main> shell. Rendering those
  // fragments separately makes the browser auto-close <main>, leaving an empty
  // full-height block above the dashboard and losing the sidebar offset.
  if (pageId === "admin-dashboard") {
    return {
      headStyleCss: normalizeLegacyCss(headStyleCss),
      tailwindConfigJs: extractLegacyTailwindConfig(sourceHtml),
      stylesheetHrefs: extractLegacyStylesheetHrefs(sourceHtml),
      preHeaderMarkup: "",
      headerMarkup: "",
      contentMarkup: normalizeLegacyMarkup(extractLegacyBodyMarkup(sourceHtml)),
      footerMarkup: "",
      postFooterMarkup: "",
    };
  }

  return {
    headStyleCss: normalizeLegacyCss(headStyleCss),
    tailwindConfigJs: extractLegacyTailwindConfig(sourceHtml),
    stylesheetHrefs: extractLegacyStylesheetHrefs(sourceHtml),
    preHeaderMarkup: normalizeLegacyMarkup(sections.preHeaderMarkup),
    headerMarkup: sharedInteriorNavPages.has(pageId)
      ? getSharedInteriorHeader(pageId)
      : normalizeLegacyMarkup(sections.headerMarkup),
    contentMarkup: normalizeLegacyMarkup(sections.contentMarkup),
    footerMarkup: normalizeLegacyMarkup(sections.footerMarkup),
    postFooterMarkup: normalizeLegacyMarkup(sections.postFooterMarkup),
  };
}
