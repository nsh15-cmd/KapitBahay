import { useOnlineStatus } from "../lib/useOnlineStatus";
import { Wifi, WifiOff } from "lucide-react";

export default function NetworkStatus() {
    const isOnline = useOnlineStatus();

    return (
        <div
            className={`fixed left-4 right-4 md:left-auto md:right-6 bottom-20 md:bottom-6 z-50 max-w-sm rounded-2xl border p-3.5 shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 flex items-center gap-3 ${isOnline
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/80 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/80 dark:text-amber-300"
                }`}
        >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isOnline ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}>
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider">
                    {isOnline ? "Connected" : "Offline Mode"}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                    {isOnline
                        ? "Realtime database synchronization available."
                        : "Data queued locally. Will auto-sync when online."}
                </p>
            </div>
        </div>
    );
}