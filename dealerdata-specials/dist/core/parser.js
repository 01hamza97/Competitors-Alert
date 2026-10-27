"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecialsParser = exports.KNOWN_MAKES = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
exports.KNOWN_MAKES = [
    'Jeep', 'Ram', 'Dodge', 'Chrysler', 'Ford', 'Chevrolet', 'Chevy', 'GMC',
    'Buick', 'Cadillac', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia',
    'Subaru', 'Mazda', 'Volkswagen', 'VW', 'BMW', 'Mercedes-Benz', 'Mercedes',
    'Audi', 'Lexus', 'Acura', 'Infiniti', 'Lincoln', 'Volvo', 'Porsche',
    'Genesis', 'Land Rover', 'Jaguar', 'Alfa Romeo', 'Maserati'
];
class SpecialsParser {
    /**
     * Extracts clean numeric dollar amounts from formatted strings (e.g. "$2,499.00" -> 2499)
     */
    static parseMoney(val) {
        if (typeof val === 'number')
            return isNaN(val) ? undefined : val;
        if (!val || typeof val !== 'string')
            return undefined;
        const match = val.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+)/);
        if (!match)
            return undefined;
        const clean = match[1].replace(/,/g, '');
        const num = parseFloat(clean);
        return isNaN(num) || num <= 0 ? undefined : num;
    }
    /**
     * Extracts monthly lease or finance payments (e.g. "$389/mo", "$299 per month")
     */
    static extractMonthlyPayment(text) {
        const patterns = [
            /\$\s*([0-9]{2,4}(?:\.[0-9]{2})?)\s*(?:\/|\s*per\s*|\s+a\s+)(?:mo(?:nth)?)/i,
            /(?:lease\s+for|pay\s+only|as\s+low\s+as)\s*\$\s*([0-9]{2,4})/i,
            /\$\s*([0-9]{2,4})\s*(?:for\s+[0-9]{2}\s*mo)/i
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1]) {
                const num = parseFloat(m[1].replace(/,/g, ''));
                if (!isNaN(num) && num > 50 && num < 5000)
                    return num;
            }
        }
        return undefined;
    }
    /**
     * Extracts lease or loan term in months (e.g. "36 mos", "36 months", "for 60 months")
     */
    static extractTermMonths(text) {
        const patterns = [
            /([0-9]{2})\s*(?:months?|mos?)\b/i,
            /(?:for|over)\s*([0-9]{2})\s*(?:months?|mos?)/i,
            /term[:\s]*([0-9]{2})/i
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1]) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num) && num >= 12 && num <= 84)
                    return num;
            }
        }
        return undefined;
    }
    /**
     * Extracts down payment or total due at signing (e.g. "$3,499 due at signing", "$2,000 down")
     */
    static extractDownPayment(text) {
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
                if (!isNaN(num) && num >= 0 && num < 50000)
                    return num;
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
    static extractApr(text) {
        const patterns = [
            /([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*(?:apr|financing|interest)/i,
            /(?:apr|rate)[:\s]*([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
            /(?:as\s+low\s+as\s+)?([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*for\s*[0-9]{2}\s*mo/i
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1]) {
                const num = parseFloat(m[1]);
                if (!isNaN(num) && num >= 0 && num <= 25)
                    return num;
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
    static extractMsrp(text) {
        const patterns = [
            /msrp[:\s]*\$\s*([0-9]{2,3}(?:,[0-9]{3})*)/i,
            /\$\s*([0-9]{2,3}(?:,[0-9]{3})*)\s*msrp/i,
            /(?:starting\s+msrp|retail\s+price)[:\s]*\$\s*([0-9]{2,3}(?:,[0-9]{3})*)/i
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1]) {
                const num = parseFloat(m[1].replace(/,/g, ''));
                if (!isNaN(num) && num >= 10000 && num <= 300000)
                    return num;
            }
        }
        return undefined;
    }
    /**
     * Extracts offer expiration date
     */
    static extractExpirationDate(text) {
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
    static extractVehicleInfo(title) {
        const currentYear = new Date().getFullYear();
        const yearMatch = title.match(/\b(202[0-9])\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;
        let make = 'Unknown';
        for (const km of exports.KNOWN_MAKES) {
            const reg = new RegExp(`\\b${km}\\b`, 'i');
            if (reg.test(title)) {
                make = km;
                break;
            }
        }
        let model = 'Special Offer';
        let trim = undefined;
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
    /**
     * Fast native OCR on a flyer image file (Apple Vision on macOS)
     */
    static ocrImage(imagePath) {
        const ocrBin = path_1.default.resolve(__dirname, '../../bin/ocr');
        if (!fs_1.default.existsSync(ocrBin) || !fs_1.default.existsSync(imagePath))
            return '';
        try {
            const out = (0, child_process_1.execSync)(`"${ocrBin}" "${imagePath}"`, {
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return out
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .join(' ');
        }
        catch {
            return '';
        }
    }
    /**
     * Cross-platform OCR: uses native Apple Vision on macOS, and tesseract.js on Linux / Windows
     */
    static async ocrImageAsync(imagePath) {
        if (process.platform === 'darwin') {
            const nativeResult = this.ocrImage(imagePath);
            if (nativeResult && nativeResult.length > 5)
                return nativeResult;
        }
        try {
            // Lazy load tesseract.js so it only initializes when needed on Linux
            const { createWorker } = require('tesseract.js');
            const worker = await createWorker('eng');
            const ret = await worker.recognize(imagePath);
            await worker.terminate();
            return (ret?.data?.text || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .join(' ');
        }
        catch (err) {
            console.warn(`[OCR] Cross-platform OCR notice: ${err.message}`);
            return '';
        }
    }
    /**
     * Parses vehicle specials directly from flyer OCR text
     */
    static parseFlyerOcr(ocrText, dealerId, dealerName, flyerUrl, clickUrl, promoTitle) {
        const specials = [];
        const fullText = `${promoTitle || ''} ${ocrText || ''}`.trim();
        if (fullText.length < 5)
            return specials;
        // Detect models mentioned
        const HYUNDAI_MODELS = [
            'Palisade Hybrid',
            'Palisade',
            'Santa Fe Hybrid',
            'Santa Fe',
            'Tucson Plug-In Hybrid',
            'Tucson Hybrid',
            'Tucson',
            'Elantra Hybrid',
            'Elantra N',
            'Elantra',
            'Sonata Hybrid',
            'Sonata',
            'IONIQ 5 N',
            'IONIQ 5',
            'IONIQ 6',
            'IONIQ 9',
            'Kona Electric',
            'Kona',
            'Venue',
            'Santa Cruz'
        ];
        const matchedModels = [];
        // If promoTitle explicitly specifies a model, prioritize it
        if (promoTitle) {
            for (const m of HYUNDAI_MODELS) {
                const reg = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
                if (reg.test(promoTitle)) {
                    if (m === 'Tucson' && matchedModels.includes('Tucson Hybrid'))
                        continue;
                    if (m === 'Santa Fe' && matchedModels.includes('Santa Fe Hybrid'))
                        continue;
                    matchedModels.push(m);
                }
            }
        }
        if (matchedModels.length === 0) {
            for (const m of HYUNDAI_MODELS) {
                const reg = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
                if (reg.test(ocrText)) {
                    if (m === 'Tucson' && matchedModels.includes('Tucson Hybrid'))
                        continue;
                    if (m === 'Santa Fe' && matchedModels.includes('Santa Fe Hybrid'))
                        continue;
                    matchedModels.push(m);
                }
            }
        }
        if (matchedModels.length === 0)
            return specials;
        // Year
        let year = 2026;
        const yMatch = fullText.match(/\b(202[4-9])\b/);
        if (yMatch)
            year = parseInt(yMatch[1], 10);
        // Trim detection
        const HYUNDAI_TRIMS = [
            'Calligraphy', 'XRT Pro', 'XRT', 'Limited', 'SEL Convenience', 'SEL Sport Premium', 'SEL Premium',
            'SEL', 'Blue SEL', 'Blue', 'SE', 'N Line', 'N', 'Pro'
        ];
        let matchedTrim = undefined;
        for (const tr of HYUNDAI_TRIMS) {
            if (new RegExp(`\\b${tr}\\b`, 'i').test(fullText)) {
                matchedTrim = tr;
                break;
            }
        }
        // Payment ($179 / mo, $159 / month, $219 LEASE PER MONTH, etc.)
        const payMatch = fullText.match(/\$\s*([0-9]{2,4})\s*(?:\/|\b(?:lease\s+(?:per\s+)?month|lease|per\s+month|per|a\s+month|months?|mo|am)\b)/i);
        const monthlyPayment = payMatch ? parseFloat(payMatch[1]) : undefined;
        // Term (24 months, 36 months, etc.)
        const termMatch = fullText.match(/([0-9]{2})\s*(?:months?|mos?)/i);
        const termMonths = termMatch ? parseInt(termMatch[1], 10) : monthlyPayment ? 36 : undefined;
        // Down payment ($4,995 due at signing, $3,999 due at signing, etc.)
        const downMatch = fullText.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*)\s*due\s*at\s*signing/i);
        const downPayment = downMatch ? parseFloat(downMatch[1].replace(/,/g, '')) : undefined;
        // Off MSRP / Cash Discount
        const offMatch = fullText.match(/\$\s*([0-9]{1,2}(?:,[0-9]{3})*)\s*(?:off\s*msrp|dealer\s*discount|discount|off\b)/i);
        const discountAmount = offMatch ? parseFloat(offMatch[1].replace(/,/g, '')) : undefined;
        // APR (0% APR, etc.)
        let apr = undefined;
        if (/0%\s*(?:apr|financing)/i.test(fullText) || /financing\s*for\s*60/i.test(fullText)) {
            apr = 0;
        }
        else {
            const aprMatch = fullText.match(/([0-9.]+)\s*%\s*(?:apr|financing)/i);
            if (aprMatch)
                apr = parseFloat(aprMatch[1]);
        }
        let specialType = 'lease';
        if (apr !== undefined && apr >= 0) {
            specialType = 'apr';
        }
        else if (monthlyPayment) {
            specialType = 'lease';
        }
        else if (discountAmount) {
            specialType = 'cash';
        }
        let domain = '';
        try {
            domain = new URL(clickUrl || flyerUrl).hostname.replace(/^www\./, '');
        }
        catch { }
        for (const model of matchedModels) {
            const cleanSlug = model.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const id = `spc_${dealerId}_flyer_${year}_${cleanSlug}_${Date.now()}`;
            specials.push({
                id,
                dealerId,
                offerDealerName: dealerName,
                year,
                make: 'Hyundai',
                model,
                trim: matchedTrim,
                specialType,
                monthlyPayment: specialType === 'cash' ? discountAmount : monthlyPayment,
                termMonths: apr === 0 ? 60 : termMonths,
                downPayment: apr === 0 ? 0 : downPayment,
                apr,
                title: specialType === 'cash' && discountAmount
                    ? `${year} Hyundai ${model} - $${discountAmount.toLocaleString()} OFF MSRP`
                    : `${year} Hyundai ${model}${matchedTrim ? ' ' + matchedTrim : ''}`,
                specialUrl: clickUrl,
                imageUrl: flyerUrl,
                domain
            });
        }
        return specials;
    }
}
exports.SpecialsParser = SpecialsParser;
