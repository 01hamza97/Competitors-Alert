export const KNOWN_MAKES = [
  'Jeep', 'Ram', 'Dodge', 'Chrysler', 'Ford', 'Chevrolet', 'Chevy', 'GMC',
  'Buick', 'Cadillac', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia',
  'Subaru', 'Mazda', 'Volkswagen', 'VW', 'BMW', 'Mercedes-Benz', 'Mercedes',
  'Audi', 'Lexus', 'Acura', 'Infiniti', 'Lincoln', 'Volvo', 'Porsche',
  'Genesis', 'Land Rover', 'Jaguar', 'Alfa Romeo', 'Maserati'
];

export class SpecialsParser {
  /**
   * Extracts clean numeric dollar amounts from formatted strings (e.g. "$2,499.00" -> 2499)
   */
  static parseMoney(val: any): number | undefined {
    if (typeof val === 'number') return isNaN(val) ? undefined : val;
    if (!val || typeof val !== 'string') return undefined;
    const match = val.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+)/);
    if (!match) return undefined;
    const clean = match[1].replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? undefined : num;
  }

  /**
   * Extracts monthly lease or finance payments (e.g. "$389/mo", "$299 per month")
   */
  static extractMonthlyPayment(text: string): number | undefined {
    const patterns = [
      /\$\s*([0-9]{2,4}(?:\.[0-9]{2})?)\s*(?:\/|\s*per\s*|\s+a\s+)(?:mo(?:nth)?)/i,
      /(?:lease\s+for|pay\s+only|as\s+low\s+as)\s*\$\s*([0-9]{2,4})/i,
      /\$\s*([0-9]{2,4})\s*(?:for\s+[0-9]{2}\s*mo)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 50 && num < 5000) return num;
      }
    }
    return undefined;
  }

  /**
   * Extracts lease or loan term in months (e.g. "36 mos", "36 months", "for 60 months")
   */
  static extractTermMonths(text: string): number | undefined {
    const patterns = [
      /([0-9]{2})\s*(?:months?|mos?)\b/i,
      /(?:for|over)\s*([0-9]{2})\s*(?:months?|mos?)/i,
      /term[:\s]*([0-9]{2})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num >= 12 && num <= 84) return num;
      }
    }
    return undefined;
  }

  /**
   * Extracts down payment or total due at signing (e.g. "$3,499 due at signing", "$2,000 down")
   */
  static extractDownPayment(text: string): number | undefined {
    const patterns = [
      /\$\s*([0-9]{1,3}(?:,[0-9]{3})*)\s*(?:due\s+at\s+signing|das|total\s+due)/i,
      /(?:due\s+at\s+signing|total\s+due|das)[:\s]*\$\s*([0-9]{1,3}(?:,[0-9]{3})*)/i,
      /\$\s*([0-9]{1,3}(?:,[0-9]{3})*)\s*(?:down(?:\s+payment)?)/i,
      /(?:down\s+payment|down)[:\s]*\$\s*([0-9]{1,3}(?:,[0-9]{3})*)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(num) && num >= 0 && num < 50000) return num;
      }
    }
    if (/(\$0\s*down|zero\s*down|\$0\s*due\s*at\s*signing)/i.test(text)) {
      return 0;
    }
    return undefined;
  }

  /**
   * Extracts annual percentage rate (e.g. "0.9% APR", "1.9% financing for 60 mos")
   */
  static extractApr(text: string): number | undefined {
    const patterns = [
      /([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*(?:apr|financing|interest)/i,
      /(?:apr|rate)[:\s]*([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
      /(?:as\s+low\s+as\s+)?([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*for\s*[0-9]{2}\s*mo/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseFloat(m[1]);
        if (!isNaN(num) && num >= 0 && num <= 25) return num;
      }
    }
    if (/0%\s*(?:apr|financing)/i.test(text)) {
      return 0;
    }
    return undefined;
  }

  /**
   * Extracts manufacturer suggested retail price (MSRP)
   */
  static extractMsrp(text: string): number | undefined {
    const patterns = [
      /msrp[:\s]*\$\s*([0-9]{2,3}(?:,[0-9]{3})*)/i,
      /\$\s*([0-9]{2,3}(?:,[0-9]{3})*)\s*msrp/i,
      /(?:starting\s+msrp|retail\s+price)[:\s]*\$\s*([0-9]{2,3}(?:,[0-9]{3})*)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(num) && num >= 10000 && num <= 300000) return num;
      }
    }
    return undefined;
  }

  /**
   * Extracts offer expiration date
   */
  static extractExpirationDate(text: string): string | undefined {
    const patterns = [
      /(?:expires|exp\.?|offer\s+ends|valid\s+thru|until)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/(?:20)?[0-9]{2})/i,
      /(?:expires|exp\.?|offer\s+ends|valid\s+thru|until)[:\s]*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{1,2},?\s*(?:20)?[0-9]{2})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      }
    }
    return undefined;
  }

  /**
   * Identifies vehicle Year, Make, Model, and Trim from a text string
   */
  static extractVehicleInfo(title: string): {
    year: number;
    make: string;
    model: string;
    trim?: string;
  } {
    const currentYear = new Date().getFullYear();
    const yearMatch = title.match(/\b(202[0-9])\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;

    let make = 'Unknown';
    for (const km of KNOWN_MAKES) {
      const reg = new RegExp(`\\b${km}\\b`, 'i');
      if (reg.test(title)) {
        make = km;
        break;
      }
    }

    let model = 'Special Offer';
    let trim: string | undefined = undefined;

    // Remove year and make from title to extract model
    const cleanTitle = title
      .replace(new RegExp(`\\b${year}\\b`, 'g'), '')
      .replace(new RegExp(`\\b${make}\\b`, 'gi'), '')
      .replace(/\b(new|used|certified|lease|special|offer|monthly|payment|apr)\b/gi, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim();

    const parts = cleanTitle.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      model = parts.slice(0, 2).join(' ');
      if (parts.length > 2) {
        trim = parts.slice(2).join(' ');
      }
    }

    return { year, make, model, trim };
  }
}
