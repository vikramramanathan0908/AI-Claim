const POS_MAP: Record<string, string> = {
  "11": "Office",
  "21": "Inpatient Hospital",
  "22": "Outpatient Hospital",
  "23": "Emergency Room",
};

export interface Procedure {
  code: string;
  qualifier: string;
  charge: number;
  units: number;
}

export interface ParsedClaim {
  patient: {
    name: string;
    member_id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    dob: string;
    gender: string;
  };
  claim: {
    id: string;
    total_amount: number;
    place_of_service: string;
    dates_of_service: string;
  };
  provider: {
    name: string;
    npi: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  billing_provider: {
    name: string;
    npi: string;
  };
  plan: {
    name: string;
    payer_id: string;
  };
  diagnoses: string[];
  procedures: Procedure[];
  prior_auth: string | null;
  raw_segment_count: number;
}

export function parseEdi(ediText: string): ParsedClaim {
  const segments = ediText
    .replace(/\n/g, "")
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean);
  const elements = segments.map((seg) => seg.split("*"));

  const claim: ParsedClaim = {
    patient: { name: "", member_id: "", address: "", city: "", state: "", zip: "", dob: "", gender: "" },
    claim: { id: "", total_amount: 0, place_of_service: "", dates_of_service: "" },
    provider: { name: "", npi: "", address: "", city: "", state: "", zip: "" },
    billing_provider: { name: "", npi: "" },
    plan: { name: "", payer_id: "" },
    diagnoses: [],
    procedures: [],
    prior_auth: null,
    raw_segment_count: segments.length,
  };

  let currentLoop: string | null = null;
  let addressBuffer: Record<string, string> = {};

  for (const seg of elements) {
    const segId = seg[0];

    if (segId === "NM1") {
      const entityCode = seg[1] || "";
      const nameLast = seg[3] || "";
      const nameFirst = seg[4] || "";
      const idQualifier = seg[8] || "";
      const idValue = seg[9] || "";

      if (entityCode === "IL") {
        claim.patient.name = `${nameFirst} ${nameLast}`.trim();
        if (idQualifier === "MI") claim.patient.member_id = idValue;
        currentLoop = "patient";
      } else if (entityCode === "85") {
        claim.billing_provider.name = nameLast;
        if (idQualifier === "XX") claim.billing_provider.npi = idValue;
        currentLoop = "billing_provider";
      } else if (entityCode === "82") {
        claim.provider.name = `${nameFirst} ${nameLast}`.trim();
        if (idQualifier === "XX") claim.provider.npi = idValue;
        currentLoop = "rendering_provider";
      } else if (entityCode === "40" || entityCode === "PR") {
        claim.plan.name = nameLast;
        claim.plan.payer_id = idValue;
        currentLoop = "payer";
      }
    } else if (segId === "N3") {
      addressBuffer.street = seg[1] || "";
    } else if (segId === "N4") {
      const city = seg[1] || "";
      const state = seg[2] || "";
      const zipCode = seg[3] || "";
      addressBuffer = { ...addressBuffer, city, state, zip: zipCode };

      const street = addressBuffer.street || "";
      if (currentLoop === "patient") {
        claim.patient.address = street;
        claim.patient.city = city;
        claim.patient.state = state;
        claim.patient.zip = zipCode;
      } else if (currentLoop === "billing_provider") {
        claim.billing_provider.npi = claim.billing_provider.npi;
      } else if (currentLoop === "rendering_provider") {
        claim.provider.address = `${street}, ${city}, ${state} ${zipCode}`.trim();
      }
      addressBuffer = {};
    } else if (segId === "DMG") {
      let dob = seg[2] || "";
      const gender = seg[3] || "";
      if (dob.length === 8) {
        dob = `${dob.slice(0, 4)}-${dob.slice(4, 6)}-${dob.slice(6)}`;
      }
      claim.patient.dob = dob;
      claim.patient.gender = gender;
    } else if (segId === "CLM") {
      claim.claim.id = seg[1] || "";
      claim.claim.total_amount = parseFloat(seg[2]) || 0;
      const posComposite = seg[5] || "";
      const posPart = posComposite.split(":")[0];
      claim.claim.place_of_service = POS_MAP[posPart] || posPart;
    } else if (segId === "DTP") {
      const qualifier = seg[1] || "";
      if (qualifier === "434") {
        claim.claim.dates_of_service = seg[3] || "";
      }
    } else if (segId === "REF") {
      const qualifier = seg[1] || "";
      const value = seg[2] || "";
      if (qualifier === "9F") {
        claim.prior_auth = value;
      }
    } else if (segId === "HI") {
      for (const elem of seg.slice(1)) {
        if (elem) {
          const parts = elem.split(":");
          const code = parts[1] || parts[0];
          if (code) claim.diagnoses.push(code.trim());
        }
      }
    } else if (segId === "LX") {
      currentLoop = "service_line";
    } else if (segId === "SV1") {
      const procRaw = seg[1] || "";
      const charge = seg[3] || "0";
      const units = seg[5] || "1";
      const parts = procRaw.split(":");
      const qualifier = parts[0] || "";
      const procCode = parts[1] || procRaw;

      claim.procedures.push({
        code: procCode.trim(),
        qualifier: qualifier.trim(),
        charge: parseFloat(charge) || 0,
        units: parseFloat(units) || 1,
      });
    }
  }

  claim.diagnoses = [...new Set(claim.diagnoses)];
  return claim;
}

const PHI_FIELDS = new Set(["name", "member_id", "address", "city", "zip", "dob"]);

function makeToken(field: string): string {
  const uid = Math.random().toString(16).slice(2, 10).toUpperCase();
  if (field === "name") return `FNAME-${uid}`;
  if (field === "member_id") return `MID-${uid}`;
  if (["address", "city", "zip"].includes(field)) return `ADDR-${uid}`;
  if (field === "dob") return `DOB-${uid}`;
  return `PHI-${uid}`;
}

export function maskPhi(claim: ParsedClaim): { masked: Record<string, unknown>; tokenMap: Record<string, string> } {
  const tokenMap: Record<string, string> = {};

  function maskValue(value: unknown, fieldName: string | null): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "object" && !Array.isArray(value)) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = maskValue(v, k);
      }
      return result;
    }
    if (Array.isArray(value)) {
      return value.map((item) => maskValue(item, fieldName));
    }
    if (typeof value === "string" && value.trim()) {
      if (fieldName && PHI_FIELDS.has(fieldName)) {
        const existing = Object.entries(tokenMap).find(([, v]) => v === value);
        if (existing) return existing[0];
        const token = makeToken(fieldName);
        tokenMap[token] = value;
        return token;
      }
    }
    return value;
  }

  const masked = maskValue(claim, null) as Record<string, unknown>;
  return { masked, tokenMap };
}
