import { DashboardView } from "@/components/DashboardView";

export default function AdminBusinessPage({ params }: { params: { id: string } }) {
  return <DashboardView mode="admin" businessId={params.id} />;
}
