// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\hardwarePermissions.ts
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import { Capacitor } from '@capacitor/core';

export const requestMeshHardwarePermissions = async (): Promise<boolean> => {
    if (Capacitor.getPlatform() === 'web') {
        return true;
    }

    try {
        if (!Capacitor.isPluginAvailable || !Capacitor.isPluginAvailable('BluetoothLowEnergy')) {
            console.warn('⚠️ BluetoothLowEnergy plugin unavailable during permission check.');
            return false;
        }

        if (Capacitor.getPlatform() === 'android') {
            console.log("🛡️ Checking Android native permissions matrix...");
            const permissionStatus = await BluetoothLowEnergy.requestPermissions();
            if (!permissionStatus.bluetooth || !permissionStatus.location) {
                console.warn("⚠️ BLE permissions were not fully granted.");
                return false;
            }
        }

        const availability = await BluetoothLowEnergy.isAvailable();
        if (!availability.available) {
            console.warn("📻 Hardware Alert: Bluetooth hardware is unavailable on this device.");
            return false;
        }

        const response = await BluetoothLowEnergy.isEnabled();
        if (!response.enabled) {
            console.warn("📻 Hardware Alert: Bluetooth radio toggle is powered down.");
            return false;
        }

        return true;
    } catch (err) {
        console.error("🚨 Failed to verify hardware permissions parameters:", err);
        return false;
    }
};