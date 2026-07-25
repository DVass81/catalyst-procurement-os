import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Catalyst Procurement OS",
};

export default function Home() {
  redirect("/dashboard");
}
