// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\bluetoothNative.ts
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import { Capacitor } from '@capacitor/core';
import { encryptReport, decryptReport } from './crypto';
import { getPendingReports, saveReportLocally } from './indexedDb';
import { requestMeshHardwarePermissions } from './hardwarePermissions';
import { syncEventEmitter } from './syncEngine';

const DISASTER_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
const REPORT_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

let isScanning = false;
let isAdvertising = false;

/**
 * Main entrance wrapper. Initializes hardware stacks and provisions background protection.
 */
export const initNativeMeshHardware = async () => {
    if (Capacitor.getPlatform() === 'web') return;

    // Shield Guard: Enforce permissions before executing radio arrays
    const permissionsReady = await requestMeshHardwarePermissions();
    if (!permissionsReady) {
        console.error("🛑 Mesh Core: Missing hardware permissions. Stalling background loops.");
        return;
    }

    try {
        // 1. Initialize unified stack in central/peripheral hybrid state
        await BluetoothLowEnergy.initialize();
        console.log("🔋 Native Unified BLE Stack initialized successfully.");

        // 2. Provision native sticky Foreground Service helper block for Android persistence
        if (Capacitor.getPlatform() === 'android') {
            try {
                // Invoking built-in foreground capability from unified capgo plugin metadata definitions
                await (BluetoothLowEnergy as any).startForegroundService({
                    title: "KapitBahay Mesh Active",
                    body: "Emergency network is searching for offline neighbors.",
                    notificationId: 1991
                });
                console.log("🛡️ Built-in BLE Foreground Service active. Protection running.");
            } catch (fsErr) {
                console.warn("⚠️ Foreground service wrapper initialization bypassed:", fsErr);
            }
        }

        // 3. Kick off background hardware tracking cycles
        startBackgroundMeshScan();
        startBackgroundAdvertisingLoop();
    } catch (err) {
        console.error("🚨 Failed to initialize native BLE mesh framework:", err);
    }
};

/**
 * AUTOMATIC CENTRAL LOOP: Scans continuously for neighbors advertising the disaster service
 */
const startBackgroundMeshScan = async () => {
    if (isScanning) return;
    isScanning = true;

    try {
        console.log("🔍 Central Mesh: Scanning for nearby KapitBahay nodes...");

        await BluetoothLowEnergy.addListener('deviceScanned', async (result: any) => {
            if (!result?.device?.id) return;

            const services = result.device.services || [];
            if (!services.includes(DISASTER_SERVICE_UUID.toLowerCase())) return;

            console.log(`📡 Node discovered: ${result.device.id}. Attempting auto-handshake.`);

            try {
                await BluetoothLowEnergy.connect({ deviceId: result.device.id });
                await BluetoothLowEnergy.discoverServices();

                const response = await BluetoothLowEnergy.readCharacteristic({
                    characteristicId: REPORT_CHAR_UUID
                });

                if (response?.value) {
                    const encryptedArray = new Uint8Array(response.value);
                    const decryptedReport = await decryptReport(encryptedArray);

                    if (decryptedReport && decryptedReport._id) {
                        console.log(`📥 Ingested peer report via background BLE: ${decryptedReport._id}`);
                        await saveReportLocally({ ...decryptedReport, origin: 'peer', synced: false });

                        // Broadcast update to syncEngine.ts to fire database propagation
                        syncEventEmitter.dispatchEvent(new Event('mesh-update'));
                    }
                }
            } catch (connErr) {
                console.warn(`⚠️ Handshake dropped with node ${result.device.id}:`, connErr);
            } finally {
                await BluetoothLowEnergy.disconnect();
            }
        });

        await BluetoothLowEnergy.startScan();
    } catch (error) {
        console.error("❌ Background scanning error loop stalled:", error);
        isScanning = false;
        setTimeout(startBackgroundMeshScan, 10000);
    }
};

/**
 * AUTOMATIC PERIPHERAL LOOP: Acts as a beacon emitting local reports to adjacent receivers
 */
const startBackgroundAdvertisingLoop = async () => {
    setInterval(async () => {
        try {
            const pending = await getPendingReports();
            const localUnsynced = pending.filter(r => !r.synced && r.origin === 'local');

            if (localUnsynced.length > 0) {
                if (isAdvertising) return;

                const primaryReport = localUnsynced[0];

                // CRITICAL PATCH: Strip heavy payload elements before transmission over BLE radio vectors
                const bleOptimizedPayload = {
                    ...primaryReport,
                    imageDataUrl: undefined
                };

                console.log(`📢 Peripheral Mesh: Broadcasting report ${bleOptimizedPayload._id} over waves.`);
                const encryptedPayload = await encryptReport(bleOptimizedPayload);
                const numericPayloadArray = Array.from(encryptedPayload);

                await BluetoothLowEnergy.startAdvertising({
                    localName: "KapitBahay_Node",
                    serviceUUIDs: [DISASTER_SERVICE_UUID],
                    customValue: numericPayloadArray as any
                });

                isAdvertising = true;
            } else {
                if (!isAdvertising) return;
                console.log("🛑 Peripheral Mesh: All local items verified synced. Sleeping native transmitters.");
                await BluetoothLowEnergy.stopAdvertising();
                isAdvertising = false;
            }
        } catch (err) {
            console.error("🚨 Error in background peripheral advertising loop:", err);
        }
    }, 15000);
};