import { OpportunityWorkbench } from "@/components/opportunity-workbench";
import { getDashboardState } from "@/lib/store";

type DashboardPageProps = {
  searchParams: Promise<{
    project?: string;
  }>;
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
