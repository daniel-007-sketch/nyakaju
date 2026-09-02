import type { Metadata } from "next";
import { LegacyRoute } from "@/components/LegacyRoute";
import { getLegacyPageMeta } from "@/lib/legacy";

export const metadata: Metadata = {
  title: getLegacyPageMeta("index").title,
};

export default function HomePage() {
  return <LegacyRoute pageId="index" />;
}
