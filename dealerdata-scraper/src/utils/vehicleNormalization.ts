/**
 * Vehicle Make, Model, and Trim Normalization Layer for Scraper
 * Standardizes raw values extracted from HTML, JSON-LD, and APIs before DB persistence.
 */

export const CANONICAL_MAKES: Record<string, string> = {
  ram: 'Ram',
  'ram trucks': 'Ram',
  'ram truck': 'Ram',
  dodge: 'Dodge',
  chrysler: 'Chrysler',
  jeep: 'Jeep',
  chevrolet: 'Chevrolet',
  chevy: 'Chevrolet',
  ford: 'Ford',
  gmc: 'GMC',
  toyota: 'Toyota',
  honda: 'Honda',
  nissan: 'Nissan',
  kia: 'Kia',
  hyundai: 'Hyundai',
  subaru: 'Subaru',
  volkswagen: 'Volkswagen',
  vw: 'Volkswagen',
  bmw: 'BMW',
  'mercedes-benz': 'Mercedes-Benz',
  mercedes: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  cadillac: 'Cadillac',
  buick: 'Buick',
  lincoln: 'Lincoln',
  lexus: 'Lexus',
  acura: 'Acura',
  infiniti: 'Infiniti',
  audi: 'Audi',
  fiat: 'FIAT',
  porsche: 'Porsche',
  genesis: 'Genesis',
  'alfa romeo': 'Alfa Romeo',
  volvo: 'Volvo',
  mazda: 'Mazda',
  mitsubishi: 'Mitsubishi',
  mini: 'MINI',
  'land rover': 'Land Rover',
  jaguar: 'Jaguar',
  maserati: 'Maserati',
};

const ACRONYMS = new Set([
  'HD', 'EV', 'SRT', 'GT', '4xe', 'MAX', 'XL', 'XLT', 'SV', 'SL', 'RS', 'LT', 'LS', 'LTZ',
  'ZR2', 'Z71', 'LE', 'XLE', 'SE', 'SEL', 'XRT', 'TRD', 'AWD', 'FWD', '4WD', 'PHEV'
]);

const CANONICAL_MODELS_BY_MAKE: Record<string, Record<string, string>> = {
  Hyundai: {
    // Kona
    kona: 'Kona',
    'kona limited': 'Kona',
    'kona limited fwd': 'Kona',
    'kona limited awd': 'Kona',
    'kona sel': 'Kona',
    'kona sel fwd': 'Kona',
    'kona sel awd': 'Kona',
    'kona se': 'Kona',
    'kona se fwd': 'Kona',
    'kona se awd': 'Kona',
    'kona n line': 'Kona',
    'kona n-line': 'Kona',
    'kona n': 'Kona N',
    'kona electric': 'Kona Electric',
    'kona ev': 'Kona Electric',

    // Palisade
    palisade: 'Palisade',
    'palisade calligraphy': 'Palisade',
    'palisade calligraphy night': 'Palisade',
    'palisade limited': 'Palisade',
    'palisade sel': 'Palisade',
    'palisade sel premium': 'Palisade',
    'palisade xrt': 'Palisade',
    'palisade xrt pro': 'Palisade',
    'palisade se': 'Palisade',
    'palisade hybrid': 'Palisade Hybrid',
    'palisade hybrid calligraphy': 'Palisade Hybrid',
    'palisade hybrid limited': 'Palisade Hybrid',
    'palisade hybrid sel': 'Palisade Hybrid',

    // Tucson
    tucson: 'Tucson',
    'tucson limited': 'Tucson',
    'tucson sel': 'Tucson',
    'tucson se': 'Tucson',
    'tucson xrt': 'Tucson',
    'tucson n line': 'Tucson',
    'tucson n-line': 'Tucson',
    'tucson hybrid': 'Tucson Hybrid',
    'tucson hybrid blue': 'Tucson Hybrid',
    'tucson hybrid limited': 'Tucson Hybrid',
    'tucson hybrid sel': 'Tucson Hybrid',
    'tucson hybrid n line': 'Tucson Hybrid',
    'tucson plug-in': 'Tucson Plug-In Hybrid',
    'tucson plug-in hybrid': 'Tucson Plug-In Hybrid',
    'tucson phev': 'Tucson Plug-In Hybrid',
    'tucson phev limited': 'Tucson Plug-In Hybrid',
    'tucson phev sel': 'Tucson Plug-In Hybrid',

    // Santa Fe
    'santa fe': 'Santa Fe',
    'santa fe calligraphy': 'Santa Fe',
    'santa fe limited': 'Santa Fe',
    'santa fe sel': 'Santa Fe',
    'santa fe xrt': 'Santa Fe',
    'santa fe se': 'Santa Fe',
    'santa fe hybrid': 'Santa Fe Hybrid',
    'santa fe hybrid calligraphy': 'Santa Fe Hybrid',
    'santa fe hybrid limited': 'Santa Fe Hybrid',
    'santa fe hybrid sel': 'Santa Fe Hybrid',
    'santa fe phev': 'Santa Fe Plug-In Hybrid',
    'santa fe plug-in hybrid': 'Santa Fe Plug-In Hybrid',

    // Elantra
    elantra: 'Elantra',
    'elantra limited': 'Elantra',
    'elantra sel': 'Elantra',
    'elantra sel sport': 'Elantra',
    'elantra se': 'Elantra',
    'elantra n line': 'Elantra',
    'elantra n-line': 'Elantra',
    'elantra hybrid': 'Elantra Hybrid',
    'elantra hybrid blue': 'Elantra Hybrid',
    'elantra hybrid limited': 'Elantra Hybrid',
    'elantra hybrid sel': 'Elantra Hybrid',
    'elantra hybrid sel sport plus': 'Elantra Hybrid',
    'elantra n': 'Elantra N',
    'elantra n sedan': 'Elantra N',

    // Sonata
    sonata: 'Sonata',
    'sonata se': 'Sonata',
    'sonata sel': 'Sonata',
    'sonata sel sport': 'Sonata',
    'sonata sel convenience': 'Sonata',
    'sonata n line': 'Sonata',
    'sonata n-line': 'Sonata',
    'sonata limited': 'Sonata',
    'sonata hybrid': 'Sonata Hybrid',
    'sonata hybrid blue': 'Sonata Hybrid',
    'sonata hybrid sel': 'Sonata Hybrid',
    'sonata hybrid limited': 'Sonata Hybrid',

    // Venue
    venue: 'Venue',
    'venue se': 'Venue',
    'venue sel': 'Venue',
    'venue limited': 'Venue',

    // Santa Cruz
    'santa cruz': 'Santa Cruz',
    'santa cruz se': 'Santa Cruz',
    'santa cruz sel': 'Santa Cruz',
    'santa cruz night': 'Santa Cruz',
    'santa cruz xrt': 'Santa Cruz',
    'santa cruz limited': 'Santa Cruz',

    // Ioniq family
    'ioniq 5': 'Ioniq 5',
    'ioniq 5 se': 'Ioniq 5',
    'ioniq 5 sel': 'Ioniq 5',
    'ioniq 5 limited': 'Ioniq 5',
    'ioniq 5 n': 'Ioniq 5 N',
    'ioniq 6': 'Ioniq 6',
    'ioniq 6 se': 'Ioniq 6',
    'ioniq 6 sel': 'Ioniq 6',
    'ioniq 6 limited': 'Ioniq 6',
    'ioniq 9': 'Ioniq 9',
    'ioniq 9 se': 'Ioniq 9',
    'ioniq 9 sel': 'Ioniq 9',
    'ioniq 9 limited': 'Ioniq 9',
    'ioniq 9 calligraphy': 'Ioniq 9',
    ioniq: 'Ioniq',
    'ioniq electric': 'Ioniq EV',
    'ioniq hybrid': 'Ioniq Hybrid',

    // Nexo
    nexo: 'Nexo',
    'nexo blue': 'Nexo',
    'nexo limited': 'Nexo',
  },
  Kia: {
    sportage: 'Sportage',
    'sportage hybrid': 'Sportage Hybrid',
    'sportage plug-in hybrid': 'Sportage Plug-In Hybrid',
    telluride: 'Telluride',
    'telluride hybrid': 'Telluride Hybrid',
    sorento: 'Sorento',
    'sorento hybrid': 'Sorento Hybrid',
    'sorento plug-in hybrid': 'Sorento Plug-In Hybrid',
    seltos: 'Seltos',
    k5: 'K5',
    forte: 'Forte',
    k4: 'K4',
    'k4 hatchback': 'K4',
    carnival: 'Carnival',
    'carnival mpv': 'Carnival',
    'carnival hybrid': 'Carnival Hybrid',
    'carnival mpv hybrid': 'Carnival Hybrid',
    soul: 'Soul',
    ev3: 'EV3',
    ev6: 'EV6',
    ev9: 'EV9',
    niro: 'Niro',
    'niro ev': 'Niro EV',
    'niro plug-in hybrid': 'Niro Plug-In Hybrid',
  },
  Ram: {
    '1500': '1500',
    '1500 classic': '1500 Classic',
    '1500 tradesman': '1500',
    '1500 bighorn': '1500',
    '1500 big horn': '1500',
    '1500 laramie': '1500',
    '1500 rebel': '1500',
    '1500 limited': '1500',
    '1500 longhorn': '1500',
    '1500 trx': '1500',
    '2500': '2500',
    '2500 tradesman': '2500',
    '2500 bighorn': '2500',
    '2500 laramie': '2500',
    '2500 power wagon': '2500',
    '3500': '3500',
    '3500 chassis cab': '3500 Chassis Cab',
    '3500 chassis': '3500 Chassis Cab',
    '4500': '4500 Chassis Cab',
    '4500 chassis cab': '4500 Chassis Cab',
    '4500 chassis': '4500 Chassis Cab',
    '5500': '5500 Chassis Cab',
    '5500hd': '5500 Chassis Cab',
    '5500 chassis cab': '5500 Chassis Cab',
    '5500 chassis': '5500 Chassis Cab',
    'promaster': 'ProMaster',
    'promaster cargo van': 'ProMaster',
    'promaster window van': 'ProMaster',
    'promaster cutaway': 'ProMaster',
    'promaster 1500': 'ProMaster',
    'promaster 2500': 'ProMaster',
    'promaster 3500': 'ProMaster',
    'promaster ev': 'ProMaster EV',
  },
  Jeep: {
    'grand cherokee': 'Grand Cherokee',
    'grand cherokee 4xe': 'Grand Cherokee 4xe',
    'grand cherokee l': 'Grand Cherokee L',
    'wrangler': 'Wrangler',
    'wrangler 4xe': 'Wrangler 4xe',
    'gladiator': 'Gladiator',
    'compass': 'Compass',
    'renegade': 'Renegade',
    'cherokee': 'Cherokee',
    'recon': 'Recon',
    'wagoneer': 'Wagoneer',
    'wagoneer l': 'Wagoneer L',
    'grand wagoneer': 'Grand Wagoneer',
    'grand wagoneer l': 'Grand Wagoneer L',
  },
  Dodge: {
    'durango': 'Durango',
    'durango srt': 'Durango',
    'durango gt': 'Durango',
    'charger': 'Charger',
    'charger daytona': 'Charger',
    'challenger': 'Challenger',
    'hornet': 'Hornet',
  },
  Chrysler: {
    'pacifica': 'Pacifica',
    'pacifica plug-in hybrid': 'Pacifica Hybrid',
    'pacifica hybrid': 'Pacifica Hybrid',
    'voyager': 'Voyager',
    '300': '300',
  },
  Ford: {
    'f-150': 'F-150',
    'f150': 'F-150',
    'f-150 lightning': 'F-150 Lightning',
    'f150 lightning': 'F-150 Lightning',
    'f-250': 'F-250 Super Duty',
    'f250': 'F-250 Super Duty',
    'f-250sd': 'F-250 Super Duty',
    'f-250 super duty': 'F-250 Super Duty',
    'f-350': 'F-350 Super Duty',
    'f350': 'F-350 Super Duty',
    'f-350sd': 'F-350 Super Duty',
    'f-350 super duty': 'F-350 Super Duty',
    'f-350 chassis': 'F-350 Super Duty',
    'f-450': 'F-450 Super Duty',
    'f450': 'F-450 Super Duty',
    'f-450sd': 'F-450 Super Duty',
    'f-450 super duty': 'F-450 Super Duty',
    'f-550': 'F-550 Super Duty',
    'f550': 'F-550 Super Duty',
    'f-550sd': 'F-550 Super Duty',
    'f-550 super duty': 'F-550 Super Duty',
    'f-600': 'F-600 Super Duty',
    'f600': 'F-600 Super Duty',
    'f-600sd': 'F-600 Super Duty',
    'f-650': 'F-650',
    'f650': 'F-650',
    'f-750': 'F-750',
    'super': 'Super Duty',
    'super duty': 'Super Duty',
    'f-series sd': 'Super Duty',
    'bronco': 'Bronco',
    'bronco sport': 'Bronco Sport',
    'explorer': 'Explorer',
    'explorer police interceptor': 'Explorer',
    'expedition': 'Expedition',
    'expedition max': 'Expedition MAX',
    'escape': 'Escape',
    'edge': 'Edge',
    'maverick': 'Maverick',
    'mustang': 'Mustang',
    'mustang mach-e': 'Mustang Mach-E',
    'ranger': 'Ranger',
    'transit': 'Transit',
    'transit commercial': 'Transit',
    'transit na': 'Transit',
    'transit van': 'Transit',
    'transit-150': 'Transit',
    'transit-250': 'Transit',
    'transit-350': 'Transit',
    'chassis cab': 'Chassis Cab',
    'e-series': 'E-Series',
    'e-series cutaway': 'E-Series',
    'e-transit': 'E-Transit',
    'etransit': 'E-Transit',
  },
  Chevrolet: {
    'silverado': 'Silverado 1500',
    'silverado 1500': 'Silverado 1500',
    'silverado 2500': 'Silverado 2500 HD',
    'silverado 2500hd': 'Silverado 2500 HD',
    'silverado 2500 hd': 'Silverado 2500 HD',
    'silverado 3500': 'Silverado 3500 HD',
    'silverado 3500hd': 'Silverado 3500 HD',
    'silverado 3500 hd': 'Silverado 3500 HD',
    'silverado 3500 hd chassis cab': 'Silverado 3500 HD',
    'silverado 4500 hd': 'Silverado 4500 HD',
    'silverado 4500hd': 'Silverado 4500 HD',
    'silverado ev': 'Silverado EV',
    'colorado': 'Colorado',
    'tahoe': 'Tahoe',
    'suburban': 'Suburban',
    'trax': 'Trax',
    'traverse': 'Traverse',
    'traverse limited': 'Traverse',
    'trailblazer': 'Trailblazer',
    'equinox': 'Equinox',
    'equinox ev': 'Equinox EV',
    'blazer': 'Blazer',
    'blazer ev': 'Blazer EV',
    'corvette': 'Corvette',
    'corvette stingray': 'Corvette',
    'corvette grand sport': 'Corvette',
    'corvette grand sport x': 'Corvette',
    'corvette z06': 'Corvette',
    'corvette zr1': 'Corvette',
    'camaro': 'Camaro',
    'malibu': 'Malibu',
    'express': 'Express',
    'express cargo': 'Express',
    'express cutaway': 'Express',
    'express cutaway 3500': 'Express',
    'express passenger': 'Express',
    'express 2500': 'Express',
    'express 3500': 'Express',
    'bolt': 'Bolt EV',
    'bolt ev': 'Bolt EV',
    'bolt euv': 'Bolt EUV',
  },
};

/**
 * Strip trademark marks — literal ® / ™, the mojibake "Â®" / "Â™" some feeds
 * produce, and the HTML entities others embed (e.g. "Lariat&#174;").
 * Also decodes common HTML entities and collapses whitespace.
 */
export function cleanRawString(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/Â\s?[®™]/g, '')                                              // mojibake Â® / Â™
    .replace(/&#0*174;|&#x0*ae;|&reg;|&#8482;|&#x2122;|&trade;/gi, '')     // HTML entities for ® / ™
    .replace(/[®™]/g, '')                                                   // literal Unicode ® / ™
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, '')
    .replace(/[&]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMake(rawMake?: string | null): string {
  const cleaned = cleanRawString(rawMake);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (lower === 'list' || lower === 'undefined' || lower === 'null') return '';

  if (CANONICAL_MAKES[lower]) {
    return CANONICAL_MAKES[lower];
  }

  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeModel(make?: string | null, rawModel?: string | null): string {
  const normMake = normalizeMake(make);
  let cleaned = cleanRawString(rawModel);
  if (!cleaned) return '';

  if (normMake) {
    const makePrefixRegex = new RegExp(`^${normMake}\\s+`, 'i');
    cleaned = cleaned.replace(makePrefixRegex, '').trim();
  }

  const lower = cleaned.toLowerCase();

  if (normMake && CANONICAL_MODELS_BY_MAKE[normMake]) {
    const makeModels = CANONICAL_MODELS_BY_MAKE[normMake];
    if (makeModels[lower]) {
      return makeModels[lower];
    }
  }

  // Generic formatting preserving acronyms like EV, HD, GT, 4xe and hyphenated names (e.g. E-Transit)
  return cleaned
    .split(' ')
    .map((w) => {
      if (w.includes('-')) {
        return w
          .split('-')
          .map((part) => {
            const upperPart = part.toUpperCase();
            if (ACRONYMS.has(upperPart) || ACRONYMS.has(part)) {
              return part.toLowerCase() === '4xe' ? '4xe' : upperPart;
            }
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          })
          .join('-');
      }
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper) || ACRONYMS.has(w)) {
        return w.toLowerCase() === '4xe' ? '4xe' : upper;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export function normalizeTrim(rawTrim?: string | null, model?: string | null): string {
  let cleaned = cleanRawString(rawTrim);
  if (!cleaned) return '';

  if (model) {
    const modelPrefixRegex = new RegExp(`^${model}\\s+`, 'i');
    cleaned = cleaned.replace(modelPrefixRegex, '').trim();
  }

  return cleaned
    .split(' ')
    .map((w) => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) {
        return upper === '4XE' ? '4xe' : upper;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// Models that include "Hybrid", "Electric", "Plug-In" etc. as part of the canonical model name.
// When the vehicle URL contains one of these keywords and the current model is the base version,
// we upgrade the model to include the powertrain suffix.
const HYBRID_MODEL_VARIANTS: Record<string, Record<string, string>> = {
  Hyundai: {
    'Santa Fe': 'Santa Fe Hybrid',
    'Tucson': 'Tucson Hybrid',
    'Palisade': 'Palisade Hybrid',
    'Elantra': 'Elantra Hybrid',
    'Sonata': 'Sonata Hybrid',
    'Kona': 'Kona Electric',
    'Ioniq': 'Ioniq Hybrid',
  },
  Kia: {
    'Sportage': 'Sportage Hybrid',
    'Sorento': 'Sorento Hybrid',
    'Telluride': 'Telluride Hybrid',
    'Carnival': 'Carnival Hybrid',
    'Niro': 'Niro EV',
  },
  Toyota: {
    'RAV4': 'RAV4 Hybrid',
    'Camry': 'Camry Hybrid',
    'Highlander': 'Highlander Hybrid',
    'Venza': 'Venza Hybrid',
    'Corolla Cross': 'Corolla Cross Hybrid',
    'Sienna': 'Sienna Hybrid',
    'Crown': 'Crown Hybrid',
    'Sequoia': 'Sequoia Hybrid',
    'Tundra': 'Tundra Hybrid',
    'Tacoma': 'Tacoma Hybrid',
    'Grand Highlander': 'Grand Highlander Hybrid',
  },
  Honda: {
    'CR-V': 'CR-V Hybrid',
    'Accord': 'Accord Hybrid',
    'Civic': 'Civic Hybrid',
  },
  Ford: {
    'F-150': 'F-150 Lightning',
    'Escape': 'Escape Hybrid',
    'Maverick': 'Maverick Hybrid',
  },
  Chrysler: {
    'Pacifica': 'Pacifica Hybrid',
  },
};

// Known canonical model prefixes per make, ordered longest first so that
// "Bronco Sport" matches before "Bronco", "Grand Cherokee L" before "Grand Cherokee", etc.
const MODEL_PREFIXES_BY_MAKE: Record<string, string[]> = {};
function getModelPrefixes(make: string): string[] {
  if (MODEL_PREFIXES_BY_MAKE[make]) return MODEL_PREFIXES_BY_MAKE[make];
  const models = CANONICAL_MODELS_BY_MAKE[make];
  if (!models) return [];
  // Collect unique canonical model names
  const canonical = new Set(Object.values(models));
  // Sort longest first so "Bronco Sport" matches before "Bronco"
  const sorted = [...canonical].sort((a, b) => b.length - a.length);
  MODEL_PREFIXES_BY_MAKE[make] = sorted;
  return sorted;
}

export function normalizeVehicle<T extends { make?: string; model?: string; trim?: string }>(vehicle: T): T {
  if (!vehicle) return vehicle;
  const normMake = normalizeMake(vehicle.make);

  let rawModel = cleanRawString(vehicle.model);
  let rawTrim = cleanRawString(vehicle.trim);

  // If make is prefixed in model, remove it
  if (normMake) {
    const makePrefixRegex = new RegExp(`^${normMake}\\s+`, 'i');
    rawModel = rawModel.replace(makePrefixRegex, '').trim();
  }

  let finalModel = rawModel;
  let extractedTrim = '';

  const lowerModel = rawModel.toLowerCase();

  if (normMake && CANONICAL_MODELS_BY_MAKE[normMake]) {
    const makeModels = CANONICAL_MODELS_BY_MAKE[normMake];
    if (makeModels[lowerModel]) {
      // Exact dictionary match
      finalModel = makeModels[lowerModel];
      const regex = new RegExp(`^${finalModel}\\s+`, 'i');
      if (regex.test(rawModel)) {
        extractedTrim = rawModel.replace(regex, '').trim();
      }
    } else {
      // Prefix-based fallback: "Bronco Badlands" → model "Bronco", trim "Badlands"
      // "Explorer Platinum" → model "Explorer", trim "Platinum"
      const prefixes = getModelPrefixes(normMake);
      for (const prefix of prefixes) {
        const prefixLower = prefix.toLowerCase();
        if (lowerModel === prefixLower) {
          finalModel = prefix;
          break;
        }
        if (lowerModel.startsWith(prefixLower + ' ')) {
          finalModel = prefix;
          extractedTrim = rawModel.slice(prefix.length).trim();
          break;
        }
      }
    }
  }

  // Handle Ford "Super Duty" series when model is "Super" / "Super Duty" / "F-xxx Super Duty"
  // and trim or vehicle_url specifies F-250 / F-350 / F-450 / F-550 / F-600
  if (normMake === 'Ford' && (finalModel.toLowerCase().includes('super duty') || finalModel.toLowerCase() === 'super' || finalModel.toLowerCase() === 'f-series sd')) {
    // cleanRawString already strips ® so F-250® becomes F-250
    const dutyMatch = (rawTrim || '').match(/(F-?\d{3})/i)
      || (rawModel || '').match(/(F-?\d{3})/i)
      || (((vehicle as any).vehicle_url || (vehicle as any).vehicleUrl || '').match(/Super[+-]Duty[+-](F[-+ ]?\d{3})/i));
    if (dutyMatch) {
      const series = dutyMatch[1].toUpperCase().replace(/^F-?(\d)/, 'F-$1');
      finalModel = `${series} Super Duty`;
      rawTrim = (rawTrim || '')
        .replace(/Duty\s*/i, '')
        .replace(new RegExp(`F-?${series.replace('F-', '')}\s*`, 'i'), '')
        .trim();
    }
  }

  // Handle Ford "Chassis Cab" → extract F-series number and convert to Super Duty
  if (normMake === 'Ford' && finalModel.toLowerCase() === 'chassis cab') {
    const seriesMatch = (rawTrim || '').match(/(F-?\d{3})/i)
      || (rawModel || '').match(/(F-?\d{3})/i)
      || (((vehicle as any).vehicle_url || (vehicle as any).vehicleUrl || '').match(/(F-?\d{3})/i));
    if (seriesMatch) {
      const series = seriesMatch[1].toUpperCase().replace(/^F-?(\d)/, 'F-$1');
      finalModel = `${series} Super Duty`;
      rawTrim = (rawTrim || '')
        .replace(new RegExp(`F-?${series.replace('F-', '')}\s*`, 'i'), '')
        .trim();
      if (!rawTrim) rawTrim = 'Chassis Cab';
    }
  }

  // Handle Ford Transit Van variations in model name
  if (normMake === 'Ford' && (lowerModel.startsWith('transit van') || lowerModel.startsWith('transit commercial') || lowerModel === 'transit na')) {
    finalModel = 'Transit';
    if (!rawTrim && (lowerModel.startsWith('transit van') || lowerModel.startsWith('transit commercial'))) {
      rawTrim = rawModel.replace(/^transit\s+(van|commercial)\s*/i, '').trim();
    }
  }

  // Handle Ford Explorer Police Interceptor
  if (normMake === 'Ford' && lowerModel === 'explorer police interceptor') {
    finalModel = 'Explorer';
    if (!rawTrim) rawTrim = 'Police Interceptor';
  }

  // Handle Chevrolet Corvette sub-models
  if (normMake === 'Chevrolet' && lowerModel.startsWith('corvette ') && lowerModel !== 'corvette') {
    finalModel = 'Corvette';
    extractedTrim = rawModel.replace(/^corvette\s+/i, '').trim();
  }

  // Handle Chevrolet Express sub-models
  if (normMake === 'Chevrolet' && lowerModel.startsWith('express ') && lowerModel !== 'express') {
    finalModel = 'Express';
    extractedTrim = rawModel.replace(/^express\s+/i, '').trim();
  }

  // Handle Kia Carnival MPV
  if (normMake === 'Kia' && lowerModel.startsWith('carnival mpv')) {
    finalModel = lowerModel.includes('hybrid') ? 'Carnival Hybrid' : 'Carnival';
    if (!rawTrim) rawTrim = 'MPV';
  }

  // Handle Kia K4 Hatchback
  if (normMake === 'Kia' && lowerModel === 'k4 hatchback') {
    finalModel = 'K4';
    if (!rawTrim) rawTrim = 'Hatchback';
  }

  if ((!rawTrim || rawTrim.toLowerCase() === 'null') && extractedTrim) {
    rawTrim = extractedTrim;
  }

  let normModel = normalizeModel(normMake, finalModel);
  const normTrim = normalizeTrim(rawTrim, normModel);

  // ── Hybrid / EV detection from vehicle URL ──
  // When the platform puts the model as "Santa Fe" but the URL says "/Santa-Fe-Hybrid/",
  // upgrade the model. Only for models we know have canonical Hybrid/EV variants.
  const vehicleUrl = ((vehicle as any).vehicleUrl || (vehicle as any).vehicle_url || '') as string;
  if (normMake && vehicleUrl && HYBRID_MODEL_VARIANTS[normMake]) {
    const hybridTarget = HYBRID_MODEL_VARIANTS[normMake][normModel];
    if (hybridTarget && normModel !== hybridTarget) {
      // Check if the URL slug contains the hybrid/electric keyword for this model
      const urlLower = vehicleUrl.toLowerCase();
      const modelSlug = normModel.toLowerCase().replace(/\s+/g, '-');
      // Look for patterns like "Santa-Fe-Hybrid", "santa_fe_hybrid", "santa+fe+hybrid"
      const hybridSuffix = hybridTarget.replace(normModel, '').trim().toLowerCase();
      const slugPatterns = [
        `${modelSlug}-${hybridSuffix.replace(/\s+/g, '-')}`,
        `${modelSlug}_${hybridSuffix.replace(/\s+/g, '_')}`,
        `${modelSlug}+${hybridSuffix.replace(/\s+/g, '+')}`,
        `${modelSlug}%20${hybridSuffix.replace(/\s+/g, '%20')}`,
      ];
      if (slugPatterns.some(p => urlLower.includes(p))) {
        normModel = hybridTarget;
      }
    }
  }

  // Also check if "hybrid" / "plug-in" / "electric" / "phev" appear in the trim
  // and the current model has a known variant — promote from trim to model.
  if (normMake && HYBRID_MODEL_VARIANTS[normMake] && normTrim) {
    const trimLower = normTrim.toLowerCase();
    const hybridTarget = HYBRID_MODEL_VARIANTS[normMake][normModel];
    if (hybridTarget && normModel !== hybridTarget) {
      if (/\bhybrid\b/i.test(trimLower) || /\bplug-?in\b/i.test(trimLower) || /\bphev\b/i.test(trimLower) || /\belectric\b/i.test(trimLower)) {
        normModel = hybridTarget;
      }
    }
  }

  return {
    ...vehicle,
    make: normMake,
    model: normModel,
    trim: normTrim || undefined,
  };
}
