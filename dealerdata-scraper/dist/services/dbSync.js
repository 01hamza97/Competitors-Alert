"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSync = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const domain_1 = require("../utils/domain");
const vehicleNormalization_1 = require("../utils/vehicleNormalization");
dotenv_1.default.config();
class DatabaseSync {
    /**
     * Saves listings to a local JSON file in output directory
     */
    static saveToJsonFile(listings, targetDomain, outputDir = path_1.default.join(process.cwd(), 'output')) {
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const normalizedListings = listings.map(vehicleNormalization_1.normalizeVehicle);
        const cleanDomain = targetDomain.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `listings_${cleanDomain}_${timestamp}.json`;
        const fullPath = path_1.default.join(outputDir, filename);
        fs_1.default.writeFileSync(fullPath, JSON.stringify(normalizedListings, null, 2), 'utf-8');
        console.log(`[Storage] Saved ${normalizedListings.length} vehicle listings to: ${fullPath}`);
        return fullPath;
    }
    /**
     * Syncs new vehicle listings into the MySQL competitor_vehicle_inventory table
     */
    static async syncToDatabase(listings, dealerId) {
        if (listings.length === 0)
            return 0;
        let connection = null;
        try {
            connection = await promise_1.default.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '1254879863',
                database: process.env.DB_NAME || 'dealerdata',
                port: parseInt(process.env.DB_PORT || '3306', 10)
            });
            const snapshotDate = new Date().toISOString().split('T')[0];
            let insertedCount = 0;
            const cleanDealerId = (dealerId || '').replace(/^store_/, '').replace(/^comp_/, '');
            const validDealerKeys = [cleanDealerId, `store_${cleanDealerId}`, `comp_${cleanDealerId}`];
            // Normalize and deduplicate scraped listings in-memory by VIN
            const uniqueListingsMap = new Map();
            for (const rawItem of listings) {
                const item = (0, vehicleNormalization_1.normalizeVehicle)(rawItem);
                const vin = (item.vin || '').trim().toUpperCase();
                if (vin && !uniqueListingsMap.has(vin)) {
                    uniqueListingsMap.set(vin, item);
                }
            }
            const activeListings = Array.from(uniqueListingsMap.values());
            const activeVinSet = new Set(uniqueListingsMap.keys());
            // 1. Check existing records in MySQL for this dealer on today's snapshot date
            try {
                const [existingRows] = await connection.query(`SELECT id, vin, dealer_id, make, model, trim, year, list_price 
           FROM competitor_vehicle_inventory 
           WHERE dealer_id IN (?, ?, ?) 
             AND snapshot_date = ?`, [cleanDealerId, `store_${cleanDealerId}`, `comp_${cleanDealerId}`, snapshotDate]);
                if (Array.isArray(existingRows) && existingRows.length > 0) {
                    const staleRowIds = [];
                    const duplicateRowIds = [];
                    const soldVehicles = [];
                    for (const row of existingRows) {
                        const rowVin = (row.vin || '').trim().toUpperCase();
                        if (!activeVinSet.has(rowVin)) {
                            // Present in today's DB snapshot but no longer on live website (Sold / Delisted)
                            staleRowIds.push(row.id);
                            soldVehicles.push({
                                vin: rowVin,
                                year: row.year,
                                make: row.make,
                                model: row.model,
                                trim: row.trim,
                                listPrice: row.list_price
                            });
                        }
                        else if (row.dealer_id !== cleanDealerId || row.id !== `inv_${cleanDealerId}_${rowVin}`) {
                            // Legacy/cross-prefix duplicate row (e.g., comp_pomona_kia vs pomona_kia)
                            duplicateRowIds.push(row.id);
                        }
                    }
                    if (staleRowIds.length > 0) {
                        console.log(`[DatabaseSync] 🚗 Detected ${staleRowIds.length} sold/delisted vehicles no longer in inventory. Purging from active snapshot ${snapshotDate}...`);
                        if (soldVehicles.length <= 10) {
                            console.log(`[DatabaseSync] Sold vehicles detail:`, soldVehicles.map(v => `${v.year} ${v.make} ${v.model} (${v.vin})`).join(', '));
                        }
                        for (let i = 0; i < staleRowIds.length; i += 500) {
                            const chunk = staleRowIds.slice(i, i + 500);
                            await connection.query(`DELETE FROM competitor_vehicle_inventory WHERE id IN (?)`, [chunk]);
                        }
                    }
                    if (duplicateRowIds.length > 0) {
                        console.log(`[DatabaseSync] 🧹 Pruning ${duplicateRowIds.length} cross-prefix duplicate rows for dealer ${cleanDealerId}...`);
                        for (let i = 0; i < duplicateRowIds.length; i += 500) {
                            const chunk = duplicateRowIds.slice(i, i + 500);
                            await connection.query(`DELETE FROM competitor_vehicle_inventory WHERE id IN (?)`, [chunk]);
                        }
                    }
                }
            }
            catch (err) {
                console.warn(`[DatabaseSync] Warning while pruning stale snapshot rows:`, err.message);
            }
            // 2. Turnover calculation vs previous snapshot date
            try {
                const [prevSnapRows] = await connection.query(`SELECT snapshot_date 
           FROM competitor_vehicle_inventory 
           WHERE dealer_id IN (?, ?, ?) 
             AND snapshot_date < ? 
           GROUP BY snapshot_date 
           ORDER BY snapshot_date DESC 
           LIMIT 1`, [cleanDealerId, `store_${cleanDealerId}`, `comp_${cleanDealerId}`, snapshotDate]);
                if (Array.isArray(prevSnapRows) && prevSnapRows.length > 0) {
                    const prevDate = prevSnapRows[0].snapshot_date;
                    const [prevVins] = await connection.query(`SELECT vin FROM competitor_vehicle_inventory 
             WHERE dealer_id IN (?, ?, ?) AND snapshot_date = ?`, [cleanDealerId, `store_${cleanDealerId}`, `comp_${cleanDealerId}`, prevDate]);
                    const prevVinSet = new Set(prevVins.map((r) => (r.vin || '').trim().toUpperCase()));
                    let soldTurnoverCount = 0;
                    for (const pVin of prevVinSet) {
                        if (!activeVinSet.has(pVin))
                            soldTurnoverCount++;
                    }
                    console.log(`[Sales Velocity] Compared with previous snapshot (${prevDate}): ${soldTurnoverCount} units sold/delisted, ${activeListings.length} active in current snapshot.`);
                }
            }
            catch (err) {
                // Non-blocking
            }
            // 3. Upsert active listings
            for (const item of activeListings) {
                const cleanVin = item.vin.trim();
                const id = `inv_${cleanDealerId}_${cleanVin}`;
                const domain = (0, domain_1.normalizeDomain)(item.vehicleUrl || '');
                const query = `
          INSERT INTO competitor_vehicle_inventory (
            id, dealer_id, snapshot_date, vin, stock_number,
            year, make, model, trim, inventory_type,
            list_price, msrp, dealer_discount, mileage,
            vehicle_url, image_url, domain, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            snapshot_date = VALUES(snapshot_date),
            year = VALUES(year),
            make = VALUES(make),
            model = VALUES(model),
            trim = VALUES(trim),
            inventory_type = VALUES(inventory_type),
            list_price = VALUES(list_price),
            msrp = VALUES(msrp),
            dealer_discount = VALUES(dealer_discount),
            mileage = VALUES(mileage),
            image_url = VALUES(image_url),
            vehicle_url = VALUES(vehicle_url),
            domain = VALUES(domain)
        `;
                const cleanMake = typeof item.make === 'object' && item.make !== null
                    ? item.make.name || 'Unknown'
                    : (item.make || 'Unknown').toString();
                const cleanModel = typeof item.model === 'object' && item.model !== null
                    ? item.model.name || 'Unknown'
                    : (item.model || 'Unknown').toString();
                const cleanTrim = typeof item.trim === 'object' && item.trim !== null
                    ? item.trim.name || null
                    : item.trim ? item.trim.toString() : null;
                await connection.execute(query, [
                    id,
                    cleanDealerId,
                    snapshotDate,
                    cleanVin,
                    item.stockNumber || null,
                    item.year,
                    cleanMake,
                    cleanModel,
                    cleanTrim,
                    item.inventoryType,
                    item.listPrice,
                    item.msrp || null,
                    item.dealerDiscount || null,
                    item.mileage || null,
                    item.vehicleUrl || null,
                    item.imageUrl || null,
                    domain || null
                ]);
                insertedCount++;
            }
            console.log(`[Database] Synced ${insertedCount} listings into competitor_vehicle_inventory for dealer ${dealerId}`);
            return insertedCount;
        }
        catch (err) {
            console.error('[Database] Failed to sync to MySQL:', err.message);
            return 0;
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
    /**
     * Syncs structured HTML specials directly into competitor_vehicle_specials table
     */
    static async syncVehicleSpecials(specials, dealerId) {
        if (specials.length === 0)
            return 0;
        let connection = null;
        try {
            connection = await promise_1.default.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '1254879863',
                database: process.env.DB_NAME || 'dealerdata',
                port: parseInt(process.env.DB_PORT || '3306', 10)
            });
            const snapshotDate = new Date().toISOString().split('T')[0];
            const cleanDealerId = (dealerId || specials[0]?.dealerId || '').replace(/^store_/, '');
            let insertedCount = 0;
            for (let i = 0; i < specials.length; i++) {
                const item = specials[i];
                const id = item.id || `spc_${cleanDealerId}_${item.year}_${item.make}_${(item.model || '').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${i}`;
                const domain = (0, domain_1.normalizeDomain)(item.specialUrl || '');
                const query = `
          INSERT INTO competitor_vehicle_specials (
            id, dealer_id, offer_dealer_name, snapshot_date,
            year, make, model, trim, special_type,
            monthly_payment, term_months, down_payment, apr, msrp,
            title, disclaimer, expiration_date, special_url, image_url, domain,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            offer_dealer_name = VALUES(offer_dealer_name),
            snapshot_date = VALUES(snapshot_date),
            year = VALUES(year),
            make = VALUES(make),
            model = VALUES(model),
            trim = VALUES(trim),
            special_type = VALUES(special_type),
            monthly_payment = VALUES(monthly_payment),
            term_months = VALUES(term_months),
            down_payment = VALUES(down_payment),
            apr = VALUES(apr),
            msrp = VALUES(msrp),
            title = VALUES(title),
            disclaimer = VALUES(disclaimer),
            expiration_date = VALUES(expiration_date),
            special_url = VALUES(special_url),
            image_url = VALUES(image_url),
            domain = VALUES(domain)
        `;
                await connection.execute(query, [
                    id,
                    cleanDealerId,
                    item.offerDealerName || null,
                    item.snapshotDate || snapshotDate,
                    item.year,
                    item.make,
                    item.model,
                    item.trim || null,
                    item.specialType || 'lease',
                    item.monthlyPayment ?? null,
                    item.termMonths ?? null,
                    item.downPayment ?? null,
                    item.apr ?? null,
                    item.msrp ?? null,
                    item.title || null,
                    item.disclaimer || null,
                    item.expirationDate || null,
                    item.specialUrl || null,
                    item.imageUrl || null,
                    domain || null
                ]);
                insertedCount++;
            }
            console.log(`[Database] Synced ${insertedCount} HTML specials into competitor_vehicle_specials for dealer ${dealerId}`);
            return insertedCount;
        }
        catch (err) {
            console.error('[Database] Failed to sync HTML specials to MySQL:', err.message);
            return 0;
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
    /**
     * Syncs visual/flyer specials into specials_staging table ready for Vision AI processing
     */
    static async syncSpecialsStaging(stagingItems, dealerId) {
        if (stagingItems.length === 0)
            return 0;
        let connection = null;
        try {
            connection = await promise_1.default.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '1254879863',
                database: process.env.DB_NAME || 'dealerdata',
                port: parseInt(process.env.DB_PORT || '3306', 10)
            });
            const snapshotDate = new Date().toISOString().split('T')[0];
            const cleanDealerId = (dealerId || stagingItems[0]?.dealerId || '').replace(/^store_/, '');
            let insertedCount = 0;
            for (let i = 0; i < stagingItems.length; i++) {
                const item = stagingItems[i];
                const id = item.id || `stg_${cleanDealerId}_${Date.now()}_${i}`;
                const domain = item.domain || (0, domain_1.normalizeDomain)(item.imageUrl || '');
                const query = `
          INSERT INTO specials_staging (
            id, dealer_id, offer_dealer_name, client_dealer_name,
            snapshot_date, special_type, title, details,
            status, raw_text, extracted_json, image_hash, domain,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            snapshot_date = VALUES(snapshot_date),
            title = VALUES(title),
            details = VALUES(details),
            status = VALUES(status),
            raw_text = VALUES(raw_text),
            extracted_json = VALUES(extracted_json),
            image_hash = VALUES(image_hash),
            domain = VALUES(domain),
            updated_at = NOW()
        `;
                await connection.execute(query, [
                    id,
                    cleanDealerId,
                    item.offerDealerName || null,
                    item.clientDealerName || item.offerDealerName || null,
                    item.snapshotDate || snapshotDate,
                    item.specialType || 'vehicle',
                    item.title || null,
                    item.details || null,
                    item.status || 'pending',
                    item.rawText || null,
                    item.extractedJson || null,
                    item.imageHash || null,
                    domain || null
                ]);
                insertedCount++;
            }
            console.log(`[Database] Staged ${insertedCount} visual specials into specials_staging for dealer ${dealerId}`);
            return insertedCount;
        }
        catch (err) {
            console.error('[Database] Failed to stage visual specials to MySQL:', err.message);
            return 0;
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
}
exports.DatabaseSync = DatabaseSync;
