// ── Hospital Bulk Import Abstraction ──────────────────────────────────────────
//
// All data sources (Geoapify, government datasets, CSV uploads, hospital portal)
// implement the same HospitalImportProvider interface. The `bulkImportHospitals`
// orchestrator calls fetchHospitals() + normalizeHospital() and passes each
// normalized record to the caller-supplied createHospitalFn.

// ── Provider interface ────────────────────────────────────────────────────────

export class HospitalImportProvider {
  get name() {
    throw new Error('Provider must declare a name');
  }

  /** Fetch raw records from the data source */
  async fetchHospitals(params = {}) {
    throw new Error(`${this.constructor.name} must implement fetchHospitals()`);
  }

  /** Map a raw record to the hospitals schema */
  async normalizeHospital(raw) {
    throw new Error(`${this.constructor.name} must implement normalizeHospital()`);
  }
}

// ── Concrete provider stubs ───────────────────────────────────────────────────

export class GeoapifyImportProvider extends HospitalImportProvider {
  get name() { return 'geoapify'; }

  async fetchHospitals({ lat, lng, radiusKm = 10 }) {
    // TODO: GET https://api.geoapify.com/v2/places?categories=healthcare.hospital
    console.log(`[GEOAPIFY STUB] Searching hospitals near (${lat},${lng}) within ${radiusKm}km`);
    return [];
  }

  async normalizeHospital(raw) {
    return {
      hospital_name: raw.name,
      hospital_type: 'PRIVATE',
      latitude:      raw.lat,
      longitude:     raw.lon,
      address:       raw.address_line1,
      city:          raw.city,
      state:         raw.state,
      country:       raw.country ?? 'India',
      phone:         raw.phone ?? null,
      website:       raw.website ?? null,
    };
  }
}

export class ManualCsvImportProvider extends HospitalImportProvider {
  get name() { return 'manual_csv'; }

  async fetchHospitals({ fileBuffer }) {
    // TODO: parse CSV with papaparse / csv-parse; return array of row objects
    console.log('[CSV STUB] Parsing CSV hospital data');
    return [];
  }

  async normalizeHospital(raw) {
    return {
      hospital_name: raw['Hospital Name'],
      hospital_type: raw['Type']?.toUpperCase() ?? 'PRIVATE',
      latitude:      parseFloat(raw['Latitude']),
      longitude:     parseFloat(raw['Longitude']),
      city:          raw['City'] ?? null,
      state:         raw['State'] ?? null,
      pincode:       raw['Pincode'] ?? null,
      phone:         raw['Phone'] ?? null,
    };
  }
}

export class GovernmentDatasetProvider extends HospitalImportProvider {
  get name() { return 'government_dataset'; }

  async fetchHospitals({ stateCode }) {
    // TODO: NHA / NIN / state health department open APIs
    console.log(`[GOV STUB] Fetching government hospitals for state: ${stateCode}`);
    return [];
  }

  async normalizeHospital(raw) {
    return {
      hospital_name: raw.hospital_name,
      hospital_type: raw.facility_type === 'Government' ? 'GOVERNMENT' : 'PRIVATE',
      latitude:      parseFloat(raw.latitude),
      longitude:     parseFloat(raw.longitude),
      city:          raw.district ?? null,
      state:         raw.state ?? null,
      pincode:       raw.pincode ?? null,
    };
  }
}

export class HospitalPortalProvider extends HospitalImportProvider {
  get name() { return 'hospital_portal'; }

  async fetchHospitals({ apiKey }) {
    // TODO: authenticated pull from hospital self-service portal
    console.log('[PORTAL STUB] Fetching hospital self-submitted data');
    return [];
  }

  async normalizeHospital(raw) {
    return {
      hospital_name:    raw.name,
      hospital_type:    raw.type ?? 'PRIVATE',
      latitude:         raw.location?.lat,
      longitude:        raw.location?.lng,
      city:             raw.address?.city,
      state:            raw.address?.state,
      phone:            raw.contact?.phone,
      email:            raw.contact?.email,
      website:          raw.website,
      rating:           raw.rating,
      reliability_score: raw.reliability_score,
    };
  }
}

// ── Provider registry ─────────────────────────────────────────────────────────

const PROVIDERS = {
  geoapify:           new GeoapifyImportProvider(),
  manual_csv:         new ManualCsvImportProvider(),
  government_dataset: new GovernmentDatasetProvider(),
  hospital_portal:    new HospitalPortalProvider(),
};

export const getImportProvider = (name) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown import provider: '${name}'. Available: ${Object.keys(PROVIDERS).join(', ')}`);
  return provider;
};

// ── Orchestrator ──────────────────────────────────────────────────────────────

export const bulkImportHospitals = async (providerName, params, createHospitalFn) => {
  const provider = getImportProvider(providerName);
  const rawList  = await provider.fetchHospitals(params);

  const result = { imported: 0, failed: 0, errors: [] };

  for (const raw of rawList) {
    try {
      const normalized = await provider.normalizeHospital(raw);
      await createHospitalFn(normalized);
      result.imported++;
    } catch (err) {
      result.failed++;
      result.errors.push({ raw, error: err.message });
    }
  }

  return result;
};
