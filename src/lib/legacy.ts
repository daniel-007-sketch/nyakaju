export type LegacyPageId =
  | "index"
  | "about"
  | "gallery"
  | "rooms"
  | "contact-us"
  | "complete-booking"
  | "admin-login"
  | "admin-dashboard";

export type LegacyPageMeta = {
  id: LegacyPageId;
  fileName: string;
  title: string;
  bodyClassName: string;
};

const legacyPages: Record<LegacyPageId, LegacyPageMeta> = {
  index: {
    id: "index",
    fileName: "index.html",
    title: "NYAKAJU | HOME",
    bodyClassName: "bg-background text-on-background font-body-md selection:bg-primary-container selection:text-on-primary-container",
  },
  about: {
    id: "about",
    fileName: "about.html",
    title: "NYAKAJU | ABOUT",
    bodyClassName: "font-body-md text-on-surface antialiased bg-background",
  },
  gallery: {
    id: "gallery",
    fileName: "gallery.html",
    title: "NYAKAJU | GALLERY",
    bodyClassName: "bg-background text-on-background font-body-md antialiased selection:bg-primary selection:text-on-primary",
  },
  rooms: {
    id: "rooms",
    fileName: "rooms.html",
    title: "NYAKAJU | ROOMS",
    bodyClassName: "bg-background text-on-background font-body-md antialiased pt-32",
  },
  "contact-us": {
    id: "contact-us",
    fileName: "contact us.html",
    title: "NYAKAJU | CONTACT",
    bodyClassName: "bg-background text-on-background antialiased font-body-md overflow-x-hidden",
  },
  "complete-booking": {
    id: "complete-booking",
    fileName: "complete booking.html",
    title: "NYAKAJU | BOOK ROOM",
    bodyClassName: "bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container",
  },
  "admin-login": {
    id: "admin-login",
    fileName: "admin login.html",
    title: "Admin Portal - The Nyakaju",
    bodyClassName: "bg-surface text-on-surface antialiased min-h-screen flex flex-col font-body-md",
  },
  "admin-dashboard": {
    id: "admin-dashboard",
    fileName: "admin dashboard.html",
    title: "Admin Dashboard - The Nyakaju",
    bodyClassName: "antialiased text-on-surface",
  },
};

const legacyLinkReplacements: Array<[string, string]> = [
  ["href=\"rooms.html#", "href=\"/rooms#"],
  ["href=\"complete booking.html", "href=\"/complete-booking"],
  ["href=\"admin dashboard.html", "href=\"/admin-dashboard"],
  ["href=\"admin login.html", "href=\"/admin-login"],
  ["href=\"contact us.html", "href=\"/contact-us"],
  ["href=\"gallery.html", "href=\"/gallery"],
  ["href=\"about.html", "href=\"/about"],
  ["href=\"rooms.html", "href=\"/rooms"],
  ["href=\"index.html", "href=\"/"],
  ["window.location.href = 'rooms.html'", "window.location.href = '/rooms'"],
  ["window.location.href = 'index.html'", "window.location.href = '/'"],
  ["window.location.href = 'admin dashboard.html'", "window.location.href = '/admin-dashboard'"],
  ["window.location.replace('admin login.html')", "window.location.replace('/admin-login')"],
];

function replaceAllOccurrences(input: string, search: string, replacement: string) {
  return input.split(search).join(replacement);
}

export function getLegacyPageMeta(pageId: LegacyPageId) {
  return legacyPages[pageId];
}

export function getLegacyPageIds() {
  return Object.keys(legacyPages) as LegacyPageId[];
}

export { legacyPages, legacyLinkReplacements, replaceAllOccurrences };