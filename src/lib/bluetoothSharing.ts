// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\bluetoothSharing.ts

import { encryptReport } from "./crypto";

// Web Bluetooth API Profile Definition Parameters
const DISASTER_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
const REPORT_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

/**
 * Scans for adjacent KapitBahay emergency nodes and transmits encrypted reports via Bluetooth
 */
export const broadcastReportViaBluetooth = async (reportPayload: any) => {
    if (!navigator.bluetooth) {
        console.warn("❌ Web Bluetooth API is not supported on this browser.");
        return false;
    }

    try {
        console.log("📡 Scanning for adjacent P2P Mesh Nodes...");
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [DISASTER_SERVICE_UUID] }],
            optionalServices: ["battery_service"]
        });

        console.log(`🔌 Handshaking with Node: ${device.name}`);
        const server = await device.gatt?.connect();

        if (!server) throw new Error("GATT Connection sequence dropped.");

        const service = await server.getPrimaryService(DISASTER_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(REPORT_CHAR_UUID);

        // -- APPLIED AES-256 ENCRYPTION HERE --
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