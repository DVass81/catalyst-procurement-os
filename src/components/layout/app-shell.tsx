"use client";

import * as Avatar from "@radix-ui/react-avatar";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  HelpCircle,
  Headphones,
  Laptop,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { navigationItems, navigationSections } from "@/config/navigation";
import { canAccessWorkspacePath } from "@/config/module-access";
import { CatalystGuide } from "@/components/guide/catalyst-guide";
import { useCatalystGuide } from "@/components/guide/catalyst-guide-provider";
import { useDemo } from "@/components/demo/demo-provider";
import { tenantThemes, type TenantId } from "@/config/organizations";
import { PresenterDock } from "@/components/presenter/presenter-dock";
import {
  currentUser,
  notifications,
  searchRecords,
} from "@/data/mock-data";
import { cn, titleCase } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { BrandMark } from "./brand-mark";

type Theme = "light" | "dark" | "system";

function WorkspaceResolutionScreen({
  blocked = false,
  message,
}: {
  blocked?: boolean;
  message?: string | null;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <section
        aria-live="polite"
        aria-busy={blocked ? undefined : true}
        className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-elevated)]"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
          <ShieldCheck
            className={cn("size-7", !blocked && "animate-pulse")}
            aria-hidden="true"
          />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-secondary-text)]">
          Secure workspace resolution
        </p>
        <h1 className="mt-2 text-2xl font-black text-[var(--foreground)]">
          {blocked ? "Workspace unavailable" : "Preparing your workspace"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {blocked
            ? message ??
              "Catalyst could not verify authoritative access. No tenant records or controlled actions were loaded."
            : "Catalyst is verifying your session, organization, active role, permissions, and authoritative records before displaying any workspace data."}
        </p>
        {blocked ? (
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Retry secure resolution
          </Button>
        ) : (
          <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--brand-primary)]" />
          </div>
        )}
      </section>
    </main>
  );
}

const resultTypeLabels: Record<string, string> = {
  purchase_request: "Purchase request",
  purchase_order: "Purchase order",
  invoice: "Invoice",
  contract: "Contract",
  employee: "Employee",
  department: "Department",
  vendor: "Vendor",
  inventory: "Inventory",
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(systemDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { state } = useDemo();
  const sections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          state.presenterMode ||
          canAccessWorkspacePath(state.activeRole, item.href),
      ),
    }))
    .filter((section) => section.items.length > 0);
  return (
    <nav aria-label="Primary navigation" className="flex-1 space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--subtle-foreground)]">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all",
                    active
                      ? "bg-white text-[#041a6c] shadow-[0_8px_24px_rgba(0,0,0,.16)]"
                      : "text-white/68 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                        active
                          ? "bg-[#cf4427] text-white"
                          : "bg-white/10 text-[#f0cb7c]",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { state } = useDemo();
  const organization = state.organization;
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden border-r border-white/10 text-white shadow-[18px_0_50px_rgba(4,26,108,.08)] lg:flex"
      style={{ backgroundColor: organization.sidebarColor }}
    >
      <div className="pointer-events-none absolute -left-16 top-28 size-52 rounded-full bg-[#404287]/55 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-32 size-56 rounded-full bg-[#cf4427]/22 blur-3xl" />
      <div className="relative flex min-h-[7.25rem] flex-col justify-center border-b border-white/10 px-5">
        <div className="flex items-center justify-between gap-3">
          <Image
            src={organization.logoPath}
            alt={organization.organizationName}
            width={112}
            height={56}
            priority
            className="h-auto w-28"
          />
          <span className="rounded-full border border-[#ebbf5d]/25 bg-[#ebbf5d]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[#f0cb7c]">
            Demo
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          <BrandMark className="[&_p:first-of-type]:text-white [&_p:last-of-type]:text-white/45" />
        </div>
      </div>
      <div className="scrollbar-none relative flex flex-1 flex-col overflow-y-auto px-3 py-5 [&_nav>div>p]:text-white/35">
        <Navigation pathname={pathname} />
        <div className="mt-5 rounded-2xl border border-[#ebbf5d]/20 bg-white/[0.07] p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ebbf5d] to-[#cf4427] text-[#041a6c]">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-bold text-white">
              CATE Guide
            </span>
            <Badge className="ml-auto border-white/10 bg-white/10 px-1.5 py-0.5 text-[9px] text-[#f0cb7c]">
              AI
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-4.5 text-white/55">
            Evidence-grounded procurement answers, captions, and a
            presenter-controlled fallback.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("catalyst-guide-open"))
            }
            className="mt-3 flex w-full items-center justify-between text-[11px] font-bold text-[#f0cb7c]"
          >
            Start guided demo
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const authorized = searchRecords.filter(
      (record) =>
        state.presenterMode ||
        canAccessWorkspacePath(state.activeRole, record.href),
    );
    if (!normalized) return authorized.slice(0, 8);
    return authorized
      .filter((record) =>
        [record.title, record.subtitle, ...record.keywords]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 10);
  }, [query, state.activeRole, state.presenterMode]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-elevated)] outline-none"
        >
          <Dialog.Title className="sr-only">Global search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search fictional procurement records, vendors, employees, and
            departments.
          </Dialog.Description>
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
            <Search
              className="size-5 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (!filtered.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => (index + 1) % filtered.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(
                    (index) => (index - 1 + filtered.length) % filtered.length,
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const selectedRecord = filtered[activeIndex];
                  if (selectedRecord) {
                    router.push(selectedRecord.href);
                    onOpenChange(false);
                  }
                }
              }}
              aria-label="Search procurement records"
              aria-activedescendant={
                filtered.length ? `search-result-${activeIndex}` : undefined
              }
              aria-controls="global-search-results"
              placeholder="Search requests, POs, vendors, contracts..."
              className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none"
            />
            <kbd className="hidden rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-bold text-[var(--muted-foreground)] sm:block">
              ESC
            </kbd>
          </div>
          <div
            id="global-search-results"
            className="max-h-[58vh] overflow-y-auto p-2"
          >
            {filtered.length ? (
              <>
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {query ? `${filtered.length} results` : "Suggested records"}
                </p>
                {filtered.map((record, index) => (
                  <Link
                    key={`${record.type}-${record.id}`}
                    id={`search-result-${index}`}
                    href={record.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={activeIndex === index ? "true" : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)]",
                      activeIndex === index && "bg-[var(--surface-muted)]",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                      <Search className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                        {record.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                        {resultTypeLabels[record.type]} · {record.subtitle}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                  </Link>
                ))}
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
                  <Search className="size-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-[var(--foreground)]">
                  No records found
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Try an ID, vendor, employee, or department name.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-[10px] text-[var(--muted-foreground)]">
            <span>Fictional demo records</span>
            <span>Enter to open · ↑↓ to navigate</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ThemeMenu({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Laptop },
  ];
  const ActiveIcon =
    options.find((option) => option.value === theme)?.icon ?? Laptop;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <ActiveIcon className="size-[18px]" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-40 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-elevated)]"
        >
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => setTheme(option.value)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--muted-foreground)] outline-none hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:text-[var(--foreground)]"
              >
                <Icon className="size-4" />
                {option.label}
                {theme === option.value && (
                  <Check className="ml-auto size-3.5 text-[var(--brand-primary)]" />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function OrganizationMenu() {
  const { state, switchTenant, activeTenantId } = useDemo();
  const organization = state.organization;
  const trigger = (
    <button
      type="button"
      className="hidden h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left shadow-sm sm:flex"
      aria-label={
        state.presenterMode
          ? `Switch organization. Current organization: ${organization.organizationName}`
          : `Current organization: ${organization.organizationName}`
      }
    >
      <span
        className="flex h-7 w-14 items-center justify-center rounded-lg px-1"
        style={{ backgroundColor: organization.sidebarColor }}
      >
        <Image
          src={organization.logoPath}
          alt={organization.organizationName}
          width={56}
          height={28}
          className="h-auto w-full"
        />
      </span>
      <span className="max-w-36 truncate text-xs font-bold text-[var(--foreground)]">
        {organization.organizationName}
      </span>
      {state.presenterMode && (
        <ChevronDown className="size-3.5 text-[var(--muted-foreground)]" />
      )}
    </button>
  );
  if (!state.presenterMode) return trigger;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-elevated)]"
        >
          <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Organizations
          </p>
          {Object.entries(tenantThemes).map(([tenantId, tenant]) => {
            const active = tenantId === activeTenantId;
            return (
              <DropdownMenu.Item
                key={tenantId}
                onSelect={() => switchTenant(tenantId as TenantId)}
                disabled={!state.presenterMode}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl p-3 outline-none",
                  active
                    ? "bg-[var(--brand-soft)]"
                    : "hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)]",
                )}
              >
                <span
                  className="flex h-9 w-16 items-center justify-center rounded-lg px-1.5"
                  style={{ backgroundColor: tenant.sidebarColor }}
                >
                  <Image
                    src={tenant.logoPath}
                    alt={tenant.organizationName}
                    width={60}
                    height={30}
                    className="h-auto w-full"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-[var(--foreground)]">
                    {tenant.organizationName}
                  </span>
                  <span className="block text-[10px] text-[var(--muted-foreground)]">
                    {tenantId === "org-y12-demo"
                      ? "Personalized demonstration"
                      : "Clearly fictional tenant"}
                  </span>
                </span>
                {active && (
                  <Check className="size-4 text-[var(--brand-primary)]" />
                )}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item
            disabled
            className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] opacity-70 outline-none"
          >
            <Building2 className="size-4" />
            Organization administration
            <Badge className="ml-auto">Future Activation</Badge>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function NotificationMenu() {
  const { state } = useDemo();
  if (!state.presenterMode) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="No authorized notifications available"
      >
        <Bell className="size-[18px]" />
      </Button>
    );
  }
  const unread = notifications.filter((notification) => !notification.read).length;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${unread} unread notifications`}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-[var(--surface)]" />
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-elevated)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                Notifications
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {unread} items need your attention
              </p>
            </div>
            <Badge tone="info">{unread} new</Badge>
          </div>
          <div className="p-2">
            {notifications.map((notification) => (
              <DropdownMenu.Item key={notification.id} asChild>
                <Link
                  href={notification.href}
                  className="flex cursor-pointer gap-3 rounded-xl p-3 outline-none hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)]"
                >
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      notification.read
                        ? "bg-[var(--border-strong)]"
                        : "bg-[var(--brand-primary)]",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-[var(--foreground)]">
                      {notification.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-[var(--muted-foreground)]">
                      {notification.description}
                    </span>
                  </span>
                </Link>
              </DropdownMenu.Item>
            ))}
          </div>
          <div className="border-t border-[var(--border)] p-2">
            <Link
              href="/operations-center"
              className="block w-full rounded-xl py-2 text-center text-xs font-bold text-[var(--brand-primary)] hover:bg-[var(--surface-muted)]"
            >
              View all notifications
            </Link>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ProfileMenu({
  stagingBypass,
  sessionEmail,
}: {
  stagingBypass: boolean;
  sessionEmail: string;
}) {
  const { state, availableRoles, selectActiveRole, pending } = useDemo();
  const profileName = state.presenterMode
    ? (currentUser?.name ?? "Synthetic presenter")
    : "Signed-in user";
  const profileEmail =
    sessionEmail || currentUser?.email || "authenticated-user";
  const profileInitials = state.presenterMode
    ? (currentUser?.initials ?? "SP")
    : profileEmail.slice(0, 2).toUpperCase();
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
    window.location.assign("/");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-[var(--surface-muted)]"
          aria-label="Open user profile menu"
        >
          <Avatar.Root className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)]">
            <Avatar.Fallback className="text-[10px] font-black text-[var(--brand-primary)]">
              {profileInitials}
            </Avatar.Fallback>
          </Avatar.Root>
          <div className="hidden max-w-28 text-left xl:block">
            <p className="truncate text-xs font-bold text-[var(--foreground)]">
              {profileName}
            </p>
            <p className="truncate text-[9px] text-[var(--muted-foreground)]">
              {titleCase(state.activeRole)}
            </p>
          </div>
          <ChevronDown className="hidden size-3.5 text-[var(--muted-foreground)] xl:block" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-elevated)]"
        >
          <div className="px-3 py-2">
            <p className="text-xs font-bold text-[var(--foreground)]">
              {profileName}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
              {profileEmail}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          {!state.presenterMode && availableRoles.length > 1 ? (
            <>
              <p className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--subtle-foreground)]">
                Active role
              </p>
              {availableRoles.map((role) => (
                <DropdownMenu.Item
                  key={role}
                  asChild
                  onSelect={(event) => event.preventDefault()}
                >
                  <button
                    type="button"
                    disabled={pending || role === state.activeRole}
                    onClick={() => void selectActiveRole(role)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--muted-foreground)] outline-none hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] disabled:cursor-default disabled:text-[var(--foreground)]"
                  >
                    <span>{titleCase(role)}</span>
                    {role === state.activeRole ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : null}
                  </button>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
            </>
          ) : null}
          {[
            { label: "My profile", icon: UserRound, href: "/settings" },
            {
              label: "Multi-factor security",
              icon: ShieldCheck,
              href: "/auth/mfa",
            },
            { label: "Settings", icon: Settings, href: "/settings" },
            ...(state.presenterMode ||
            canAccessWorkspacePath(
              state.activeRole,
              "/operations-center",
            )
              ? [
                  {
                    label: "Help center",
                    icon: HelpCircle,
                    href: "/operations-center",
                  },
                ]
              : []),
          ].map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenu.Item
                key={item.label}
                asChild
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] outline-none hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:text-[var(--foreground)]"
              >
                <Link href={item.href}>
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            );
          })}
          {stagingBypass ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
              <div className="px-3 py-2 text-[10px] leading-4 text-amber-700">
                Sign-out is unavailable while the temporary development bypass
                is active.
              </div>
            </>
          ) : (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
              <DropdownMenu.Item
                asChild
                onSelect={(event) => {
                  event.preventDefault();
                  void signOut();
                }}
              >
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 outline-none hover:bg-rose-500/10 focus:bg-rose-500/10"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({
  children,
  accessMode,
  bypassExpiresAt,
  sessionEmail,
}: {
  children: React.ReactNode;
  accessMode: "supabase" | "preview" | "staging_bypass";
  bypassExpiresAt?: string;
  sessionEmail: string;
}) {
  const pathname = usePathname();
  const guide = useCatalystGuide();
  const { durability, error, hydrated, persistence, state } = useDemo();
  const organization = state.organization;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("catalyst-theme");
    const initialTheme: Theme =
      savedTheme === "light" || savedTheme === "dark" || savedTheme === "system"
        ? savedTheme
        : "system";
    const syncTheme = window.setTimeout(() => {
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    }, 0);
    return () => window.clearTimeout(syncTheme);
  }, []);

  useEffect(() => {
    const openGuide = () => guide.setOpen(true);
    window.addEventListener("catalyst-guide-open", openGuide);
    return () => window.removeEventListener("catalyst-guide-open", openGuide);
  }, [guide]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => applyTheme("system");
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
    window.localStorage.setItem("catalyst-theme", nextTheme);
    applyTheme(nextTheme);
  }

  const currentItem = navigationItems.find((item) => item.href === pathname);
  const pageTitle =
    currentItem?.label ??
    titleCase(pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard");
  const stagingBypass = accessMode === "staging_bypass";

  if (!hydrated) {
    return <WorkspaceResolutionScreen />;
  }

  if (durability === "read_only" && persistence === "unavailable") {
    return <WorkspaceResolutionScreen blocked message={error} />;
  }

  return (
    <div
      className="min-h-screen bg-[var(--background)]"
      style={
        {
          "--org-primary": organization.primaryColor,
          "--org-secondary": organization.secondaryColor,
          "--org-accent": organization.accentColor,
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-bold text-[var(--brand-primary-foreground)] focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar pathname={pathname} />

      <div className="lg:pl-64">
        {stagingBypass && (
          <div
            role="status"
            className="sticky top-0 z-30 flex min-h-10 items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-amber-950 sm:text-xs"
          >
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Authentication bypass active — public synthetic development
              environment — expires August 12, 2026 — not sales ready
            </span>
            {bypassExpiresAt && (
              <time className="sr-only" dateTime={bypassExpiresAt}>
                {bypassExpiresAt}
              </time>
            )}
          </div>
        )}
        <header
          className={cn(
            "sticky z-20 flex h-[var(--topbar-height)] items-center border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 backdrop-blur-xl sm:px-6 lg:px-8",
            stagingBypass ? "top-10" : "top-0",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm lg:hidden" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl outline-none lg:hidden">
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <div className="mb-5 flex items-center justify-between">
                    <BrandMark />
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Close navigation">
                        <X className="size-5" />
                      </Button>
                    </Dialog.Close>
                  </div>
                  <div className="scrollbar-none overflow-y-auto">
                    <Navigation
                      pathname={pathname}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            <div className="lg:hidden">
              <BrandMark compact />
            </div>
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Workspace
              </span>
              <ChevronRight className="size-3.5 text-[var(--subtle-foreground)]" />
              <span className="truncate text-xs font-bold text-[var(--foreground)]">
                {pageTitle}
              </span>
            </div>
            <OrganizationMenu />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              data-tour-id="start-guided-demo"
              onClick={() => guide.setOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-xl bg-[#cf4427] px-3 text-xs font-black text-white shadow-[0_8px_24px_rgba(207,68,39,.22)] transition hover:-translate-y-0.5 hover:bg-[#b83a22] xl:flex"
            >
              <Headphones className="size-4" />
              Guided demo
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-muted)] md:flex"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="flex-1">Search anything...</span>
              <kbd className="flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-bold">
                <Command className="size-2.5" />K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-[18px]" />
            </Button>
            <ThemeMenu theme={theme} setTheme={setTheme} />
            <NotificationMenu />
            <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
            <ProfileMenu
              stagingBypass={stagingBypass}
              sessionEmail={sessionEmail}
            />
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-[var(--content-max-width)] p-4 sm:p-6 lg:p-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <button
        onClick={() => guide.setOpen(true)}
        aria-label="Open CATE Guide"
        className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ebbf5d] to-[#cf4427] text-[#041a6c] shadow-[0_18px_42px_rgba(4,26,108,.28)] transition-transform hover:-translate-y-1 lg:bottom-7 lg:right-7"
      >
        <Sparkles className="size-5" />
      </button>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <CatalystGuide />
      <PresenterDock />
    </div>
  );
}
