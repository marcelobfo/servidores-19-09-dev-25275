import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  Settings,
  DollarSign,
  FolderOpen,
  UserCheck,
  LogOut,
  UsersRound
} from "lucide-react";

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Áreas",
    url: "/admin/areas",
    icon: FolderOpen,
  },
  {
    title: "Cursos",
    url: "/admin/courses",
    icon: BookOpen,
  },
  {
    title: "Inscrições",
    url: "/admin/enrollments",
    icon: Users,
  },
  {
    title: "Matrículas",
    url: "/admin/matriculas",
    icon: UserCheck,
  },
  {
    title: "Usuários",
    url: "/admin/users",
    icon: UsersRound,
  },
  {
    title: "Certificados",
    url: "/admin/certificates",
    icon: FileText,
  },
];

const settingsItems = [
  {
    title: "Sistema",
    url: "/admin/settings",
    icon: Settings,
  },
  {
    title: "Pagamentos",
    url: "/admin/payment-settings",
    icon: DollarSign,
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return currentPath === "/admin";
    }
    return currentPath.startsWith(path);
  };

  const getNavClass = (path: string) => {
    return isActive(path)
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">Admin</span>
          </div>
        )}
        <SidebarTrigger className="h-6 w-6" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Painel Administrativo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className={getNavClass(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClass(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-4 border-t border-sidebar-border">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </div>
    </Sidebar>
  );
}