// Platform-aware scraper configuration rules
// required: fields that must be filled before scraper_active can be enabled
// primary: fields shown in the main form (above the fold)
// recommended: fields shown in the main form but not strictly required
// advanced: fields hidden behind "Advanced Settings"
// helperText: guidance blurb shown in the Platform Requirements box

export const PLATFORMS = ['dealercom', 'dealerinspire', 'autofi', 'dealeron', 'pixelmotion', 'teamvelocity', 'dealereprocess'];

export const PLATFORM_RULES = {
  dealercom: {
    label: 'Dealer.com',
    helperText: "Dealer.com usually uses URL/filter scraping. API URL is usually not required. Some stores need default_make because the site has no make selector.",
    required: ['new_inventory_url', 'facet_labels_json', 'new_price_labels_json'],
    primary: ['new_inventory_url', 'used_inventory_url', 'scraper_default_make', 'new_price_labels_json', 'used_price_labels_json', 'skip_make_param'],
    recommended: ['used_inventory_url', 'scraper_default_make', 'filter_examples_json', 'skip_make_param'],
    advanced: ['api_url', 'api_key', 'api_per_page', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'dealerinspire_facet_fields', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback'],
  },
  dealerinspire: {
    label: 'Dealer Inspire',
    helperText: "Dealer Inspire often uses the CarsCommerce listings API. Some rooftops require location filters like custom_text_3 or custom_text_12. API URL and API key are usually required.",
    required: ['new_inventory_url', 'api_url', 'api_key', 'api_per_page'],
    primary: ['new_inventory_url', 'used_inventory_url', 'api_url', 'api_key', 'api_per_page', 'new_price_labels_json', 'used_price_labels_json'],
    recommended: ['api_type_slug', 'api_inventory_types', 'api_sort', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_location_values', 'facet_labels_json', 'filter_examples_json'],
    advanced: ['api_limit', 'dealerinspire_facet_fields', 'skip_make_param', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback'],
  },
  autofi: {
    label: 'AutoFi',
    helperText: "AutoFi requires autofi_dealer_id to request the correct rooftop inventory. Some sites need page price override or missing VIN fallback.",
    required: ['new_inventory_url', 'api_url', 'autofi_dealer_id'],
    primary: ['new_inventory_url', 'used_inventory_url', 'api_url', 'autofi_dealer_id', 'new_price_labels_json', 'used_price_labels_json', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback'],
    recommended: ['api_limit', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback', 'new_price_labels_json'],
    advanced: ['api_key', 'api_per_page', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'facet_labels_json', 'filter_examples_json', 'dealerinspire_facet_fields', 'skip_make_param'],
  },
  dealeron: {
    label: 'DealerOn',
    helperText: "DealerOn often uses an SRP API URL plus URL filter examples for year/make/model/trim.",
    required: ['new_inventory_url', 'api_url'],
    primary: ['new_inventory_url', 'used_inventory_url', 'api_url', 'new_price_labels_json', 'used_price_labels_json', 'filter_examples_json'],
    recommended: ['filter_examples_json', 'new_price_labels_json'],
    advanced: ['api_key', 'api_per_page', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'facet_labels_json', 'dealerinspire_facet_fields', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback', 'skip_make_param'],
  },
  pixelmotion: {
    label: 'Pixel Motion',
    helperText: "Pixel Motion usually uses path-based filter URLs such as /inventory/new/2026/Ford/F-150/.",
    required: ['new_inventory_url', 'facet_labels_json', 'filter_examples_json'],
    primary: ['new_inventory_url', 'used_inventory_url', 'facet_labels_json', 'filter_examples_json', 'new_price_labels_json', 'used_price_labels_json'],
    recommended: ['new_price_labels_json'],
    advanced: ['api_url', 'api_key', 'api_per_page', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'dealerinspire_facet_fields', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback', 'skip_make_param'],
  },
  teamvelocity: {
    label: 'Team Velocity',
    helperText: "Team Velocity fields are currently stored in extra_config_json unless/until promoted to schema fields.",
    required: ['new_inventory_url'],
    primary: ['new_inventory_url', 'used_inventory_url', 'scraper_default_make', 'new_price_labels_json', 'used_price_labels_json'],
    recommended: ['scraper_default_make'],
    advanced: ['api_url', 'api_key', 'api_per_page', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'facet_labels_json', 'filter_examples_json', 'dealerinspire_facet_fields', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback', 'skip_make_param'],
    // teamvelocity extra_config_json keys required
    requiredExtraKeys: ['teamvelocity_account_id', 'teamvelocity_make'],
    recommendedExtraKeys: ['teamvelocity_test_vdp_url'],
  },
  dealereprocess: {
    label: 'Dealer eProcess',
    helperText: "Dealer eProcess uses URL-based inventory with path-based filters for year/make/model/trim.",
    required: ['new_inventory_url', 'facet_labels_json', 'filter_examples_json'],
    primary: ['new_inventory_url', 'used_inventory_url', 'facet_labels_json', 'filter_examples_json', 'new_price_labels_json', 'used_price_labels_json'],
    recommended: ['new_price_labels_json', 'scraper_default_make'],
    advanced: ['api_url', 'api_key', 'api_per_page', 'api_limit', 'api_sort_field', 'api_sort_order', 'api_location_field', 'api_inventory_types', 'api_type_slug', 'api_location_values', 'api_sort', 'dealerinspire_facet_fields', 'autofi_dealer_id', 'use_autofi_page_price_override', 'use_autofi_missing_vin_page_fallback', 'skip_make_param'],
  },
};

// Fields that are boolean toggles
export const TOGGLE_FIELDS = {
  skip_make_param: 'Skip Make Param',
  use_autofi_page_price_override: 'AutoFi Page Price Override',
  use_autofi_missing_vin_page_fallback: 'AutoFi Missing VIN Fallback',
};

// Human-readable labels for all fields
export const FIELD_LABELS = {
  new_inventory_url: 'New Inventory URL',
  used_inventory_url: 'Used Inventory URL',
  api_url: 'API URL',
  api_key: 'API Key',
  api_per_page: 'API Per Page',
  api_limit: 'API Limit',
  api_sort_field: 'API Sort Field',
  api_sort_order: 'API Sort Order',
  api_location_field: 'API Location Field',
  api_inventory_types: 'API Inventory Types',
  api_type_slug: 'API Type Slug',
  api_location_values: 'API Location Values',
  api_sort: 'API Sort (JSON array)',
  autofi_dealer_id: 'AutoFi Dealer ID',
  facet_labels_json: 'Facet Labels',
  filter_examples_json: 'Filter Examples',
  dealerinspire_facet_fields: 'DealerInspire Facet Fields',
  new_price_labels_json: 'New Price Labels',
  used_price_labels_json: 'Used Price Labels',
  scraper_default_make: 'Default Make',
  skip_make_param: 'Skip Make Param',
  use_autofi_page_price_override: 'AutoFi Page Price Override',
  use_autofi_missing_vin_page_fallback: 'AutoFi Missing VIN Fallback',
  extra_config_json: 'Raw Advanced JSON (extra_config_json)',
};

// Returns list of missing required fields for a given platform + form values
export function getMissingRequiredFields(platform, form, idField) {
  const rules = PLATFORM_RULES[platform];
  if (!rules) return [];
  const missing = [];
  // Always check the ID field (scraper_store_id or competitor_id)
  if (!form[idField]?.trim?.()) missing.push(idField === 'scraper_store_id' ? 'Scraper Store ID' : 'Competitor ID');
  // Check platform required fields
  for (const f of rules.required) {
    const v = form[f];
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)) {
      missing.push(FIELD_LABELS[f] || f);
    }
  }
  // Check extra_config_json keys for teamvelocity
  if (rules.requiredExtraKeys) {
    const extra = form.extra_config_json || {};
    for (const k of rules.requiredExtraKeys) {
      if (!extra[k]) missing.push(k);
    }
  }
  return missing;
}