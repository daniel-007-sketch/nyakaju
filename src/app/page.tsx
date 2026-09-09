import type { Metadata } from "next";
import { LegacyRoute } from "@/components/LegacyRoute";
import { getLegacyPageMeta } from "@/lib/legacy";

export const metadata: Metadata = {
  title: getLegacyPageMeta("index").title,
};

export default function HomePage() {
  return (
    <>
      <div style={{ textAlign: "center", padding: "10px" }}>
        DEPLOYMENT TEST
      </div>

      <LegacyRoute pageId="index" />
    </>
  );
}