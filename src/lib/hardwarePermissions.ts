// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\hardwarePermissions.ts
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import { Capacitor } from '@capacitor/core';

export const requestMeshHardwarePermissions = async (): Promise<{ ok: boolean; reason?: string }> => {
    const platform = Capacitor.getPlatform();
    const isNativeMobile = platform === 'android' || platform === 'ios';

    if (!isNativeMobile) {
        return { ok: true };
    }

    try {
        if (!Capacitor.isPluginAvailable || !Capacitor.isPluginAvailable('BluetoothLowEnergy')) {
            console.warn('⚠️ BluetoothLowEnergy plugin unavailable during permission check.');
            return { ok: false, reason: 'Bluetooth plugin is unavailable on this build.' };
        }

        if (platform === 'android') {
            console.log('🛡️ Requesting Android native permissions for BLE mesh...');
            const permissionStatus = await BluetoothLowEnergy.requestPermissions();
            const bluetoothGranted = permissionStatus.bluetooth === 'granted' || permissionStatus.bluetooth === 'limited';
            const locationGranted = permissionStatus.location === 'granted' || permissionStatus.location === 'limited';

            if (!bluetoothGranted || !locationGranted) {
                console.warn('⚠️ BLE permissions were not fully granted.');
                return {
                    ok: false,
                    reason: 'Android may show this as Nearby devices and Location permissions. Please allow both to enable nearby pairing.'
                };
            }
        }

        const availability = await BluetoothLowEnergy.isAvailable();
        if (!availability.available) {
            console.warn('📻 Hardware Alert: Bluetooth hardware is unavailable on this device.');
            return { ok: false, reason: 'Bluetooth hardware is unavailable on this device.' };
        }

        const response = await BluetoothLowEnergy.isEnabled();
        if (!response.enabled) {
            console.warn('📻 Hardware Alert: Bluetooth radio toggle is powered down.');
            return { ok: false, reason: 'Please turn on Bluetooth before sharing reports.' };
        }

        return { ok: true };
    } catch (err) {
        console.error('🚨 Failed to verify hardware permissions parameters:', err);
        return { ok: false, reason: 'Unable to verify Bluetooth permissions right now.' };
    }
};