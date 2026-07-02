import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
    Building2,
    User,
    Mail,
    MapPin,
    XCircle,
    Clock,
    ShieldCheck,
    AlertCircle
} from "lucide-react";

interface LguProfile {
    id: string;
    orgName: string;
    contactPerson: string;
    email: string;
    jurisdiction: string;
    verified: boolean;
    createdAt?: string;
    location?: { lat: number; lng: number } | null;
}

export default function LguApprovals() {
    const [lgus, setLgus] = useState<LguProfile[]>([]);
    const [filterMode, setFilterMode] = useState<"all" | "pending" | "verified">("pending");
    const [isLoading, setIsLoading] = useState(true);

    // Live stream both verified and unverified LGU profiles from your Firestore users table collection
    useEffect(() => {
        setIsLoading(true);
        const lguQuery = query(collection(db, "users"), where("role", "==", "lgu"));

        const unsubscribe = onSnapshot(lguQuery, (snapshot) => {
            const fetchedLgus: LguProfile[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                fetchedLgus.push({
                    id: doc.id,
                    orgName: data.orgName || "Unnamed Command Center",
                    contactPerson: data.contactPerson || "No Contact Person",
                    email: data.email || "No Email Bound",
                    jurisdiction: data.jurisdiction || "Barangay",
                    verified: data.verified ?? false,
                    createdAt: data.createdAt,
                    location: data.location || null
                });
            });
            setLgus(fetchedLgus);
            setIsLoading(false);
        }, (error) => {
            console.error("Firestore LGU streaming error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleToggleVerification = async (id: string, currentStatus: boolean) => {
        try {
            const docRef = doc(db, "users", id);
            await updateDoc(docRef, { verified: !currentStatus });
        } catch (error) {
            console.error("LGU status update failed:", error);
        }
    };

    const handleDeleteLgu = async (id: string) => {
        if (window.confirm("CRITICAL WARNING: Are you sure you want to permanently delete this LGU command node from the system database records?")) {
            try {
                await deleteDoc(doc(db, "users", id));
            } catch (error) {
                console.error("LGU deletion cleanup error:", error);
            }
        }
    };

    // Compute filtered results
    const filteredLgus = lgus.filter((lgu) => {
        if (filterMode === "pending") return !lgu.verified;
        if (filterMode === "verified") return lgu.verified;
        return true;
    });

    return (
        <div className="p-4 sm:p-8 h-full flex flex-col">
            {/* Title Header Section */}
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 pb-4 border-b border-red-900/30">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        🏛️ LGU Command <span className="text-red-500">Approvals</span>
                    </h1>
                    <p className="text-[#94A3B8] text-sm font-medium mt-1">
                        Authorize regional emergency operations hubs and verify local command nodes.
                    </p>
                </div>

                {/* Tab Selection Filter System */}
                <div className="flex bg-[#0A1628] border border-red-900/30 p-1 rounded-xl self-start sm:self-center">
                    {(["pending", "verified", "all"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setFilterMode(mode)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filterMode === mode
                                ? "bg-red-500 text-slate-900 dark:text-white shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                                : "text-[#94A3B8] hover:text-slate-900 dark:text-white"
                                }`}
                        >
                            {mode} ({lgus.filter(l => mode === "all" ? true : mode === "verified" ? l.verified : !l.verified).length})
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Core View Area */}
            <div className="flex-1">
                {isLoading ? (
                    <div className="text-center py-20 text-slate-500 font-mono tracking-widest animate-pulse">
                        POLLING NATIONAL COMMAND GRID COLLECTIONS...
                    </div>
                ) : filteredLgus.length === 0 ? (
                    <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl bg-white dark:bg-[#0D1B35]/20 text-slate-500">
                        <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                        <p className="text-base font-semibold">No operational units matched your criteria.</p>
                        <p className="text-xs text-slate-600 mt-1">New registration loops drop into this view instantly.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filteredLgus.map((lgu) => (
                            <div
                                key={lgu.id}
                                className={`p-5 rounded-2xl border bg-white dark:bg-[#0D1B35] transition-all hover:border-slate-700 flex flex-col justify-between gap-4 ${lgu.verified ? "border-slate-200 dark:border-[#1E293B]" : "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.03)]"
                                    }`}
                            >
                                {/* Info Metadata Block */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-xl ${lgu.verified ? "bg-teal-500/10 text-teal-400" : "bg-amber-500/10 text-amber-400"}`}>
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base text-slate-900 dark:text-white">{lgu.orgName}</h3>
                                                <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-50 dark:bg-[#050E1F] border border-slate-800 rounded text-[10px] font-mono font-bold text-slate-400">
                                                    Level: {lgu.jurisdiction}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Pill Badge */}
                                        {lgu.verified ? (
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full">
                                                <ShieldCheck className="w-3.5 h-3.5" /> Approved
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full animate-pulse">
                                                <Clock className="w-3.5 h-3.5" /> Awaiting Triage
                                            </span>
                                        )}
                                    </div>

                                    {/* Profile Key Value Table Metrics Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#94A3B8] pt-2 border-t border-slate-800/60">
                                        <div className="flex items-center gap-2 truncate">
                                            <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                            <span className="text-slate-900 dark:text-white">{lgu.contactPerson}</span>
                                        </div>
                                        <div className="flex items-center gap-2 truncate">
                                            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                            <span className="text-slate-900 dark:text-white hover:text-white transition-colors">{lgu.email}</span>
                                        </div>

                                        {lgu.location ? (
                                            <div className="flex items-center gap-2 sm:col-span-2 text-teal-400 font-mono text-[11px]">
                                                <MapPin className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                                                <span>Mappable: {lgu.location.lat.toFixed(5)}, {lgu.location.lng.toFixed(5)}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 sm:col-span-2 text-slate-500 font-mono text-[11px]">
                                                <MapPin className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                                <span>No Location Coordinates Provided</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Operations Control Actions Row Bar */}
                                <div className="flex justify-between items-center pt-3 border-t border-slate-800/60 mt-2">
                                    <button
                                        onClick={() => handleDeleteLgu(lgu.id)}
                                        className="text-xs font-semibold text-slate-500 hover:text-red-400 p-1 flex items-center gap-1 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" /> Revoke Request
                                    </button>

                                    <button
                                        onClick={() => handleToggleVerification(lgu.id, lgu.verified)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${lgu.verified
                                            ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                                            : "bg-teal-500 text-[#050E1F] hover:bg-teal-400 font-black"
                                            }`}
                                    >
                                        {lgu.verified ? "De-authorize Station" : "✓ Approve Command Access"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}