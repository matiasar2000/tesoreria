"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PieChart,
  Receipt,
  Upload,
  Bell,
  Users,
  Landmark,
  FileText,
  Lock,
  LogOut,
  BarChart3,
  Package,
  CircleDollarSign,
  Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AI_ASSISTANT_ROLES } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: readonly string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presupuesto", label: "Presupuesto", icon: PieChart },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/ingresos", label: "Ingresos", icon: CircleDollarSign },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/ia", label: "Asistente IA", icon: Bot, roles: AI_ASSISTANT_ROLES },
  { href: "/banco", label: "Banco", icon: Landmark },
  { href: "/rendiciones", label: "Rendiciones", icon: FileText },
  { href: "/cierre", label: "Cierre Contable", icon: Lock },
  { href: "/usuarios", label: "Usuarios", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
            CB
          </div>
          <div>
            <p className="font-semibold text-sm">Tesorería CBT</p>
            <p className="text-xs text-muted-foreground">Bomberos Talcahuano</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-3 py-4">
          <div className="px-3 py-2 text-sm">
            <p className="font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
