// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\bluetoothSharing.ts

import { Capacitor } from '@capacitor/core';
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import { encryptReport } from "./crypto";

// Web Bluetooth API Profile Definition Parameters
const DISASTER_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
const REPORT_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

const isNativeBleAvailable = () => {
    return typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('BluetoothLowEnergy');
};

const startNativeBluetoothTransfer = async (reportPayload: any) => {
    if (!isNativeBleAvailable()) return false;

    try {
        const permissionStatus = await BluetoothLowEnergy.requestPermissions();
        const availability = await BluetoothLowEnergy.isAvailable();
        const bluetoothEnabled = await BluetoothLowEnergy.isEnabled();

        if (!permissionStatus.bluetooth || !permissionStatus.location) {
            console.warn("Bluetooth permissions were denied on this device.");
            return false;
        }

        if (!availability.available || !bluetoothEnabled.enabled) {
            console.warn("Bluetooth hardware or radio state is not ready for transfer.");
            return false;
        }

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
                value: [0]
            }]
        });

        const encryptedPayload = await encryptReport(reportPayload);
        await BluetoothLowEnergy.setGattCharacteristicValue({
            service: DISASTER_SERVICE_UUID,
            characteristic: REPORT_CHAR_UUID,
            value: Array.from(encryptedPayload)
        });

        await BluetoothLowEnergy.startAdvertising({
            name: 'KapitBahay_Node',
            services: [DISASTER_SERVICE_UUID],
            includeName: true,
            includeTxPowerLevel: false
        });

        await new Promise((resolve) => setTimeout(resolve, 6000));
        await BluetoothLowEnergy.stopAdvertising();
        return true;
    } catch (error) {
        console.error("🚨 Native BLE transfer failed:", error);
        return false;
    }
};

/**
 * Scans for adjacent KapitBahay emergency nodes and transmits encrypted reports via Bluetooth
 */
export const broadcastReportViaBluetooth = async (reportPayload: any) => {
    if (Capacitor.getPlatform() !== 'web') {
        return await startNativeBluetoothTransfer(reportPayload);
    }

    const nav = navigator as Navigator & { bluetooth?: { requestDevice: (options: any) => Promise<any> } };

    if (!nav.bluetooth || !(window as any).isSecureContext) {
        console.warn("❌ Web Bluetooth API is not supported on this browser.");
        return false;
    }

    try {
        console.log("📡 Scanning for adjacent P2P Mesh Nodes...");
        const device = await nav.bluetooth.requestDevice({
            filters: [{ services: [DISASTER_SERVICE_UUID] }],
            optionalServices: ["battery_service"]
        });

        console.log(`🔌 Handshaking with Node: ${device.name}`);
        const server = await device.gatt?.connect();

        if (!server) throw new Error("GATT Connection sequence dropped.");

        const service = await server.getPrimaryService(DISASTER_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(REPORT_CHAR_UUID);

        console.log("🔒 Encrypting payload with AES-256-GCM...");
        const encryptedDataBuffer = await encryptReport(reportPayload);

        console.log("⚡ Beaming encrypted report across hardware Bluetooth vectors...");
        await characteristic.writeValue(encryptedDataBuffer);

        console.log("🎯 Bluetooth P2P transfer verified successful!");
        return true;
    } catch (error) {
        console.error("🚨 Bluetooth P2P broadcast transmission aborted:", error);
        return false;
    }
};