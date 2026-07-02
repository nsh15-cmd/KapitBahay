import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getDittoInstance } from "./ditto";
import { getPendingReports, updateReportStatus } from "./indexedDb";

let cloudSyncDaemonStarted = false;

export const startCloudSyncDaemon = async () => {
    try {
        const ditto = await getDittoInstance();

        const syncLocalPendingReports = async () => {
            if (!navigator.onLine) return;

            const pendingReports = await getPendingReports();
            for (const report of pendingReports.filter((item) => item.status !== "synced")) {
                try {
                    await setDoc(doc(db, "reports", report._id), {
                        ...report,
                        synced: true,
                        uploadedAt: new Date().toISOString(),
                    });
                    await updateReportStatus(report.id, "synced", true);
                    console.log(`☁️ Synced local report ${report._id} to Firebase.`);
                } catch (err) {
                    console.warn(`Failed to sync local report ${report._id} to Firebase:`, err);
                }
            }
        };

        const syncDittoReports = async () => {
            if (!navigator.onLine) return;

            try {
                const result = await ditto.store.execute(
                    `SELECT * FROM users_reports WHERE synced = false`
                );

                for (const item of result.items) {
                    const report = item.value;
                    if (!report || !report._id) continue;

                    try {
                        await setDoc(doc(db, "reports", report._id), {
                            ...report,
                            synced: true,
                            uploadedAt: new Date().toISOString(),
                        });
                        await ditto.store.execute(
                            `UPDATE users_reports SET synced = true WHERE _id = '${report._id}'`
                        );
                        console.log(`☁️ Synced peer report ${report._id} from Ditto to Firebase.`);
                    } catch (firebaseErr) {
                        console.warn(`Failed to upload peer report ${report._id} to Firebase:`, firebaseErr);
                    }
                }
            } catch (queryErr) {
                console.error("Ditto query failed during sync daemon execution:", queryErr);
            }
        };

        const syncAllReports = async () => {
            await syncLocalPendingReports();
            await syncDittoReports();
        };

        // Trigger the sync function immediately when the device reconnects to Wi-Fi/Cellular
        window.addEventListener("online", () => {
            console.log("🌐 Internet connection restored. Waking up Cloud Sync Daemon...");
            syncAllReports();
        });

        window.setInterval(() => {
            if (navigator.onLine) {
                syncAllReports();
            }
        }, 30000);

        // Also register a Ditto observer. If a NEW report arrives via Bluetooth/Mesh from an offline peer,
        // and THIS device has internet, it will instantly upload it.
        ditto.store.registerObserver(`SELECT * FROM users_reports WHERE synced = false`, () => {
            syncAllReports();
        });

        // Run once on startup just in case there are pending reports
        syncAllReports();

    } catch (error) {
        console.error("🚨 Failed to initialize Cloud Sync Daemon:", error);
    }
};