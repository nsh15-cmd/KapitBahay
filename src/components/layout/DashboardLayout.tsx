// C:\Users\Renz Jericho Buday\KapitBahay\src\components\layout\DashboardLayout.tsx
import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map as MapIcon,
  ClipboardList,
  Settings,
  Menu,
  X,
  LogOut,
  ShieldAlert,
  Moon,
  Sun,
  BrainCircuit
} from "lucide-react";
import { useTheme } from "../../App";

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Optimized to align perfectly with App.tsx routes configuration parameters
  const navItems = [
    { name: "Triage Matrix", path: "/dashboard", icon: BrainCircuit },
    { name: "Incident Map", path: "/dashboard/map", icon: MapIcon },
    { name: "Live Feed List", path: "/dashboard/reports", icon: ClipboardList },
    { name: "System Settings", path: "/dashboard/settings", icon: Settings },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300">

      {/* DESKTOP SIDEBAR DRAWER */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0D1B35] border-r border-slate-200 dark:border-[#1E293B] transition-colors duration-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#1E293B]">
          <Link to="/" className="text-xl font-black text-[#06B6D4] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            KapitBahay LGU
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
            Malabon City Portal
          </div>
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${isActive
                    ? "bg-teal-50 dark:bg-[#06B6D4]/10 text-teal-600 dark:text-[#06B6D4]"
                    : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center font-bold text-[#0a0600]">
              DR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                DRRMO Head
              </p>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] truncate">
                drrmo@malabon.gov.ph
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="mt-2 flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* MOBILE FLOATING HEADER NAV */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-[#0D1B35] border-b border-slate-200 dark:border-[#1E293B] absolute top-0 left-0 right-0 z-20">
        <Link to="/" className="text-lg font-black text-[#06B6D4] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          KapitBahay LGU
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* MOBILE POPUP OVERLAY DRAWER MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-[#050E1F]/80 backdrop-blur-sm" onClick={closeMobileMenu} />
          <div className="relative flex flex-col w-64 max-w-xs bg-white dark:bg-[#0D1B35] h-full shadow-2xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-[#1E293B]">
              <span className="text-lg font-black text-[#06B6D4]">Portal Menu</span>
              <button onClick={closeMobileMenu} className="p-2 text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${isActive
                        ? "bg-teal-50 dark:bg-[#06B6D4]/10 text-teal-600 dark:text-[#06B6D4]"
                        : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* PRIMARY OPERATIONAL SLOT CONTENT ROUTER CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-end gap-2 p-4 md:p-6 bg-slate-50 dark:bg-[#050E1F] pt-20 md:pt-6 shrink-0 transition-colors duration-300">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>

        {/* VIEW CONTAINER BOX */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#050E1F] transition-colors duration-300">
          <Outlet />
        </div>
      </div>

    </div>
  );
}