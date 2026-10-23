/**
 * Normalizes any website URL or hostname to a canonical root domain.
 * Examples:
 *   "https://www.normreevesford.com/new-vehicles/?page=1" -> "normreevesford.com"
 *   "http://normreevesford.com/new-inventory/index.htm"   -> "normreevesford.com"
 *   "www.mossbroscjdrriverside.com"                       -> "mossbroscjdrriverside.com"
 */
export function normalizeDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let str = rawUrl.trim().toLowerCase();
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  try {
    const parsed = new URL(str);
    let host = parsed.hostname;
    // Strip leading www. or m.
    host = host.replace(/^www\./, '').replace(/^m\./, '');
    return host;
  } catch {
    // Fallback regex if URL parse fails
    return str
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .split(':')[0]
      .trim();
  }
}

/**
 * Returns a sanitized slug version of the domain suitable for IDs or keys.
 * Example: "normreevesford.com" -> "normreevesford_com"
 */
export function getDomainSlug(rawUrl) {
  const domain = normalizeDomain(rawUrl);
  return domain.replace(/[^a-z0-9]/g, '_');
}
