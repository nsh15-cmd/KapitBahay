import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
  Activity,
  Network,
  ShieldCheck,
  ServerCrash,
  Database,
} from "lucide-react";

interface PendingLgu {
  id: string;
  orgName?: string;
  contactPerson?: string;
  email: string;
  createdAt?: string;
}

export default function AdminDashboard() {
  const [pendingLgus, setPendingLgus] = useState<PendingLgu[]>([]);
  const [totalLgusCount, setTotalLgusCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize dynamic counts and active queue lists from the database live
  useEffect(() => {
    // 1. Fetch only unverified LGUs for the verification stack queue list
    const pendingQuery = query(collection(db, "users"), where("role", "==", "lgu"), where("verified", "==", false));
    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const lgus: PendingLgu[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        lgus.push({
          id: doc.id,
          orgName: data.orgName || "Unnamed LGU Hub",
          contactPerson: data.contactPerson || "No Contact Person Listed",
          email: data.email,
          createdAt: data.createdAt
        });
      });
      setPendingLgus(lgus);
      setIsLoading(false);
    }, (error) => {
      console.error("Error reading pending database loops:", error);
    });

    // 2. Stream aggregate totals of verified nodes across system operations
    const totalQuery = query(collection(db, "users"), where("role", "==", "lgu"), where("verified", "==", true));
    const unsubscribeTotal = onSnapshot(totalQuery, (snapshot) => {
      setTotalLgusCount(snapshot.size);
    });

    return () => {
      unsubscribePending();
      unsubscribeTotal();
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

  return (
    <div className="p-4 sm:p-8 h-full flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-red-900/30">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            System <span className="text-red-500">Monitor</span>
          </h1>
          <p className="text-[#94A3B8] text-sm font-medium mt-1">
            Platform-wide Mesh Health & Telemetry
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          Live Telemetry
        </div>
      </header>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Active Mesh Nodes
            </p>
            <Network className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">1,247</p>
          <p className="text-xs text-teal-400 mt-2">↑ 14% from last hour</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Verified LGUs
            </p>
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{totalLgusCount}</p>
          <p className="text-xs text-[#94A3B8] mt-2">{pendingLgus.length} pending approval</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-red-900/50 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
              Offline Clusters
            </p>
            <ServerCrash className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">8</p>
          <p className="text-xs text-red-400 mt-2">Awaiting cloud sync</p>
        </div>

        <div className="bg-white dark:bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              Total Reports Synced
            </p>
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">8,902</p>
          <p className="text-xs text-indigo-400 mt-2">
            Zero conflict resolutions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* LGU Approval Queue */}
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

        {/* System Event Log */}
        <div className="bg-[#0D1B35] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Real-time Event Log
          </h2>
          <div className="flex-1 bg-slate-50 dark:bg-[#050E1F]border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 font-mono text-xs text-[#94A3B8] overflow-y-auto space-y-2 max-h-[400px]">
            <p>
              <span className="text-teal-400">[SYNC]</span> 14:02:44 - Cluster A
              (Malabon) merged 12 offline reports.
            </p>
            <p>
              <span className="text-teal-400">[SYNC]</span> 14:02:10 - Cluster B
              (Navotas) merged 4 offline reports.
            </p>
            <p>
              <span className="text-amber-400">[WARN]</span> 14:01:05 - High
              latency detected on Mesh Node #8892.
            </p>
            <p>
              <span className="text-indigo-400">[AUTH]</span> 14:00:22 - LGU
              Session started: drrmo@malabon.gov.ph
            </p>
            <p>
              <span className="text-red-400">[ERR]</span> 13:58:11 - Sync failed
              for Node #1102: Invalid AES signature.
            </p>
            <p>
              <span className="text-teal-400">[SYNC]</span> 13:55:00 - Master
              database backup completed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}