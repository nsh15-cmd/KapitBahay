/**
 * Converts degrees to radians.
 */
function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Uses the Haversine formula to calculate the distance between two coordinates in kilometers.
 */
export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Maps the LGU Jurisdiction string to a strict radius threshold in kilometers.
 */
export const JURISDICTION_RADII: Record<string, number> = {
    Barangay: 3,
    City: 25,
    Province: 100,
};

export interface GeoBounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

/**
 * Returns a rough longitude/latitude bounding box around a point for a given radius in kilometers.
 */
export function getBoundingBox(lat: number, lng: number, radiusKm: number): GeoBounds {
    const earthRadius = 6371;
    const radLat = deg2rad(lat);

    const latDelta = (radiusKm / earthRadius) * (180 / Math.PI);
    const lngDelta = (radiusKm / earthRadius) * (180 / Math.PI) / Math.cos(radLat);

    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}