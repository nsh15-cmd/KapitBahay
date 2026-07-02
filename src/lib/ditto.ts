// src/lib/ditto.ts
import { init, Ditto, DittoConfig, TransportConfig } from "@dittolive/ditto";

let dittoInstance: Ditto | null = null;
let initPromise: Promise<Ditto> | null = null;

export const getDittoInstance = async (): Promise<Ditto> => {
    if (dittoInstance) return dittoInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            await init();

            const appID = import.meta.env.VITE_DITTO_APP_ID || "YOUR_DITTO_APP_ID";

            const config = new DittoConfig(appID, {
                mode: "smallPeersOnly"
            });

            const ditto = await Ditto.open(config);
            const transportConfig = new TransportConfig();

            // 1. Enable Local Area Network (LAN) discovery for Wi-Fi mesh
            if (transportConfig.localAreaNetwork) {
                transportConfig.localAreaNetwork.isEnabled = true;
            }

            // 2. Enable WebRTC for direct browser-to-browser P2P mesh
            if (transportConfig.peerToPeer?.webRtc) {
                transportConfig.peerToPeer.webRtc.isEnabled = true;
            }

            ditto.setTransportConfig(transportConfig);

            dittoInstance = ditto;
            return ditto;

        } catch (error) {
            initPromise = null;
            throw error;
        }
    })();

    return initPromise;
};