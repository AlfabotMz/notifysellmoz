"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  MessageSquare,
  Users,
  FileText,
  Webhook,
  LogOut,
  Zap,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } catch {
      router.push("/auth/login");
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Encomendas", href: "/orders", icon: ShoppingBag },
    { label: "Conectar Shopify", href: "/settings/shopify", icon: Store },
    { label: "Conectar WhatsApp", href: "/settings/whatsapp", icon: MessageSquare },
    { label: "Destinatários", href: "/settings/recipients", icon: Users },
    { label: "Modelos de Mensagem", href: "/settings/messages", icon: FileText },
    { label: "Webhook Shopify", href: "/webhooks", icon: Webhook },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 min-h-screen flex flex-col flex-shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">NotifySell Moz</h1>
          <p className="text-xs text-slate-400">Shopify + WhatsApp</p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mozambique COD Badge & Logout Footer */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-400 border border-slate-700/50">
          <div className="font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Modo Moçambique (MZN)
          </div>
          <p>Otimizado para pagamentos contra entrega e logística local.</p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Terminar Sessão</span>
        </button>
      </div>
    </aside>
  );
}
