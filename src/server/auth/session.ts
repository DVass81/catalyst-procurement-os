import "server-only";

import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AppSession {
  userId: string;
  email: string;
  role: string;
  tenantIds: string[];
  presenter: boolean;
  mode: "supabase" | "preview";
}

// Temporary testing access approved on 2026-07-28. Remove this override after
// Supabase SMTP delivery is configured and verified.
const TEMPORARY_PUBLIC_DEMO_BYPASS = true;

function fromUser(
  user: User,
  assignments: Array<{ tenant_id: string; role: string }>,
): AppSession {
  const tenantIds = assignments.map((assignment) => assignment.tenant_id);
  const role =
    assignments.find((assignment) => assignment.role === "administrator")
      ?.role ??
    assignments.find((assignment) => assignment.role === "presenter")?.role ??
    assignments[0]?.role ??
    "viewer";
  return {
    userId: user.id,
    email: user.email ?? "",
    role,
    tenantIds,
    presenter: role === "presenter" || role === "administrator",
    mode: "supabase",
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  if (TEMPORARY_PUBLIC_DEMO_BYPASS) {
    return {
      userId: "preview-presenter",
      email: "preview@catalystinnovations.example",
      role: "system_administrator",
      tenantIds: ["org-y12-demo", "org-catalyst-community-demo"],
      presenter: true,
      mode: "preview",
    };
  }
  if (!isSupabaseConfigured()) {
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.DEMO_AUTH_BYPASS === "1"
    ) {
      return {
        userId: "preview-presenter",
        email: "preview@catalystinnovations.example",
        role: "system_administrator",
        tenantIds: ["org-y12-demo", "org-catalyst-community-demo"],
        presenter: true,
        mode: "preview",
      };
    }
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: assignments, error } = await supabase
    .from("tenant_assignments")
    .select("tenant_id,role")
    .eq("user_id", user.id);
  if (error || !assignments?.length) return null;
  return fromUser(user, assignments);
}

export async function requireAppSession(tenantId?: string) {
  const session = await getAppSession();
  if (!session) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  if (tenantId && !session.tenantIds.includes(tenantId)) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
  return session;
}
