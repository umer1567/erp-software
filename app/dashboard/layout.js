
import { cookies } from "next/headers";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const cookieMode = cookieStore.get("erp-sidebar-mode")?.value;

  const initialMode =
    cookieMode === "horizontal" ? "horizontal" : "vertical";

  return (
    <DashboardLayoutClient initialMode={initialMode}>
      {children}
    </DashboardLayoutClient>
  );
}
