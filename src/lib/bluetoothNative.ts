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
let isBleServerListenerRegistered = false;

const registerBleServerListener = async () => {
    if (isBleServerListenerRegistered) return;

    await BluetoothLowEnergy.addListener('gattCharacteristicWriteRequest', async (event: any) => {
        try {
            const valueBytes = Array.isArray(event?.value) ? event.value : Array.from(event?.value ?? []);
            if (!valueBytes.length) return;

            const decryptedReport = await decryptReport(new Uint8Array(valueBytes));
            if (!decryptedReport || !decryptedReport._id) return;

            console.log(`📥 BLE peer report received via GATT write: ${decryptedReport._id}`);
            await saveReportLocally({ ...decryptedReport, origin: 'peer', synced: false });
            syncEventEmitter.dispatchEvent(new CustomEvent('peer-received', {
                detail: { title: decryptedReport.title || 'Nearby incident', id: decryptedReport._id }
            }));
            syncEventEmitter.dispatchEvent(new Event('mesh-update'));
        } catch (err) {
            console.warn('⚠️ BLE peer ingest failed during GATT write handling:', err);
        }
    });

    isBleServerListenerRegistered = true;
};

/**
 * Main entrance wrapper. Initializes hardware stacks and provisions background protection.
 */
export const initNativeMeshHardware = async () => {
    if (Capacitor.getPlatform() === 'web') return;

    if (!Capacitor.isPluginAvailable || !Capacitor.isPluginAvailable('BluetoothLowEnergy')) {
        console.warn('⚠️ Native BluetoothLowEnergy plugin is not available on this platform. BLE mesh will stay offline.');
        return;
    }

    // Shield Guard: Enforce permissions before executing radio arrays
    const permissionsReady = await requestMeshHardwarePermissions();
    if (!permissionsReady) {
        console.error("🛑 Mesh Core: Missing hardware permissions. Stalling background loops.");
        return;
    }

    try {
        // 1. Initialize unified stack in central mode for discovery and pairing
        await BluetoothLowEnergy.initialize({ mode: 'central' });
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

        await registerBleServerListener();

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
            if (services.length > 0 && !services.some((service: string) => service.toLowerCase() === DISASTER_SERVICE_UUID.toLowerCase())) {
                console.log(`📡 Device ${result.device.id} did not advertise our service; still attempting a handshake.`);
            }

            console.log(`📡 Node discovered: ${result.device.id}. Attempting auto-handshake.`);

            try {
                const pending = await getPendingReports();
                const localUnsynced = pending.filter(r => !r.synced && r.origin === 'local');
                if (localUnsynced.length === 0) {
                    console.log(`📡 No local unsynced report available to relay to ${result.device.id}.`);
                    return;
                }

                await BluetoothLowEnergy.connect({ deviceId: result.device.id });
                await BluetoothLowEnergy.discoverServices({ deviceId: result.device.id });

                const primaryReport = localUnsynced[0];
                const bleOptimizedPayload = { ...primaryReport, imageDataUrl: undefined };
                const encryptedPayload = await encryptReport(bleOptimizedPayload);
                await BluetoothLowEnergy.writeCharacteristic({
                    deviceId: result.device.id,
                    service: DISASTER_SERVICE_UUID,
                    characteristic: REPORT_CHAR_UUID,
                    value: Array.from(encryptedPayload),
                    type: 'withResponse'
                });

                console.log(`📤 Relayed peer report via BLE write to ${result.device.id}: ${primaryReport._id}`);
            } catch (connErr) {
                console.warn(`⚠️ BLE relay dropped with node ${result.device.id}:`, connErr);
            } finally {
                await BluetoothLowEnergy.disconnect({ deviceId: result.device.id });
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
                const bleOptimizedPayload = {
                    ...primaryReport,
                    imageDataUrl: undefined
                };

                console.log(`📢 Peripheral Mesh: Broadcasting report ${bleOptimizedPayload._id} over waves.`);
                const encryptedPayload = await encryptReport(bleOptimizedPayload);

                await BluetoothLowEnergy.initialize({ mode: 'peripheral' });
                await BluetoothLowEnergy.addGattService({
                    service: DISASTER_SERVICE_UUID,
                    characteristics: [{
                        uuid: REPORT_CHAR_UUID,
                        properties: {
                            read: true,
                            notify: true,
                            write: true,
                            writeWithoutResponse: false,
                            broadcast: false,
                            indicate: false,
                            authenticatedSignedWrites: false,
                            extendedProperties: false,
                        },
                        value: Array.from(encryptedPayload)
                    }]
                });
                await BluetoothLowEnergy.setGattCharacteristicValue({
                    service: DISASTER_SERVICE_UUID,
                    characteristic: REPORT_CHAR_UUID,
                    value: Array.from(encryptedPayload)
                });
                await BluetoothLowEnergy.startAdvertising({
                    name: "KapitBahay_Node",
                    services: [DISASTER_SERVICE_UUID],
                    includeName: true,
                    includeTxPowerLevel: false
                });

                isAdvertising = true;
                await new Promise(resolve => setTimeout(resolve, 4000));
                await BluetoothLowEnergy.stopAdvertising();
                await BluetoothLowEnergy.initialize({ mode: 'central' });
                isAdvertising = false;
            } else {
                if (!isAdvertising) return;
                console.log("🛑 Peripheral Mesh: All local items verified synced. Sleeping native transmitters.");
                await BluetoothLowEnergy.stopAdvertising();
                isAdvertising = false;
            }
        } catch (err) {
            console.error("🚨 Error in background peripheral advertising loop:", err);
            isAdvertising = false;
        }
    }, 15000);
};