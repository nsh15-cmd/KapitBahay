// C:\Users\Renz Jericho Buday\KapitBahay\src\lib\crypto.ts

// Fallback mesh key if the environment variable isn't set. 
// In production, define VITE_MESH_SECRET in your .env file.
const MESH_SECRET_PHRASE = import.meta.env.VITE_MESH_SECRET || "kapitbahay-offline-mesh-fallback-key";

/**
 * Derives a secure 256-bit AES-GCM CryptoKey using PBKDF2.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // Import the raw password material
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(MESH_SECRET_PHRASE),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    // Derive the actual AES-256 key
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("kapitbahay-mesh-salt-v1"), // Fixed salt for the local network
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a JSON report payload into an AES-256-GCM binary array.
 */
export async function encryptReport(payload: any): Promise<Uint8Array> {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));

    // AES-GCM requires a unique 12-byte Initialization Vector (IV) for every encryption
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Perform the encryption
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );

    // Concatenate the IV and Ciphertext so the receiving node knows how to decrypt it
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const payloadOut = new Uint8Array(iv.length + encryptedArray.length);
    payloadOut.set(iv, 0);
    payloadOut.set(encryptedArray, iv.length);

    return payloadOut;
}

/**
 * Decrypts an incoming AES-256-GCM binary array back into a JSON object.
 */
export async function decryptReport(encryptedPayload: Uint8Array): Promise<any> {
    const key = await getEncryptionKey();

    // Extract the 12-byte IV from the front of the payload
    const iv = encryptedPayload.slice(0, 12);
    const ciphertext = encryptedPayload.slice(12);

    // Perform the decryption
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString);
}