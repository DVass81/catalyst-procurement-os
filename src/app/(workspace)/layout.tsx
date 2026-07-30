import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";

import { DEVELOPMENT_BYPASS_EXPIRES_AT } from "@/server/auth/development-bypass";
import { getAppSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session) redirect("/");
  return (
    <AppShell
      accessMode={session.mode}
      sessionEmail={session.email}
      bypassExpiresAt={
        session.mode === "staging_bypass"
          ? DEVELOPMENT_BYPASS_EXPIRES_AT
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
