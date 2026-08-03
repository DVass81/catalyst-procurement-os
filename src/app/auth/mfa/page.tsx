import { redirect } from "next/navigation";

import { MfaScreen } from "@/components/auth/mfa-screen";
import { getAppSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const session = await getAppSession();
  if (!session) redirect("/");
  return <MfaScreen initialAssuranceLevel={session.assuranceLevel} />;
}
