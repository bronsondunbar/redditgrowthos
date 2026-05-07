import type { Metadata } from "next";

import { OpportunityWorkbench } from "@/components/opportunity-workbench";
import { getDashboardState } from "@/lib/store";

type DashboardPageProps = {
  searchParams: Promise<{
    project?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Review ranked Reddit opportunities, draft replies, and manage your RedditGrowthOS workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const dashboard = await getDashboardState(params.project || null);

  return (
    <OpportunityWorkbench
      key={dashboard.currentProjectId || "empty-project"}
      initialState={dashboard}
    />
  );
}
