import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/auth/login-screen";
import { getAppSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Catalyst Procurement OS",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getAppSession();
  if (session) redirect("/dashboard");
  return <LoginScreen />;
}
