import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session) redirect("/");
  return <AppShell>{children}</AppShell>;
}
