// C:\Users\Renz Jericho Buday\KapitBahay\src\features\dashboard\components\TriagePriority.tsx
import { useEffect, useMemo, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    AlertTriangle, ShieldAlert, HeartHandshake, LifeBuoy, Home,
    Clock, CheckCircle, Flame, AlertCircle, Sparkles, Brain,
    MapPin, Shield, CheckCircle2, User, ChevronRight, Truck, Loader2
} from "lucide-react";
import { useReportsStore } from "../../../store/useReportsStore";
import type { LocalReport, ReportLifecycleStatus } from "../../../lib/indexedDb";

type TriageTier = "CRITICAL_ACTION" | "HIGH_ATTENTION" | "ROUTINE_LOG";

interface TriageAnalysis {
    score: number;        // Explicit 1-100 severity calculation
    tier: TriageTier;     // Visual action pipeline column
    impactAnalysis: string; // Brief impact summary
    recommendedUnit: string; // Recommended dispatch asset (e.g. Medical, Fire, Logistics, Engineering)
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function TriagePriority() {
    const { reports, hydrateReports, startLiveStream, updateLifecycleStatus } = useReportsStore();
    const [aiAssessments, setAiAssessments] = useState<Record<string, TriageAnalysis>>({});
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        hydrateReports();
        const unsubscribe = startLiveStream();
        return () => unsubscribe();
    }, [hydrateReports, startLiveStream]);

    // Fail-safe programmatic matrix for offline LGU state or fallback processing
    const getHeuristicTriage = (report: LocalReport): TriageAnalysis => {
        if (report.category === "rescue") {
            return { score: 95, tier: "CRITICAL_ACTION", impactAnalysis: "Immediate life safety threat detected.", recommendedUnit: "Ambulance / Search & Rescue" };
        }
        if (report.category === "hazard") {
            return { score: 75, tier: "HIGH_ATTENTION", impactAnalysis: "Environmental hazard requires active isolation.", recommendedUnit: "BFP / Fire Team" };
        }
        return { score: 35, tier: "ROUTINE_LOG", impactAnalysis: "Standard infrastructure log item.", recommendedUnit: "Logistics / Engineering" };
    };

    // The true AI evaluation engine running against report context details
    const executeAITriage = async (report: LocalReport) => {
        if (!GEMINI_API_KEY) {
            setAiAssessments(prev => ({ ...prev, [report._id]: getHeuristicTriage(report) }));
            return;
        }

        setActiveAnalysisId(report._id);
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });
            const prompt = `
        You are an advanced emergency disaster triage dispatch director evaluating community intelligence reports.
        Analyze this report to establish response priority based on immediate threats to human life, entrapment, medical status, or cascading infrastructure failure.
        
        Incident Category: ${report.category}
        Incident Title: ${report.title}
        Description Details: ${report.description || "No description given."}
        Attached Reference Location: ${report.locationText || "GPS Coordinates Pinpointed"}
        
        Respond ONLY with a single minified JSON object matching this schema precisely:
        {"score":number,"tier":"CRITICAL_ACTION"|"HIGH_ATTENTION"|"ROUTINE_LOG","impactAnalysis":"1-sentence field impact statement","recommendedUnit":"Specific Emergency Unit Name"}
      `;

            const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
            const responseText = result.response.text?.() || "{}";

            const jsonStart = responseText.indexOf("{");
            const jsonEnd = responseText.lastIndexOf("}") + 1;
            const cleanJson = responseText.substring(jsonStart, jsonEnd);

            const analysis = JSON.parse(cleanJson) as TriageAnalysis;
            setAiAssessments(prev => ({ ...prev, [report._id]: analysis }));
        } catch (err) {
            console.error("AI Context evaluation engine dropped script parsing:", err);
            setAiAssessments(prev => ({ ...prev, [report._id]: getHeuristicTriage(report) }));
        } finally {
            setActiveAnalysisId(null);
        }
    };

    // Continuous background evaluator check loop hook
    useEffect(() => {
        const nextInQueue = reports.find(r => !aiAssessments[r._id]);
        if (nextInQueue && !activeAnalysisId) {
            executeAITriage(nextInQueue);
        }
    }, [reports, aiAssessments, activeAnalysisId]);

    // Combine database logs with contextual AI matrices values
    const structuredTriageData = useMemo(() => {
        return reports.map(r => ({
            ...r,
            triage: aiAssessments[r._id] || {
                score: r.category === "rescue" ? 90 : r.category === "hazard" ? 70 : 30,
                tier: r.category === "rescue" ? "CRITICAL_ACTION" as const : r.category === "hazard" ? "HIGH_ATTENTION" as const : "ROUTINE_LOG" as const,
                impactAnalysis: "Processing intelligence context...",
                recommendedUnit: "Analyzing..."
            }
        })).filter(r => r.lifecycleStatus !== "resolved" && r.lifecycleStatus !== "false_report");
    }, [reports, aiAssessments]);

    // Split into actionable triage boards
    const columns = useMemo(() => {
        return {
            CRITICAL_ACTION: structuredTriageData.filter(r => r.triage.tier === "CRITICAL_ACTION"),
            HIGH_ATTENTION: structuredTriageData.filter(r => r.triage.tier === "HIGH_ATTENTION"),
            ROUTINE_LOG: structuredTriageData.filter(r => r.triage.tier === "ROUTINE_LOG")
        };
    }, [structuredTriageData]);

    // LGU Full Authority Action Handler
    const handleSetStatus = async (reportId: string, status: ReportLifecycleStatus) => {
        setUpdatingId(reportId);
        await updateLifecycleStatus(reportId, status);
        setUpdatingId(null);
    };

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