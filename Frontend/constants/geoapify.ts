const fallbackKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || "";

export const PLACES_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_PLACES_KEY || fallbackKey;
export const ROUTING_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_ROUTING_KEY || fallbackKey;
export const MAPS_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_MAPS_KEY || fallbackKey;
