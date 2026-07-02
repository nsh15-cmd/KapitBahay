// C:\Users\Renz Jericho Buday\KapitBahay\src\components\layout\CitizenLayout.tsx
import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ClipboardList, Map, LogOut, ShieldAlert, Moon, Sun } from "lucide-react";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth, useTheme } from "../../App";
import NetworkStatus from "../NetworkStatus";

export default function CitizenLayout() {
    const location = useLocation();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [profile, setProfile] = useState<Record<string, any> | null>(null);

    const navItems = [
        { name: "Reports", path: "/reports", icon: ClipboardList },
        { name: "Mesh Map", path: "/map", icon: Map },
    ];

    useEffect(() => {
        if (!user?.uid) {
            setProfile(null);
            return;
        }

        const profileRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(profileRef, (snapshot) => {
            setProfile(snapshot.exists() ? snapshot.data() : null);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out citizen:", error);
        }
    };

    const profileName = profile?.displayName || [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user?.displayName || "Resident Citizen";
    const profileSubtitle = profile?.orgName || profile?.jurisdiction || user?.email || "Citizen account";

    const getInitials = () => {
        if (profileName && profileName !== "Resident Citizen") {
            return profileName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
        }
        if (user?.email) {
            return user.email.slice(0, 2).toUpperCase();
        }
        return "CR";
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-[#050E1F] text-slate-900 dark:text-white overflow-hidden font-sans relative transition-colors duration-300">
            <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0A1628] border-r border-teal-200 dark:border-teal-900/30 flex-shrink-0 transition-colors duration-300">
                <div className="h-16 flex items-center px-6 border-b border-teal-200 dark:border-teal-900/30 bg-slate-50/50 dark:bg-[#050E1F]/50">
                    <div className="text-xl font-black text-teal-600 dark:text-teal-400 flex items-center gap-2 cursor-default select-none">
                        <ShieldAlert className="w-5 h-5" />
                        KapitBahay Node
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="px-4 mb-2 text-xs font-bold text-teal-600/70 dark:text-teal-500/70 uppercase tracking-wider">
                        Citizen Dashboard
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
                                        ? "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20"
                                        : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#0D1B35] hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-4 border-t border-teal-200 dark:border-teal-900/30 bg-slate-50/50 dark:bg-[#050E1F]/20">
                    <div className="flex items-center gap-3 px-2 py-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center font-bold text-white flex-shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                            {getInitials()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                                {profileName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8] truncate">{profileSubtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-[#94A3B8] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors w-full text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 h-full overflow-y-auto pb-20 md:pb-0 bg-slate-50 dark:bg-[#050E1F] transition-colors duration-300">
                <NetworkStatus />
                <div className="flex items-center justify-end gap-2 p-4 md:p-6">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {theme === "dark" ? "Light mode" : "Dark mode"}
                    </button>
                </div>
                <Outlet />
            </main>

            <nav className="nav-container-fixed md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0A1628] border-t border-teal-200 dark:border-teal-900/30 flex items-center justify-around px-2 z-50">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${isActive ? "text-teal-600 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-[#94A3B8]"}`}
                        >
                            <Icon className={`w-5 h-5 mb-1 ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
                            <span className="text-[10px] tracking-tight">{item.name}</span>
                        </Link>
                    );
                })}

                <button
                    onClick={handleLogout}
                    className="flex flex-col items-center justify-center w-16 h-full text-slate-500 dark:text-[#94A3B8] active:text-red-600 dark:active:text-red-400"
                >
                    <LogOut className="w-5 h-5 mb-1" />
                    <span className="text-[10px] tracking-tight">Logout</span>
                </button>
            </nav>
        </div>
    );
}