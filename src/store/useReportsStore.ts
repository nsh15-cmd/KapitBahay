import { create } from "zustand";
import { doc, onSnapshot, orderBy, query, setDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
    getPendingReports,
    saveReportLocally,
    updateReportStatus,
    upsertReportDetails,
    type LocalReport,
    type ReportComment,
    type ReportLifecycleStatus,
} from "../lib/indexedDb";
import { syncEventEmitter } from "../lib/syncEngine";

type ReportAuthorRole = "user" | "lgu" | "admin";
const sanitizeForFirestore = (obj: any) => {
    const sanitized = { ...obj };
    Object.keys(sanitized).forEach((key) => {
        if (sanitized[key] === undefined) {
            delete sanitized[key]; // Firestore hates undefined, so we completely remove the key
        } else if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
            sanitized[key] = sanitizeForFirestore(sanitized[key]); // Recursively clean nested objects like location
        }
    });
    return sanitized;
};
interface ReportsState {
    reports: LocalReport[];
    selectedReportId: string | null;
    isLoading: boolean;
    setSelectedReportId: (id: string | null) => void;
    hydrateReports: () => Promise<void>;
    startLiveStream: () => () => void;
    createReport: (report: LocalReport) => Promise<void>;
    addComment: (reportId: string, comment: Omit<ReportComment, "id" | "createdAt">) => Promise<void>;
    updateLifecycleStatus: (reportId: string, status: ReportLifecycleStatus) => Promise<void>;
}

const buildNextReportSnapshot = (report: LocalReport, patch: Partial<LocalReport>) => ({
    ...report,
    ...patch,
    synced: false,
    status: patch.status ?? "pending",
});

const mergeReports = (current: LocalReport[], incoming: LocalReport[]) => {
    const byId = new Map<string, LocalReport>();

    [...current, ...incoming].forEach((report) => {
        const existing = byId.get(report._id);
        byId.set(report._id, existing ? { ...existing, ...report } : report);
    });

    return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
};

export const useReportsStore = create<ReportsState>((set, get) => ({
    reports: [],
    selectedReportId: null,
    isLoading: false,
    setSelectedReportId: (selectedReportId) => set({ selectedReportId }),
    hydrateReports: async () => {
        set({ isLoading: true });

        const fetchLocal = async () => {
            const localReports = await getPendingReports();
            set({ reports: localReports, isLoading: false }); // Drop mergeReports to let IndexedDB be absolute truth
        };

        await fetchLocal();

        // Automatically re-hydrate when the Mesh daemon ingests new peer data
        syncEventEmitter.addEventListener('mesh-update', fetchLocal);
    },
    startLiveStream: () => {
        const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
            const incoming = snapshot.docs.map((item) => ({ _id: item.id, ...item.data() } as LocalReport));
            set((state) => ({ reports: mergeReports(state.reports, incoming) }));
        });

        return unsubscribe;
    },
    createReport: async (report) => {
        // 1. Always save locally first to avoid an interface freeze
        await saveReportLocally(report);
        set((state) => ({ reports: mergeReports([report], state.reports) }));

        // 2. Fire-and-forget or conditionally gate the remote uplink
        if (navigator.onLine) {
            try {
                const firebaseData = sanitizeForFirestore(report);
                await setDoc(doc(db, "reports", report._id), {
                    ...firebaseData,
                    uploadedAt: new Date().toISOString(),
                });
            } catch (err) {
                console.error("Firebase write failed; letting SyncEngine handle retry later.", err);
            }
        }
    },
    addComment: async (reportId, comment) => {
        const nextComment: ReportComment = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...comment,
        };

        const existing = get().reports.find((report) => report._id === reportId);
        if (!existing) return;

        const nextComments = [...(existing.comments ?? []), nextComment];
        const nextSnapshot = buildNextReportSnapshot(existing, { comments: nextComments });

        set((state) => ({
            reports: state.reports.map((report) => (
                report._id === reportId
                    ? nextSnapshot
                    : report
            )),
        }));

        await upsertReportDetails(reportId, {
            comments: nextComments,
            synced: false,
            status: "pending",
        });

        await updateReportStatus(reportId, "pending", false);

        if (navigator.onLine) {
            // Clean the snapshot object before pushing to cloud
            const firebaseData = sanitizeForFirestore(nextSnapshot);
            await setDoc(doc(db, "reports", reportId), {
                ...firebaseData,
                comments: nextComments,
                uploadedAt: nextSnapshot.uploadedAt ?? new Date().toISOString(),
            });
            await updateReportStatus(reportId, "synced", true);
        }
    },
    updateLifecycleStatus: async (reportId, status) => {
        const existing = get().reports.find((report) => report._id === reportId);
        if (!existing) return;

        const nextSnapshot = buildNextReportSnapshot(existing, {
            lifecycleStatus: status,
        });

        set((state) => ({
            reports: state.reports.map((report) => (
                report._id === reportId ? nextSnapshot : report
            )),
        }));

        await upsertReportDetails(reportId, { lifecycleStatus: status, synced: false, status: "pending" });
        await updateReportStatus(reportId, "pending", false);

        if (navigator.onLine) {
            // Clean the snapshot object before pushing to cloud
            const firebaseData = sanitizeForFirestore(nextSnapshot);
            await setDoc(doc(db, "reports", reportId), {
                ...firebaseData,
                lifecycleStatus: status,
                uploadedAt: nextSnapshot.uploadedAt ?? new Date().toISOString(),
            });
            await updateReportStatus(reportId, "synced", true);
        }
    },
    addComment: async (reportId, comment) => {
        const nextComment: ReportComment = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            ...comment,
        };

        const existing = get().reports.find((report) => report._id === reportId);
        if (!existing) return;

        const nextComments = [...(existing.comments ?? []), nextComment];
        const nextSnapshot = buildNextReportSnapshot(existing, { comments: nextComments });

        set((state) => ({
            reports: state.reports.map((report) => (
                report._id === reportId
                    ? nextSnapshot
                    : report
            )),
        }));

        await upsertReportDetails(reportId, {
            comments: nextComments,
            synced: false,
            status: "pending",
        });

        await updateReportStatus(reportId, "pending", false);

        if (navigator.onLine) {
            await setDoc(doc(db, "reports", reportId), {
                ...nextSnapshot,
                comments: nextComments,
                uploadedAt: nextSnapshot.uploadedAt ?? new Date().toISOString(),
            });
            await updateReportStatus(reportId, "synced", true);
        }
    },
    updateLifecycleStatus: async (reportId, status) => {
        const existing = get().reports.find((report) => report._id === reportId);
        if (!existing) return;

        const nextSnapshot = buildNextReportSnapshot(existing, {
            lifecycleStatus: status,
        });

        set((state) => ({
            reports: state.reports.map((report) => (
                report._id === reportId ? nextSnapshot : report
            )),
        }));

        await upsertReportDetails(reportId, { lifecycleStatus: status, synced: false, status: "pending" });
        await updateReportStatus(reportId, "pending", false);

        if (navigator.onLine) {
            await setDoc(doc(db, "reports", reportId), {
                ...nextSnapshot,
                lifecycleStatus: status,
                uploadedAt: nextSnapshot.uploadedAt ?? new Date().toISOString(),
            });
            await updateReportStatus(reportId, "synced", true);
        }
    },
}));

export type { ReportAuthorRole };