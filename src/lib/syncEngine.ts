// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\syncEngine.ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getDittoInstance } from "./ditto";
import { getPendingReports, getReportById, saveReportLocally, updateReportStatus } from "./indexedDb";
import type { LocalReport } from "./indexedDb";

// Event target to notify Zustand stores and React UI of new peer data
export const syncEventEmitter = new EventTarget();

export const startAutomatedSyncEngine = async () => {
    try {
        const ditto = await getDittoInstance();

        // --- MESH PRESENCE MONITORING ---
        ditto.presence.observe((graph) => {
            const connectedPeersCount = graph.remotePeers.length;
            console.log(`Mesh: Currently connected to ${connectedPeersCount} peers via WebRTC/LAN.`);
            syncEventEmitter.dispatchEvent(new CustomEvent('mesh-presence-update', {
                detail: { count: connectedPeersCount }
            }));
        });

        // --- UNIFIED QUEUE PROCESSOR ---
        // This handles bridging data between Local DB, Ditto LAN, and Firebase Cloud
        const processPendingQueue = async () => {
            const pendingReports = await getPendingReports();

            for (const report of pendingReports.filter((r) => !r.synced)) {
                try {
                    // 1. ALWAYS push to Ditto Mesh (so Wi-Fi peers get it, even if offline)
                    const meshPayload = { ...report, imageDataUrl: undefined };
                    await ditto.store.execute(
                        `INSERT INTO users_reports DOCUMENTS (:meshPayload) ON ID CONFLICT DO UPDATE`,
                        { meshPayload }
                    );

                    // 2. ONLY push to Firebase if internet is active
                    if (navigator.onLine) {
                        await setDoc(doc(db, "reports", report._id), {
                            ...report,
                            synced: true,
                            uploadedAt: new Date().toISOString(),
                        });

                        await updateReportStatus(report._id, "synced", true);

                        // Tell the Ditto mesh that this item is now safely in the cloud
                        await ditto.store.execute(
                            `UPDATE users_reports SET synced = true WHERE _id = '${report._id}'`
                        );
                        console.log(`☁️ Synced to cloud & updated mesh: ${report._id}`);
                    }
                } catch (err) {
                    console.warn(`Failed to process queue for ${report._id}:`, err);
                }
            }
        };

        // --- MESH INGESTION (Ditto -> Local) ---
        ditto.store.registerObserver("SELECT * FROM users_reports", async (result) => {
            let hasUpdates = false;

            for (const item of result.items) {
                const peerReport = item.value as LocalReport;
                if (!peerReport || !peerReport._id) continue;

                const localReport = await getReportById(peerReport._id);
                const isNew = !localReport;
                const isUpdate = localReport && (
                    peerReport.timestamp > localReport.timestamp ||
                    (peerReport.comments?.length || 0) > (localReport.comments?.length || 0) ||
                    peerReport.lifecycleStatus !== localReport.lifecycleStatus
                );

                if (isNew || isUpdate) {
                    await saveReportLocally({ ...peerReport, origin: isNew ? 'peer' : localReport.origin });
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                syncEventEmitter.dispatchEvent(new Event('mesh-update'));
                processPendingQueue(); // Try to bridge the new data to the cloud immediately
            }
        });

        // --- EVENT LISTENERS ---
        // If Bluetooth ingests a file, it fires 'mesh-update'. Catch it and process the queue.
        syncEventEmitter.addEventListener('mesh-update', () => processPendingQueue());

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") processPendingQueue();
        });

        window.addEventListener("online", processPendingQueue);
        window.setInterval(processPendingQueue, 15000); // Check the queue every 15 seconds

        processPendingQueue();

    } catch (error) {
        console.error("Sync Engine Initialization Failed:", error);
    }
};