import "server-only";

import type { DemoRole } from "@/demo/model";
import {
  activeRoleAssignments,
  demoRoles,
  type ActiveRoleAssignment,
} from "@/server/auth/authority";
import type { AppSession } from "@/server/auth/session";

export interface ResolvedRequestRole {
  activeRole: DemoRole;
  assignment: ActiveRoleAssignment;
  simulation: boolean;
}

export function requestedActiveRole(request: Request) {
  const header = request.headers.get("x-catalyst-active-role");
  if (header) return header;
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("catalyst-active-role="))
    ?.slice("catalyst-active-role=".length);
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie);
  } catch {
    return undefined;
  }
}

export function resolveRequestRole(input: {
  request: Request;
  session: AppSession;
  tenantId: string;
  presenterRole: DemoRole;
}): ResolvedRequestRole {
  const authority = input.session.authorities[input.tenantId];
  if (!authority || authority.policy.status === "suspended") {
    throw new Error("IDENTITY_POLICY_UNAVAILABLE");
  }
  const activeAssignments = activeRoleAssignments(authority.roles);
  const directAssignments = activeAssignments.filter(
    (assignment) => assignment.assignmentType !== "presenter_simulation",
  );
  const requestedRole =
    requestedActiveRole(input.request) ??
    (directAssignments.length === 1
      ? directAssignments[0]?.role
      : undefined);
  const activeRole =
    requestedRole && demoRoles.includes(requestedRole as DemoRole)
      ? (requestedRole as DemoRole)
      : input.session.presenter
        ? input.presenterRole
        : undefined;
  if (!activeRole) throw new Error("ACTIVE_ROLE_REQUIRED");
  const assignment = activeAssignments.find(
    (candidate) => candidate.role === activeRole,
  );
  if (!assignment) throw new Error("ROLE_ACCESS_DENIED");
  const simulation =
    input.session.presenter &&
    process.env.CATALYST_SYNTHETIC_ONLY === "1" &&
    assignment.assignmentType === "presenter_simulation";
  if (input.session.presenter && !simulation) {
    throw new Error("PRESENTER_SIMULATION_DENIED");
  }
  if (!input.session.presenter && assignment.assignmentType === "presenter_simulation") {
    throw new Error("ROLE_ACCESS_DENIED");
  }
  return { activeRole, assignment, simulation };
}

export function requireRequestRoleCapability(input: {
  context: ResolvedRequestRole;
  session: AppSession;
  allowedRoles: readonly DemoRole[];
  requireAal2: boolean;
}) {
  if (
    !input.context.simulation &&
    !input.allowedRoles.includes(input.context.activeRole)
  ) {
    throw new Error("COMMAND_ROLE_DENIED");
  }
  if (
    input.requireAal2 &&
    !input.context.simulation &&
    input.session.assuranceLevel !== "aal2"
  ) {
    throw new Error("AAL2_REQUIRED");
  }
}
