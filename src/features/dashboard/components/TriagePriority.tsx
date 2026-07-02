// C:\Users\Renz Jericho Buday\KapitBahay\src\features\dashboard\components\TriagePriority.tsx
import { useEffect, useMemo, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore"; // Added updateDoc
import {
    AlertTriangle, ShieldAlert, Flame, Sparkles, Brain,
    MapPin, Shield, Truck, Loader2, LogOut
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

// Extend your LocalReport type locally to include the new DB field
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

    // LGU Authorization Check
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

    // Fail-safe heuristic logic
    const getFallbackTriage = (report: LocalReport, reason: string): TriageAnalysis => {
        const base = report.category === "rescue"
            ? { score: 95, tier: "CRITICAL_ACTION" as const, recommendedUnit: "Ambulance / Search & Rescue" }
            : report.category === "hazard"
                ? { score: 75, tier: "HIGH_ATTENTION" as const, recommendedUnit: "BFP / Fire Team" }
                : { score: 35, tier: "ROUTINE_LOG" as const, recommendedUnit: "Logistics / Engineering" };

        return {
            ...base,
            impactAnalysis: report.synced
                ? `Cloud-backed assessment ready. ${reason}`
                : `Queued offline for dispatch review. ${reason}`,
        };
    };

    // Continuous AI processing queue
    useEffect(() => {
        const executeAITriage = async (report: ReportWithAI) => {
            // 🛑 STOP: If the DB already has the AI Triage, skip generating a new one!
            if (report.aiTriage) return;

            if (!GEMINI_API_KEY) {
                console.warn(`[DEBUG - AI Triage] ⚠️ No API key found. Using fallback for ID: ${report._id}`);
                setAiAssessments(prev => ({ ...prev, [report._id]: getFallbackTriage(report, "AI triage is unavailable, so the report is using the offline dispatch fallback.") }));
                return;
            }

            setActiveAnalysisId(report._id);
            console.log(`[DEBUG - AI Triage] 🤖 Starting AI evaluation for report ID: ${report._id} ("${report.title}")`);

            try {
                const model = genAI.getGenerativeModel({
                    model: "gemini-3.1-flash-lite",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `
                    You are an advanced emergency disaster triage dispatch director evaluating community intelligence reports.
                    Analyze this report to establish response priority based on immediate threats to human life, entrapment, medical status, or cascading infrastructure failure.
                    
                    Incident Category: ${report.category}
                    Incident Title: ${report.title}
                    Description Details: ${report.description || "No description given."}
                    Attached Reference Location: ${report.locationText || "GPS Coordinates Pinpointed"}
                    
                    Respond strictly with a JSON object using this schema:
                    {"score": <number 1-100>, "tier": "CRITICAL_ACTION" | "HIGH_ATTENTION" | "ROUTINE_LOG", "impactAnalysis": "<1-sentence impact statement>", "recommendedUnit": "<Specific Emergency Unit Name>"}
                `;

                console.log(`[DEBUG - AI Triage] 📡 Sending prompt to Gemini...`);
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                const analysis = JSON.parse(responseText) as TriageAnalysis;
                console.log(`[DEBUG - AI Triage] ✅ Successfully parsed AI analysis:`, analysis);

                // 1. Update the UI state immediately
                setAiAssessments(prev => ({ ...prev, [report._id]: analysis }));

                // 2. Save the AI result to Firebase so we NEVER have to run AI for this report again
                if (report.synced) {
                    try {
                        await updateDoc(doc(db, "reports", report._id), { aiTriage: analysis });
                        console.log(`[DEBUG - AI Triage] 💾 Permanently saved AI Data to Database for ID: ${report._id}`);
                    } catch (dbErr) {
                        console.error(`[DEBUG - AI Triage] ⚠️ DB save failed, but UI is updated:`, dbErr);
                    }
                }

            } catch (err) {
                console.error(`[DEBUG - AI Triage] ❌ AI evaluation failed for ID ${report._id}:`, err);
                setAiAssessments(prev => ({ ...prev, [report._id]: getFallbackTriage(report, "The AI model failed, so the report remains queued for manual dispatch review.") }));
            } finally {
                setActiveAnalysisId(null);
            }
        };

        // Find the next report that DOES NOT have DB data (r.aiTriage) and DOES NOT have local state data
        const nextInQueue = (reports as ReportWithAI[]).find(
            r => !r.aiTriage && !aiAssessments[r._id] && r.lifecycleStatus !== "resolved" && r.lifecycleStatus !== "false_report"
        );

        if (nextInQueue && !activeAnalysisId) {
            console.log(`[DEBUG - AI Triage] 🚨 New offline report detected. Handing to AI: ID ${nextInQueue._id}`);
            executeAITriage(nextInQueue);
        }
    }, [reports, aiAssessments, activeAnalysisId]);

    // Matrix structuring
    const structuredTriageData = useMemo(() => {
        return (reports as ReportWithAI[])
            .filter(r => r.lifecycleStatus !== "resolved" && r.lifecycleStatus !== "false_report")
            .map(r => ({
                ...r,
                // UI Priority Order: 1. Data from Database -> 2. Data from active AI run -> 3. Fallback logic
                triage: r.aiTriage || aiAssessments[r._id] || getFallbackTriage(r, "The report is still waiting for its first triage evaluation.")
            }));
    }, [reports, aiAssessments]);

    // Column splitting
    const columns = useMemo(() => {
        return {
            CRITICAL_ACTION: structuredTriageData.filter(r => r.triage.tier === "CRITICAL_ACTION"),
            HIGH_ATTENTION: structuredTriageData.filter(r => r.triage.tier === "HIGH_ATTENTION"),
            ROUTINE_LOG: structuredTriageData.filter(r => r.triage.tier === "ROUTINE_LOG")
        };
    }, [structuredTriageData]);

    const handleSetStatus = async (reportId: string, status: ReportLifecycleStatus) => {
        setUpdatingId(reportId);
        await updateLifecycleStatus(reportId, status);
        setUpdatingId(null);
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
                            columns.CRITICAL_ACTION.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} />)
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
                            columns.HIGH_ATTENTION.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} />)
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
                            columns.ROUTINE_LOG.map(r => <TriageCard key={r._id} report={r} onSetStatus={handleSetStatus} isUpdating={updatingId === r._id} />)
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// TRIAGE CARD INNER COMPONENT MODULE
function TriageCard({ report, onSetStatus, isUpdating }: { report: any; onSetStatus: (id: string, status: ReportLifecycleStatus) => void; isUpdating: boolean }) {

    return (
        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start gap-2">
                <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        SCORE VALUE: {report.triage.score}/100
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
                    {report.triage.impactAnalysis}
                </p>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-teal-500" />
                    <span>Recommended unit: <strong className="text-slate-700 dark:text-slate-200">{report.triage.recommendedUnit}</strong></span>
                </div>
            </div>

            {/* LOCATION BLOCK */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{report.locationText || "GPS Coordinates Attached"}</span>
            </div>

            {/* LGU AUTHORITY TOOLS (Mirrored from PublicMap) */}
            <div className="mt-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    {isUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isUpdating ? "Updating System..." : "Authority Tools"}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    <button disabled={isUpdating} onClick={() => onSetStatus(report._id, "pending")} className="rounded-lg bg-white py-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300 transition-opacity disabled:opacity-50">Pending</button>
                    <button disabled={isUpdating} onClick={() => onSetStatus(report._id, "on_the_way")} className="rounded-lg bg-blue-50 py-1 text-[10px] font-bold text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-400 transition-opacity disabled:opacity-50">On Way</button>
                    <button disabled={isUpdating} onClick={() => onSetStatus(report._id, "false_report")} className="rounded-lg bg-red-50 py-1 text-[10px] font-bold text-red-600 shadow-sm dark:bg-red-950/30 dark:text-red-400 transition-opacity disabled:opacity-50">False</button>
                    <button disabled={isUpdating} onClick={() => onSetStatus(report._id, "resolved")} className="rounded-lg bg-emerald-500 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-400 transition-opacity disabled:opacity-50">Solved</button>
                </div>
            </div>
        </div>
    );
}