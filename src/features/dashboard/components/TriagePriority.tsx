// C:\Users\Renz Jericho Buday\KapitBahay\src\features\dashboard\components\TriagePriority.tsx
import { useEffect, useMemo, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
    AlertTriangle, ShieldAlert, Flame, Sparkles, Brain,
    MapPin, Shield, Truck, Loader2, LogOut, CheckCircle2
} from "lucide-react";
import { useReportsStore } from "../../../store/useReportsStore";
import type { LocalReport, ReportLifecycleStatus } from "../../../lib/indexedDb";
import { auth, db } from "../../../lib/firebase";
import { useAuth } from "../../../App";

type TriageTier = "CRITICAL_ACTION" | "HIGH_ATTENTION" | "ROUTINE_LOG";

export interface TriageAnalysis {
    score: number;
    tier: TriageTier;
    impactAnalysis: string;
    recommendedUnit: string;
}

type ReportWithAI = LocalReport & { aiTriage?: TriageAnalysis };

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function TriagePriority() {
    const { reports, hydrateReports, startLiveStream, updateLifecycleStatus } = useReportsStore();
    const { user, role } = useAuth();

    const [aiAssessments, setAiAssessments] = useState<Record<string, TriageAnalysis>>({});
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [approvalStatus, setApprovalStatus] = useState<"checking" | "approved" | "pending">("checking");

    // Optimistic UI States for instant feedback
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const verifyLguAccess = async () => {
            if (!user || role !== "lgu") {
                if (!cancelled) setApprovalStatus("pending");
                return;
            }

            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (!cancelled) {
                    setApprovalStatus(docSnap.exists() && docSnap.data().verified === true ? "approved" : "pending");
                }
            } catch (error) {
                console.error("LGU approval check failed:", error);
                if (!cancelled) setApprovalStatus("pending");
            }
        };

        setApprovalStatus("checking");
        verifyLguAccess();

        hydrateReports();
        const unsubscribe = startLiveStream();

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [hydrateReports, startLiveStream, user, role]);

    const getFallbackTriage = (report: LocalReport, reason: string): TriageAnalysis => {
        const base = report.category === "rescue"
            ? { score: 95, tier: "CRITICAL_ACTION" as const, recommendedUnit: "Ambulance / Search & Rescue" }
            : report.category === "hazard"
                ? { score: 75, tier: "HIGH_ATTENTION" as const, recommendedUnit: "BFP / Fire Team" }
                : { score: 35, tier: "ROUTINE_LOG" as const, recommendedUnit: "Logistics / Engineering" };

        return {
            ...base,
            impactAnalysis: report.synced
                ? `System fallback active. ${reason}`
                : `Queued offline for dispatch review. ${reason}`,
        };
    };

    useEffect(() => {
        const executeAITriage = async (report: ReportWithAI) => {
            if (report.aiTriage) return;

            if (!GEMINI_API_KEY) {
                setAiAssessments(prev => ({ ...prev, [report._id]: getFallbackTriage(report, "AI triage is unavailable due to missing API key.") }));
                return;
            }

            setActiveAnalysisId(report._id);

            try {
                const model = genAI.getGenerativeModel({
                    model: "gemini-3.1-flash-lite",
                    // Forcing JSON response type ensures the model formats its output correctly
                    generationConfig: { responseMimeType: "application/json" }
                });

                // 🔥 OPTIMIZED PROMPT: Clear structure, strict boundaries, and schema enforcement
                const prompt = `
You are an expert emergency disaster triage AI for a community reporting app. Evaluate the incident below and assign a priority tier.

### Categorization Rules:
1. "CRITICAL_ACTION" (Score 80-100): IMMEDIATE threat to human life or critical infrastructure. Examples: active fires with trapped people, severe medical emergencies, structural collapse, active violent threats.
2. "HIGH_ATTENTION" (Score 50-79): Significant hazards and community disruptions without immediate life threat. Examples: flooded streets blocking roads, fallen trees, downed live power lines, broken water mains.
3. "ROUTINE_LOG" (Score 1-49): Minor inconveniences or general status updates. Examples: noise complaints, small potholes, litter, light weather updates.

### Incident Details:
- Category: ${report.category}
- Title: ${report.title}
- Description: ${report.description || "No description provided."}
- Location: ${report.locationText || "GPS Coordinates Attached"}

### Output Format:
Respond strictly with a valid JSON object matching this exact schema. Do not include any markdown formatting or extra text.
{
  "score": <number between 1-100>,
  "tier": "<Must be exactly CRITICAL_ACTION, HIGH_ATTENTION, or ROUTINE_LOG>",
  "impactAnalysis": "<A sharp, 1-sentence analytical assessment of the situation's impact>",
  "recommendedUnit": "<Specific Unit Name, e.g., Ambulance, BFP, PNP, Public Works, Barangay Rescue, or Standby>"
}`;

                const result = await model.generateContent(prompt);
                let responseText = result.response.text();

                // Fallback cleanup just in case the model ignores the "no markdown" rule
                responseText = responseText.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '').trim();

                const analysis = JSON.parse(responseText) as TriageAnalysis;

                setAiAssessments(prev => ({ ...prev, [report._id]: analysis }));

                if (report.synced) {
                    try {
                        await updateDoc(doc(db, "reports", report._id), { aiTriage: analysis });
                    } catch (dbErr) {
                        console.error(`[DEBUG - AI Triage] ⚠️ DB save failed:`, dbErr);
                    }
                }

            } catch (err: any) {
                console.error(`[DEBUG - AI Triage] ❌ AI CRASH for ID ${report._id}. Reason:`, err?.message || err);
                setAiAssessments(prev => ({ ...prev, [report._id]: getFallbackTriage(report, "The AI API request failed or timed out.") }));
            } finally {
                setActiveAnalysisId(null);
            }
        };

        const nextInQueue = (reports as ReportWithAI[]).find(r => {
            const currentStatus = optimisticStatuses[r._id] || r.lifecycleStatus || r.status;
            return !r.aiTriage && !aiAssessments[r._id] && currentStatus !== "resolved" && currentStatus !== "false_report" && !hiddenIds.has(r._id);
        });

        if (nextInQueue && !activeAnalysisId) {
            executeAITriage(nextInQueue);
        }
    }, [reports, aiAssessments, activeAnalysisId, hiddenIds, optimisticStatuses]);

    const structuredTriageData = useMemo(() => {
        return (reports as ReportWithAI[])
            .filter(r => {
                const currentStatus = optimisticStatuses[r._id] || r.lifecycleStatus || r.status;
                return currentStatus !== "resolved" && currentStatus !== "false_report" && !hiddenIds.has(r._id);
            })
            .map(r => ({
                ...r,
                triage: r.aiTriage || aiAssessments[r._id] || getFallbackTriage(r, "Waiting in queue for AI evaluation.")
            }));
    }, [reports, aiAssessments, hiddenIds, optimisticStatuses]);

    const columns = useMemo(() => {
        return {
            CRITICAL_ACTION: structuredTriageData.filter(r => r.triage.tier === "CRITICAL_ACTION"),
            HIGH_ATTENTION: structuredTriageData.filter(r => r.triage.tier === "HIGH_ATTENTION"),
            ROUTINE_LOG: structuredTriageData.filter(r => r.triage.tier === "ROUTINE_LOG")
        };
    }, [structuredTriageData]);

    const handleSetStatus = async (reportId: string, status: ReportLifecycleStatus) => {
        setUpdatingId(reportId);
        setOptimisticStatuses(prev => ({ ...prev, [reportId]: status }));

        if (status === "resolved" || status === "false_report") {
            setHiddenIds(prev => new Set(prev).add(reportId));
        }

        try {
            await updateLifecycleStatus(reportId, status);

            if (navigator.onLine) {
                const reportRef = doc(db, "reports", reportId);
                await updateDoc(reportRef, {
                    lifecycleStatus: status,
                    status: status,
                    synced: true
                });
            }
        } catch (error) {
            console.error(`[DEBUG - DB Sync] ❌ Failed to update status:`, error);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleExit = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Could not sign out LGU user:", error);
        }
    };

    if (approvalStatus === "checking") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050E1F] p-4">
                <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-[#0D1B35]">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Checking command access</p>
                </div>
            </div>
        );
    }

    if (approvalStatus === "pending") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050E1F] p-4">
                <div className="w-full max-w-md rounded-[2rem] border border-amber-200 bg-white p-6 text-center shadow-xl dark:border-amber-500/30 dark:bg-[#0D1B35]">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Access Pending</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your LGU command account is waiting for admin approval. You can stay here until approval is granted, or exit for now.</p>
                    <button
                        type="button"
                        onClick={handleExit}
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:border-slate-700 dark:bg-slate-800"
                    >
                        <LogOut className="h-4 w-4" />
                        Exit
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">

            {/* HEADER OPERATIONS PORTAL TITLE BOARD */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="space-y-1 z-10">
                    <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-widest">
                        <Brain className="w-4 h-4" /> Cognitive Incident Triage Active
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Triage Priority Matrix</h1>
                    <p className="text-xs text-slate-400 max-w-xl">
                        Gemini AI continuously cross-references unverified local/mesh descriptions to map immediate dispatch priority actions automatically.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 px-4 py-3 rounded-2xl z-10 shrink-0">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {activeAnalysisId ? "AI Parsing Content..." : "Triage Streams Synchronized"}
                    </span>
                </div>
                <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-10 pointer-events-none">
                    <Sparkles className="w-40 h-40 text-white" />
                </div>
            </div>

            {/* THREE-COLUMN INTERACTIVE TRIAGE BOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* COLUMN 1: CRITICAL ACTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl">
                        <span className="text-xs font-black tracking-wider text-red-500 uppercase flex items-center gap-2">
                            <Flame className="w-4 h-4 animate-bounce" /> Critical Actions Required
                        </span>
                        <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-xl shadow-sm">
                            {columns.CRITICAL_ACTION.length}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                        {columns.CRITICAL_ACTION.length === 0 ? (
                            <p className="text-xs text-center text-slate-400 py-6 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">No critical threats found.</p>
                        ) : (
                            columns.CRITICAL_ACTION.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} optimisticStatus={optimisticStatuses[r._id]} />)
                        )}
                    </div>
                </div>

                {/* COLUMN 2: HIGH ATTENTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl">
                        <span className="text-xs font-black tracking-wider text-amber-500 uppercase flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> High Attention Queue
                        </span>
                        <span className="bg-amber-500 text-slate-900 text-xs font-black px-2.5 py-0.5 rounded-xl shadow-sm">
                            {columns.HIGH_ATTENTION.length}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                        {columns.HIGH_ATTENTION.length === 0 ? (
                            <p className="text-xs text-center text-slate-400 py-6 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">High attention logs clear.</p>
                        ) : (
                            columns.HIGH_ATTENTION.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} optimisticStatus={optimisticStatuses[r._id]} />)
                        )}
                    </div>
                </div>

                {/* COLUMN 3: ROUTINE LOGS */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-2xl">
                        <span className="text-xs font-black tracking-wider text-blue-500 uppercase flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Routine Area Monitoring
                        </span>
                        <span className="bg-blue-500 text-white text-xs font-black px-2.5 py-0.5 rounded-xl shadow-sm">
                            {columns.ROUTINE_LOG.length}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                        {columns.ROUTINE_LOG.length === 0 ? (
                            <p className="text-xs text-center text-slate-400 py-6 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">No general monitoring tracking.</p>
                        ) : (
                            columns.ROUTINE_LOG.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} optimisticStatus={optimisticStatuses[r._id]} />)
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// TRIAGE CARD INNER COMPONENT MODULE
function TriageCard({ report, onSetStatus, isUpdating, optimisticStatus }: { report: any; onSetStatus: (id: string, status: ReportLifecycleStatus) => void; isUpdating: boolean; optimisticStatus?: string; }) {

    const currentStatus = optimisticStatus || report.lifecycleStatus || report.status || "pending";

    return (
        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        SCORE VALUE: {report.triage?.score || 0}/100
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                        {report.title}
                    </h4>
                </div>
                <div className="h-2 w-2 rounded-full shrink-0 mt-1 bg-teal-500" title="Active track" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-900/60 shadow-inner">
                {report.description || "No text context summary supplied."}
            </p>

            {/* AI EXTRACTION DETAILS PANEL */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <div className="text-[9px] font-black tracking-widest text-teal-500 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Impact Vector Estimate
                </div>
                <p className="text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-300">
                    {report.triage?.impactAnalysis || "Pending..."}
                </p>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-teal-500" />
                    <span>Recommended unit: <strong className="text-slate-700 dark:text-slate-200">{report.triage?.recommendedUnit || "Standby"}</strong></span>
                </div>
            </div>

            {/* LOCATION BLOCK */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{report.locationText || "GPS Coordinates Attached"}</span>
            </div>

            {/* LGU AUTHORITY TOOLS */}
            <div className="mt-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    {isUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isUpdating ? "Updating System..." : "Authority Tools"}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {/* Pending Button */}
                    <button
                        disabled={isUpdating}
                        onClick={() => onSetStatus(report._id, "pending")}
                        className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 ${currentStatus === "pending" || currentStatus === "synced"
                            ? "bg-slate-700 text-white dark:bg-slate-600"
                            : "bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            }`}
                    >
                        {currentStatus === "pending" || currentStatus === "synced" ? <CheckCircle2 className="w-3 h-3" /> : null}
                        Pending
                    </button>

                    {/* On Way Button */}
                    <button
                        disabled={isUpdating}
                        onClick={() => onSetStatus(report._id, "on_the_way")}
                        className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 ${currentStatus === "on_the_way"
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                            }`}
                    >
                        {currentStatus === "on_the_way" ? <CheckCircle2 className="w-3 h-3" /> : null}
                        On Way
                    </button>

                    {/* False Button */}
                    <button
                        disabled={isUpdating}
                        onClick={() => onSetStatus(report._id, "false_report")}
                        className="rounded-lg bg-red-50 py-1.5 text-[10px] font-bold text-red-600 shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                    >
                        False
                    </button>

                    {/* Solved Button */}
                    <button
                        disabled={isUpdating}
                        onClick={() => onSetStatus(report._id, "resolved")}
                        className="rounded-lg bg-emerald-500 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                    >
                        Solved
                    </button>
                </div>
            </div>
        </div>
    );
}