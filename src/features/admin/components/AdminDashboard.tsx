import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
  Activity,
  Network,
  ShieldCheck,
  Database,
  AlertTriangle,
} from "lucide-react";

interface PendingLgu {
  id: string;
  orgName?: string;
  contactPerson?: string;
  email: string;
  createdAt?: string;
}

interface AdminEvent {
  id: string;
  title: string;
  detail: string;
  tone: "sync" | "auth" | "alert";
  timestamp: string;
}

export default function AdminDashboard() {
  const [pendingLgus, setPendingLgus] = useState<PendingLgu[]>([]);
  const [verifiedLguCount, setVerifiedLguCount] = useState(0);
  const [activeReportCount, setActiveReportCount] = useState(0);
  const [syncedReportCount, setSyncedReportCount] = useState(0);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pendingQuery = query(collection(db, "users"), where("role", "==", "lgu"), where("verified", "==", false));
    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const lgus: PendingLgu[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          orgName: data.orgName || "Unnamed LGU Hub",
          contactPerson: data.contactPerson || "No Contact Person Listed",
          email: data.email || "No email provided",
          createdAt: data.createdAt,
        };
      });
      setPendingLgus(lgus);
      setIsLoading(false);
    }, (error) => {
      console.error("Error reading pending database loops:", error);
    });

    const verifiedQuery = query(collection(db, "users"), where("role", "==", "lgu"), where("verified", "==", true));
    const unsubscribeVerified = onSnapshot(verifiedQuery, (snapshot) => {
      setVerifiedLguCount(snapshot.size);
    });

    const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportDocs = snapshot.docs;
      const activeReports = reportDocs.filter((item) => {
        const status = item.data().status;
        return status !== "resolved" && status !== "verified";
      });
      const syncedReports = reportDocs.filter((item) => item.data().synced === true);

      const recentEvents: AdminEvent[] = reportDocs.slice(0, 6).map((item) => {
        const data = item.data();
        const status = data.status || "pending";
        const tone = status === "resolved" ? "sync" : status === "verified" ? "auth" : "alert";
        return {
          id: item.id,
          title: `${data.type || "report"} ${status}`,
          detail: data.description || "No description logged",
          tone,
          timestamp: data.timestamp || data.createdAt || Date.now(),
        };
      });

      setActiveReportCount(activeReports.length);
      setSyncedReportCount(syncedReports.length);
      setEvents(recentEvents);
    }, (error) => {
      console.error("Error reading report telemetry:", error);
    });

    return () => {
      unsubscribePending();
      unsubscribeVerified();
      unsubscribeReports();
    };
  }, []);

  const handleVerify = async (id: string) => {
    try {
      const docRef = doc(db, "users", id);
      await updateDoc(docRef, { verified: true });
    } catch (error) {
      console.error("Verification transaction failed:", error);
    }
  };

  const handleReject = async (id: string) => {
    if (window.confirm("Are you sure you want to discard this LGU registration request?")) {
      try {
        const docRef = doc(db, "users", id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Rejection cleanup tracking loop failed:", error);
      }
    }
  };

  const formatTime = (value: string | number) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "just now";
    }
    return date.toLocaleString();
  };

  return (
    <div className="p-4 sm:p-8 h-full flex flex-col">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-red-900/30">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            System <span className="text-red-500">Monitor</span>
          </h1>
          <p className="text-[#94A3B8] text-sm font-medium mt-1">
            Live telemetry from reports, LGU approvals, and sync activity
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          Live Telemetry
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Active Reports
            </p>
            <Network className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{activeReportCount}</p>
          <p className="text-xs text-teal-400 mt-2">Current incident queue</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Verified LGUs
            </p>
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{verifiedLguCount}</p>
          <p className="text-xs text-[#94A3B8] mt-2">{pendingLgus.length} pending approval</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-red-900/50 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
              Pending Approvals
            </p>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{pendingLgus.length}</p>
          <p className="text-xs text-red-400 mt-2">Needs admin review</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Reports Synced
            </p>
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{syncedReportCount}</p>
          <p className="text-xs text-indigo-400 mt-2">Cloud-backed operations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 flex flex-col min-h-[340px]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Pending LGU Approvals
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1 max-h-[400px]">
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm font-mono animate-pulse">
                POLLING INCOMING COMMAND REQUESTS...
              </div>
            ) : pendingLgus.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                🎉 No open verification requests in triage queue.
              </div>
            ) : (
              pendingLgus.map((lgu) => (
                <div
                  key={lgu.id}
                  className="p-4 bg-slate-50 dark:bg-[#050E1F] border border-slate-200 dark:border-[#1E293B] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-700"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{lgu.orgName}</p>
                    <p className="text-xs text-teal-400 font-semibold mt-0.5">{lgu.contactPerson}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{lgu.email}</p>
                    {lgu.createdAt && (
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">
                        Registered: {new Date(lgu.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleReject(lgu.id)}
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-bold transition-colors border border-red-500/20"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleVerify(lgu.id)}
                      className="px-3 py-1.5 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 rounded text-xs font-bold transition-colors border border-teal-500/20"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Real-time Event Log
          </h2>
          <div className="flex-1 bg-slate-50 dark:bg-[#050E1F] border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 font-mono text-xs text-[#94A3B8] overflow-y-auto space-y-2 max-h-[400px]">
            {events.length === 0 ? (
              <p className="text-slate-500">No activity yet.</p>
            ) : events.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 dark:border-[#1E293B] bg-white/60 dark:bg-[#0D1B35]/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`font-bold ${event.tone === "alert" ? "text-red-400" : event.tone === "auth" ? "text-amber-400" : "text-teal-400"}`}>
                    [{event.tone.toUpperCase()}]
                  </span>
                  <span className="text-[10px] text-slate-500">{formatTime(event.timestamp)}</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-white">{event.title}</p>
                <p className="text-slate-500 mt-1">{event.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}