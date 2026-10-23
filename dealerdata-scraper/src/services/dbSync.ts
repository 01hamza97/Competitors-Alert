import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { VehicleListing } from '../types';
import { normalizeDomain } from '../utils/domain';
import { normalizeVehicle } from '../utils/vehicleNormalization';

dotenv.config();

export class DatabaseSync {
  /**
   * Saves listings to a local JSON file in output directory
   */
  static saveToJsonFile(
    listings: VehicleListing[],
    targetDomain: string,
    outputDir = path.join(process.cwd(), 'output')
  ): string {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const normalizedListings = listings.map(normalizeVehicle);
    const cleanDomain = targetDomain.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `listings_${cleanDomain}_${timestamp}.json`;
    const fullPath = path.join(outputDir, filename);

    fs.writeFileSync(fullPath, JSON.stringify(normalizedListings, null, 2), 'utf-8');
    console.log(`[Storage] Saved ${normalizedListings.length} vehicle listings to: ${fullPath}`);
    return fullPath;
  }

  /**
   * Syncs new vehicle listings into the MySQL competitor_vehicle_inventory table
   */
  static async syncToDatabase(listings: VehicleListing[], dealerId: string): Promise<number> {
    if (listings.length === 0) return 0;

    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '1254879863',
        database: process.env.DB_NAME || 'dealerdata',
        port: parseInt(process.env.DB_PORT || '3306', 10)
      });

      const snapshotDate = new Date().toISOString().split('T')[0];
      let insertedCount = 0;

      const cleanDealerId = (dealerId || '').replace(/^store_/, '');

      for (const rawItem of listings) {
        const item = normalizeVehicle(rawItem);
        const id = `inv_${cleanDealerId}_${item.vin.trim()}`;
        const domain = normalizeDomain(item.vehicleUrl || '');

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

        const cleanMake =
          typeof item.make === 'object' && item.make !== null
            ? (item.make as any).name || 'Unknown'
            : (item.make || 'Unknown').toString();
        const cleanModel =
          typeof item.model === 'object' && item.model !== null
            ? (item.model as any).name || 'Unknown'
            : (item.model || 'Unknown').toString();
        const cleanTrim =
          typeof item.trim === 'object' && item.trim !== null
            ? (item.trim as any).name || null
            : item.trim ? item.trim.toString() : null;

        await connection.execute(query, [
          id,
          cleanDealerId,
          snapshotDate,
          item.vin,
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
    } catch (err: any) {
      console.error('[Database] Failed to sync to MySQL:', err.message);
      return 0;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Syncs structured HTML specials directly into competitor_vehicle_specials table
   */
  static async syncVehicleSpecials(
    specials: import('../types').CompetitorVehicleSpecial[],
    dealerId: string
  ): Promise<number> {
    if (specials.length === 0) return 0;

    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
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
        const domain = normalizeDomain(item.specialUrl || '');

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
    } catch (err: any) {
      console.error('[Database] Failed to sync HTML specials to MySQL:', err.message);
      return 0;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Syncs visual/flyer specials into specials_staging table ready for Vision AI processing
   */
  static async syncSpecialsStaging(
    stagingItems: import('../types').StagedVisualSpecial[],
    dealerId: string
  ): Promise<number> {
    if (stagingItems.length === 0) return 0;

    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
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
        const domain = item.domain || normalizeDomain(item.imageUrl || '');

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
    } catch (err: any) {
      console.error('[Database] Failed to stage visual specials to MySQL:', err.message);
      return 0;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}
