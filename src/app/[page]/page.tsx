import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyRoute } from "@/components/LegacyRoute";
import { getLegacyPageIds, getLegacyPageMeta, type LegacyPageId } from "@/lib/legacy";

type PageProps = {
  params: Promise<{ page: string }>;
};

const routePageIds: LegacyPageId[] = getLegacyPageIds().filter((pageId) => pageId !== "index");

function isLegacyRoute(page: string): page is LegacyPageId {
  return routePageIds.includes(page as LegacyPageId);
}

export function generateStaticParams() {
  return routePageIds.map((page) => ({ page }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return isLegacyRoute(page) ? { title: getLegacyPageMeta(page).title } : {};
}

export default async function LegacyAppPage({ params }: PageProps) {
  const { page } = await params;

  if (!isLegacyRoute(page)) {
    notFound();
  }

  return <LegacyRoute pageId={page} />;
}
