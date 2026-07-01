import type { ReactNode } from "react";
import { Building2, LayoutDashboard } from "lucide-react";

import { Separator } from "@easytable/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@easytable/ui/components/sidebar";
import { TooltipProvider } from "@easytable/ui/components/tooltip";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-svh bg-background">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <Separator className="h-5" orientation="vertical" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">easyTable Platform</p>
              <h1 className="truncate text-base font-semibold">Tenants</h1>
            </div>
          </header>
          <main className="flex-1 px-3 py-4 sm:px-5 lg:px-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-12" size="lg" tooltip="easyTable">
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">easyTable</span>
                <span className="truncate text-xs text-muted-foreground">Platform</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Tenants" type="button">
                  <Building2 className="size-4" />
                  <span>Tenants</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-auto items-start py-2" tooltip="Dev">
              <LayoutDashboard className="mt-0.5 size-4" />
              <span className="block truncate text-sm font-medium">Dev sichtbar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
