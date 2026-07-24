import type { Metadata } from "next";

import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = {
  title: "Welcome",
};

export default function Home() {
  return <LoginScreen />;
}
