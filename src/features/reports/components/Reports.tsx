// C:\Users\Renz Jericho Buday\KapitBahay\src\features\reports\components\Reports.tsx
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FilePlus2, MessageSquare, MapPin, ShieldAlert, Clock3, WifiOff, Cloud, Network, Bluetooth, Loader2 } from "lucide-react";
import { useAuth } from "../../../App";
import { useReportsStore } from "../../../store/useReportsStore";
import { broadcastReportViaBluetooth } from "../../../lib/bluetoothSharing";
import { syncEventEmitter } from "../../../lib/syncEngine";
import ReportForm from "./ReportForm";

const statusLabelMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
    on_the_way: { label: "On the Way", color: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
    resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    false_report: { label: "False Report", color: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
    needs_verification: { label: "Needs Verification", color: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
    synced: { label: "Synced", color: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800" },
    failed: { label: "Needs Review", color: "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800" },
};

const categoryConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    hazard: { label: "Hazard", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/20", border: "border-red-200 dark:border-red-500/30" },
    resource: { label: "Needs", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/20", border: "border-emerald-200 dark:border-emerald-500/30" },
    rescue: { label: "Rescue", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/20", border: "border-amber-200 dark:border-amber-500/30" },
    infrastructure: { label: "Damage", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-200 dark:bg-slate-700", border: "border-slate-300 dark:border-slate-600" },
    status: { label: "Status", color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-500/20", border: "border-sky-200 dark:border-sky-500/30" },
    all: { label: "All Reports", color: "text-slate-900 dark:text-white", bg: "bg-slate-200 dark:bg-slate-700", border: "border-slate-300 dark:border-slate-600" }
};

const filterTabs = ['all', 'hazard', 'resource', 'rescue', 'infrastructure', 'status'] as const;

export default function Reports() {
    const { role, user } = useAuth();
    const { reports, hydrateReports, startLiveStream, setSelectedReportId, selectedReportId, addComment, updateLifecycleStatus } = useReportsStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [syncNotice, setSyncNotice] = useState<string | null>(null);

    useEffect(() => {
        hydrateReports();
        const unsubscribe = startLiveStream();
        return () => unsubscribe();
    }, [hydrateReports, startLiveStream]);

    useEffect(() => {
        const handleSyncNotice = (event: Event) => {
            const detail = (event as CustomEvent<{ title?: string; offline?: boolean; permissionsOk?: boolean }>).detail;
            const title = detail?.title?.trim();

            if (event.type === "peer-received") {
                setSyncNotice(`New report received from a nearby user${title ? `: ${title}` : ""}`);
            } else if (detail?.offline) {
                setSyncNotice(`Saved offline and pairing with nearby users${title ? `: ${title}` : ""}`);
            } else {
                setSyncNotice(`Syncing with nearby users${title ? `: ${title}` : ""}`);
            }

            window.setTimeout(() => setSyncNotice(null), 3800);
        };

        syncEventEmitter.addEventListener("report-created", handleSyncNotice as EventListener);
        syncEventEmitter.addEventListener("peer-received", handleSyncNotice as EventListener);

        return () => {
            syncEventEmitter.removeEventListener("report-created", handleSyncNotice as EventListener);
            syncEventEmitter.removeEventListener("peer-received", handleSyncNotice as EventListener);
        };
    }, []);

    const selectedReport = useMemo(
        () => reports.find((report) => report._id === selectedReportId) ?? null,
        [reports, selectedReportId]
    );

    const sortedReports = useMemo(() => {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();

        let filtered = [...reports].filter(r => {
            const status = r.lifecycleStatus || r.status;
            if (status === "resolved") return (now - r.timestamp) < ONE_DAY_MS;
            return true;
        });

        if (categoryFilter !== "all") {
            filtered = filtered.filter(r => r.category === categoryFilter);
        }
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }, [reports, categoryFilter]);

    const canModerate = role === "lgu" || role === "admin";

    const handleAddComment = async () => {
        if (!selectedReport || !commentText.trim()) return;
        const currentAuthorName = user?.displayName?.trim() || (role === "admin" ? "Admin" : role === "lgu" ? "LGU Officer" : "Citizen");
        await addComment(selectedReport._id, {
            authorName: currentAuthorName,
            authorRole: role ?? "user",
            message: commentText.trim(),
        });
        setCommentText("");
    };

    const handleStatusUpdate = async (status: "pending" | "on_the_way" | "resolved" | "false_report" | "needs_verification") => {
        if (!selectedReport) return;
        await updateLifecycleStatus(selectedReport._id, status);
    };

    const handleManualBluetoothShare = async () => {
        if (!selectedReport) return;
        setIsBroadcasting(true);
        try {
            // Drop heavy images before sending via BT to ensure reliable delivery
            const payload = { ...selectedReport, imageDataUrl: undefined };
            const success = await broadcastReportViaBluetooth(payload);
            if (success) {
                alert("Bluetooth sharing started. Keep the app open while another nearby device is in range.");
            } else {
                alert("Bluetooth transfer is not available right now. On Android, please allow Bluetooth and Location permissions for this app, turn on Bluetooth, and try again from a native build.");
            }
        } catch (error) {
            console.error("Bluetooth sharing error:", error);
            alert("An error occurred during Bluetooth transfer.");
        } finally {
            setIsBroadcasting(false);
        }
    };

    // Helper to determine exact sync UI state
    const getSyncStateUI = (report: any) => {
        if (report.synced) return { label: "Cloud Synced", icon: Cloud, styles: "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-400" };
        if (report.origin === "peer") return { label: "Relayed via Mesh", icon: Network, styles: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" };
        return { label: "Queued Offline", icon: WifiOff, styles: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" };
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 font-sans">
            {/* HEADER SECTION */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Reports Feed</p>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Community Intel</h1>
                </div>
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 hover:shadow-red-600/40 active:scale-95"
                >
                    <ShieldAlert className="h-5 w-5 transition-transform group-hover:scale-110" />
                    Report Emergency
                </button>
            </div>

            {syncNotice && (
                <div className="mb-5 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 shadow-sm dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-300">
                    <Bluetooth className="h-4 w-4" />
                    <span>{syncNotice}</span>
                </div>
            )}

            {/* COLOR-CODED FEED CATEGORY FILTER ROW */}
            <div className={`mb-6 flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar border-b border-slate-200 dark:border-slate-800 ${selectedReport ? 'hidden lg:flex' : 'flex'}`}>
                {filterTabs.map(tab => {
                    const config = categoryConfig[tab] || categoryConfig.all;
                    const isActive = categoryFilter === tab;

                    return (
                        <button
                            key={tab}
                            onClick={() => setCategoryFilter(tab)}
                            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${isActive
                                ? `${config.bg} ${config.color} ${config.border} shadow-sm scale-105`
                                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {config.label}
                        </button>
                    )
                })}
            </div>

            {/* EMERGENCY FORM MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6 overflow-hidden">
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-200">
                        <ReportForm onClose={() => setIsModalOpen(false)} />
                    </div>
                </div>
            )}

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">

                {/* LEFT COLUMN: FEED LIST */}
                <div className={`order-2 lg:order-1 lg:col-span-7 xl:col-span-8 space-y-4 ${selectedReport ? 'hidden lg:block' : 'block'}`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Submissions</h2>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {sortedReports.length} {categoryFilter !== 'all' ? categoryFilter : 'total'}
                        </span>
                    </div>

                    <div className="space-y-4">
                        {sortedReports.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                <FilePlus2 className="mb-4 h-10 w-10 text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No active reports match this filter</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Modify your category selection or report a new incident.</p>
                            </div>
                        ) : (
                            sortedReports.map((report) => {
                                const isSelected = selectedReport?._id === report._id;
                                const statusConfig = statusLabelMap[report.lifecycleStatus ?? "pending"] || statusLabelMap.pending;
                                const catConfig = categoryConfig[report.category] || categoryConfig.status;
                                const syncUI = getSyncStateUI(report);
                                const SyncIcon = syncUI.icon;

                                return (
                                    <button
                                        key={report._id}
                                        type="button"
                                        onClick={() => setSelectedReportId(isSelected ? null : report._id)}
                                        className={`w-full group flex flex-col gap-3 rounded-[1.5rem] border p-4 sm:p-5 text-left transition-all duration-200 ${isSelected
                                            ? "border-teal-500 bg-teal-50/30 shadow-md ring-1 ring-teal-500 dark:border-teal-500 dark:bg-teal-900/10"
                                            : "border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
                                            }`}
                                    >
                                        <div className="flex w-full items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex w-full items-start justify-between gap-4 mb-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}>
                                                            {catConfig.label}
                                                        </span>
                                                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusConfig.color}`}>
                                                            {statusConfig.label}
                                                        </span>
                                                    </div>

                                                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                                                        <SyncIcon className={`w-3.5 h-3.5 ${report.synced ? 'text-teal-500' : report.origin === 'peer' ? 'text-blue-500' : 'text-amber-500'}`} />
                                                        <Clock3 className="h-3.5 w-3.5 ml-1" />
                                                        {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{report.title}</h3>
                                                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                                    {report.description || report.locationText || "No details provided."}
                                                </p>
                                            </div>

                                            {report.imageDataUrl && (
                                                <div className="shrink-0 relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hidden sm:block mt-8">
                                                    <img src={report.imageDataUrl} alt="Thumbnail" className="h-full w-full object-cover" loading="lazy" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex w-full items-center justify-between">
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <span className="truncate max-w-[150px] sm:max-w-xs">
                                                        {report.locationText || report.address || `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                                                    </span>
                                                </span>
                                                {report.comments && report.comments.length > 0 && (
                                                    <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 shrink-0">
                                                        <MessageSquare className="h-4 w-4" />
                                                        {report.comments.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight className={`h-5 w-5 shrink-0 transition-transform duration-200 ${isSelected ? "rotate-90 text-teal-500" : "text-slate-300 group-hover:text-teal-400"}`} />
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: DETAILS */}
                <div className={`order-1 lg:order-2 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 ${!selectedReport ? 'hidden lg:block' : 'block'}`}>
                    {selectedReport && (
                        <button
                            className="lg:hidden mb-4 flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl shadow-sm"
                            onClick={() => setSelectedReportId(null)}
                        >
                            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Intelligence Feed
                        </button>
                    )}

                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <ShieldAlert className="h-5 w-5 text-teal-500" />
                                <h2 className="text-lg font-bold">Report Profile</h2>
                            </div>
                            {selectedReport && (
                                (() => {
                                    const syncUI = getSyncStateUI(selectedReport);
                                    const SyncIcon = syncUI.icon;
                                    return (
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${syncUI.styles}`}>
                                            <SyncIcon className="w-3 h-3" />
                                            {syncUI.label}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        {selectedReport ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <div className="mb-3">
                                        <span className={`inline-block rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${categoryConfig[selectedReport.category]?.bg || categoryConfig.status.bg} ${categoryConfig[selectedReport.category]?.color || categoryConfig.status.color} ${categoryConfig[selectedReport.category]?.border || categoryConfig.status.border}`}>
                                            {categoryConfig[selectedReport.category]?.label || selectedReport.category}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{selectedReport.title}</h3>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                        {selectedReport.description || selectedReport.locationText || "No additional text description provided."}
                                    </p>

                                    {selectedReport.imageDataUrl && (
                                        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-950 flex justify-center p-1">
                                            <img
                                                src={selectedReport.imageDataUrl}
                                                alt="Incident documentation"
                                                className="w-full max-h-72 object-contain rounded-xl"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* BLUETOOTH MANUAL SHARE FALLBACK */}
                                {!selectedReport.synced && selectedReport.origin === 'local' && (
                                    <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                                        <div className="flex flex-col items-center text-center gap-2">
                                            <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                                                <Bluetooth className="h-5 w-5" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Offline Manual Transfer</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 px-2">
                                                Internet is down. Ditto mesh is searching in the background, but you can manually beam this to a nearby device.
                                            </p>
                                            <button
                                                onClick={handleManualBluetoothShare}
                                                disabled={isBroadcasting}
                                                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                                            >
                                                {isBroadcasting ? (
                                                    <><Loader2 className="h-4 w-4 animate-spin" /> Beaming...</>
                                                ) : (
                                                    <><Bluetooth className="h-4 w-4" /> Share via Bluetooth</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                                    <div className="flex justify-between items-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusLabelMap[selectedReport.lifecycleStatus ?? "pending"]?.color || statusLabelMap.pending.color}`}>
                                            {statusLabelMap[selectedReport.lifecycleStatus ?? "pending"]?.label || "Pending"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reporter</span>
                                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{selectedReport.reporterName || "Anonymous"}</span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Updates & Log
                                    </h4>

                                    <div className="mb-4 max-h-56 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                        {(selectedReport.comments ?? []).length > 0 ? (
                                            (selectedReport.comments ?? []).map((comment) => (
                                                <div key={comment.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                                    <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-white dark:ring-slate-900"></div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                        {comment.authorName} <span className="opacity-60 lowercase normal-case">({comment.authorRole})</span>
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{comment.message}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                                <p className="text-xs italic text-slate-400">No official updates or comments yet.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <textarea
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            rows={2}
                                            placeholder="Add an update or comment..."
                                            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddComment}
                                            disabled={!commentText.trim()}
                                            className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-sm"
                                        >
                                            Post Update
                                        </button>
                                    </div>
                                </div>

                                {canModerate && (
                                    <div className="rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-950/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Official Actions</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleStatusUpdate("pending")} className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 shadow-sm">Pending</button>
                                            <button onClick={() => handleStatusUpdate("on_the_way")} className="rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-400 shadow-sm">On Way</button>
                                            <button onClick={() => handleStatusUpdate("needs_verification")} className="rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-400 shadow-sm">Verify</button>
                                            <button onClick={() => handleStatusUpdate("false_report")} className="rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/50 dark:text-rose-400 shadow-sm">False</button>
                                        </div>
                                        <button
                                            onClick={() => handleStatusUpdate("resolved")}
                                            className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                                        >
                                            Mark as Resolved
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 dark:bg-slate-950">
                                    <MapPin className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select an incident from the feed<br />to view comprehensive details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}