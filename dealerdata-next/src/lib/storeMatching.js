/**
 * Robustly matches a store from a list of stores by ID, dealership_key, or name.
 * Handles URL decoding, plus-as-space, case-insensitivity, whitespace normalization,
 * 'store_' prefixes, and fuzzy substring matches.
 */
export function normalizeKey(key) {
  if (!key) return '';
  return String(key).trim().toLowerCase().replace(/\s+/g, '_').replace(/^store_/, '');
}

export function findMatchingStore(candidateList, query) {
  if (!query || !candidateList || !Array.isArray(candidateList) || candidateList.length === 0) {
    return null;
  }

  const raw = String(query).trim();
  let decoded = raw.replace(/\+/g, ' ');
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch (e) {
    // ignore
  }

  const q = decoded.toLowerCase();
  const qAlphanumeric = q.replace(/[^a-z0-9]/g, '');
  const qNormKey = normalizeKey(q);

  // 1. Exact ID match (case-insensitive)
  let found = candidateList.find(s => s?.id && String(s.id).toLowerCase() === q);
  if (found) return found;

  // 2. Exact dealership_key match
  found = candidateList.find(s => s?.dealership_key && String(s.dealership_key).toLowerCase() === q);
  if (found) return found;

  // 3. Exact store name match
  found = candidateList.find(s => s?.name && String(s.name).trim().toLowerCase() === q);
  if (found) return found;

  // 4. Normalized dealership key match (e.g. store_aaron_kia <-> aaron_kia, spaces to _)
  if (qNormKey) {
    found = candidateList.find(s => s?.dealership_key && normalizeKey(s.dealership_key) === qNormKey);
    if (found) return found;
  }

  // 5. Alphanumeric match (ignoring spaces, hyphens, underscores)
  if (qAlphanumeric.length >= 3) {
    found = candidateList.find(s => {
      const sNameAlpha = (s?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sKeyAlpha = (s?.dealership_key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sIdAlpha = (s?.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return sNameAlpha === qAlphanumeric || sKeyAlpha === qAlphanumeric || sIdAlpha === qAlphanumeric;
    });
    if (found) return found;
  }

  // 6. Substring match on store name or dealership key
  if (q.length >= 3) {
    found = candidateList.find(s => {
      const sName = (s?.name || '').toLowerCase();
      const sKey = (s?.dealership_key || '').toLowerCase();
      return (sName && (sName.includes(q) || q.includes(sName))) ||
             (sKey && (sKey.includes(q) || q.includes(sKey)));
    });
    if (found) return found;
  }

  return null;
}
