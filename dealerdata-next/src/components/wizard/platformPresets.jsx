export const PLATFORM_PRESETS = {
  dealercom: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: ['Net Price', 'Total Price'],
    used_price_labels_json: [],
    api_url: null,
    api_key: null,
    api_per_page: null,
    skip_make_param: false,
    notes: 'Standard URL scraping. New inventory URL must include accountId param if present on their site.',
  },
  dealerinspire: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    api_type_slug: ['New'],
    api_per_page: 100,
    notes: 'Uses Cars Commerce API. Requires API Key from websites-search.api.carscommerce.inc. Find API key by inspecting network requests on their inventory page.',
  },
  autofi: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    use_autofi_page_price_override: false,
    use_autofi_missing_vin_page_fallback: false,
    notes: 'Requires AutoFi Dealer ID. Find it in the page source or network requests. Enable page price override if prices aren\'t loading from API.',
  },
  dealeron: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: ['Price'],
    used_price_labels_json: [],
    notes: 'Requires API URL (found in network inspector on their inventory page). No API key usually needed.',
  },
  pixelmotion: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    notes: 'Standard scrape. Check their inventory page URL structure carefully.',
  },
  teamvelocity: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    notes: 'Standard scrape.',
  },
  dealereprocess: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    notes: 'Dealer eProcess uses URL-based inventory with path filters. Check their inventory page URL structure carefully.',
  },
  other: {
    facet_labels_json: { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim' },
    new_price_labels_json: [],
    used_price_labels_json: [],
    notes: 'New platform. Fill in all fields manually. Consider adding this platform to the standard list later.',
  },
};

export const PLATFORM_OPTIONS = [
  { value: 'dealercom', label: 'DealerCom' },
  { value: 'dealerinspire', label: 'DealerInspire' },
  { value: 'autofi', label: 'AutoFi' },
  { value: 'dealeron', label: 'DealerOn' },
  { value: 'pixelmotion', label: 'PixelMotion' },
  { value: 'teamvelocity', label: 'TeamVelocity' },
  { value: 'dealereprocess', label: 'Dealer eProcess' },
  { value: 'other', label: 'Other (New Platform)' },
];

export function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').trim('_');
}

export const SUPABASE_URL = 'https://nwzlqlweltmnkqghbfej.supabase.co';