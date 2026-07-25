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

function fromUser(user: User): AppSession {
  const metadata = user.app_metadata ?? {};
  const tenantIds = Array.isArray(metadata.tenant_ids)
    ? metadata.tenant_ids.filter(
        (tenantId): tenantId is string => typeof tenantId === "string",
      )
    : [];
  return {
    userId: user.id,
    email: user.email ?? "",
    role: typeof metadata.role === "string" ? metadata.role : "viewer",
    tenantIds,
    presenter: metadata.presenter === true,
    mode: "supabase",
  };
}

export async function getAppSession(): Promise<AppSession | null> {
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
  return user ? fromUser(user) : null;
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
