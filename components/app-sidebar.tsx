"use client";

import {
  Bookmark,
  FolderKanban,
  History,
  LogOut,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const workspaceItems = [
  { label: "Design Studio", icon: Sparkles, href: "/" as const },
  { label: "Projects", icon: FolderKanban },
  { label: "Design History", icon: History, href: "/history" as const },
  { label: "Saved Designs", icon: Bookmark },
];

const accountItems = [{ label: "Settings", icon: Settings }];

function FutureMenuItem({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip={`${label} is coming soon`}
        className="cursor-pointer text-mute hover:bg-pine-soft hover:text-pine"
        onClick={() => undefined}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const activeHref = pathname.startsWith("/history") ? "/history" : "/";

  return (
    <Sidebar collapsible="icon" className="border-hair bg-surface">
      <SidebarHeader className="px-3 py-4">
        <div className="flex h-9 items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-pine group-data-[collapsible=icon]:hidden">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f6f4f0" strokeWidth="2">
              <path d="M4 3v13h13" />
              <path d="M4 16l6-6 4 4 6-8" />
            </svg>
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium tracking-tight text-ink">FortnAI</p>
            <p className="truncate text-[11px] text-mute">Interior design studio</p>
          </div>
          <SidebarTrigger className="ml-auto text-mute hover:text-ink group-data-[collapsible=icon]:mx-auto" />
        </div>
        <SidebarSeparator className="mt-3" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-[0.12em] text-mute uppercase">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) =>
                item.href ? (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={activeHref === item.href}
                      tooltip={item.label}
                      className="text-mute hover:text-pine data-[active=true]:bg-pine-soft data-[active=true]:text-pine data-[active=true]:hover:bg-pine-soft data-[active=true]:hover:text-pine"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <FutureMenuItem key={item.label} label={item.label} icon={item.icon} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] tracking-[0.12em] text-mute uppercase">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <FutureMenuItem key={item.label} label={item.label} icon={item.icon} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarSeparator className="mb-3" />
        <form action={logoutAction}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="submit"
                tooltip="Sign out"
                className="text-mute hover:bg-pine-soft hover:text-pine"
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
