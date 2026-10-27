export declare const KNOWN_MAKES: string[];
export declare class SpecialsParser {
    /**
     * Extracts clean numeric dollar amounts from formatted strings (e.g. "$2,499.00" -> 2499)
     */
    static parseMoney(val: any): number | undefined;
    /**
     * Extracts monthly lease or finance payments (e.g. "$389/mo", "$299 per month")
     */
    static extractMonthlyPayment(text: string): number | undefined;
    /**
     * Extracts lease or loan term in months (e.g. "36 mos", "36 months", "for 60 months")
     */
    static extractTermMonths(text: string): number | undefined;
    /**
     * Extracts down payment or total due at signing (e.g. "$3,499 due at signing", "$2,000 down")
     */
    static extractDownPayment(text: string): number | undefined;
    /**
     * Extracts annual percentage rate (e.g. "0.9% APR", "1.9% financing for 60 mos")
     */
    static extractApr(text: string): number | undefined;
    /**
     * Extracts manufacturer suggested retail price (MSRP)
     */
    static extractMsrp(text: string): number | undefined;
    /**
     * Extracts offer expiration date
     */
    static extractExpirationDate(text: string): string | undefined;
    /**
     * Identifies vehicle Year, Make, Model, and Trim from a text string
     */
    static extractVehicleInfo(title: string): {
        year: number;
        make: string;
        model: string;
        trim?: string;
    };
    /**
     * Fast native OCR on a flyer image file (Apple Vision on macOS)
     */
    static ocrImage(imagePath: string): string;
    /**
     * Cross-platform OCR: uses native Apple Vision on macOS, and tesseract.js on Linux / Windows
     */
    static ocrImageAsync(imagePath: string): Promise<string>;
    /**
     * Parses vehicle specials directly from flyer OCR text
     */
    static parseFlyerOcr(ocrText: string, dealerId: string, dealerName: string, flyerUrl: string, clickUrl: string, promoTitle?: string): {
        id: string;
        dealerId: string;
        offerDealerName: string;
        year: number;
        make: string;
        model: string;
        trim?: string;
        specialType: 'lease' | 'finance' | 'apr' | 'cash';
        monthlyPayment?: number;
        termMonths?: number;
        downPayment?: number;
        apr?: number;
        title: string;
        specialUrl?: string;
        imageUrl?: string;
        domain?: string;
    }[];
}
