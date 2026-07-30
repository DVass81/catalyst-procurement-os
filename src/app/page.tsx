import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";
import { getAppSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Catalyst Procurement OS",
};

export const dynamic = "force-dynamic";

function authenticationMessage(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;
  switch (code) {
    case "access-review-pending":
      return "Your verified enterprise identity is awaiting administrator access review. No Catalyst role or tenant access has been granted yet.";
    case "invitation-required":
      return "This identity is not approved for Catalyst. Use an invited account or contact your Catalyst administrator.";
    case "secure-link-unavailable":
      return "That secure sign-in link is unavailable or incomplete. Request a new link and open only the newest message.";
    default:
      return undefined;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    authError?: string | string[];
  }>;
}) {
  const session = await getAppSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;
  return (
    <LoginScreen
      initialMessage={authenticationMessage(params.authError)}
      ssoEnabled={
        process.env.CATALYST_SSO_ENABLED === "1" ||
        process.env.NEXT_PUBLIC_CATALYST_SSO_ENABLED === "1"
      }
    />
  );
}
