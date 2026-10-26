import mysql from 'mysql2/promise';
import { CompetitorVehicleSpecial, StagedVisualSpecial } from '../types';

export class DatabaseManager {
  private static pool: mysql.Pool | null = null;

  static getPool(): mysql.Pool {
    if (!DatabaseManager.pool) {
      DatabaseManager.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '1254879863',
        database: process.env.DB_NAME || 'dealerdata-2',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
    }
    return DatabaseManager.pool;
  }

  /**
   * Syncs structured HTML / API specials into competitor_vehicle_specials table
   */
  static async syncVehicleSpecials(
    specials: CompetitorVehicleSpecial[],
    dealerId: string,
    dealerName?: string
  ): Promise<number> {
    if (specials.length === 0) return 0;

    const pool = DatabaseManager.getPool();
    const snapshotDate = new Date().toISOString().split('T')[0];
    const cleanDealerId = dealerId.replace(/^store_/, '');
    let insertedCount = 0;

    for (let i = 0; i < specials.length; i++) {
      const item = specials[i];
      const modelSafe = (item.model || 'model').replace(/[^a-zA-Z0-9]/g, '_');
      const id = item.id || `spc_${cleanDealerId}_${item.year}_${item.make}_${modelSafe}_${Date.now()}_${i}`;

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

      try {
        await pool.execute(query, [
          id,
          cleanDealerId,
          item.offerDealerName || dealerName || null,
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
          item.domain || null
        ]);
        insertedCount++;
      } catch (err: any) {
        console.warn(`[Database] Failed to insert special ${id}: ${err.message}`);
      }
    }

    console.log(`[Database] Synced ${insertedCount} structured specials into competitor_vehicle_specials for dealer: ${dealerId}`);
    return insertedCount;
  }

  /**
   * Syncs visual flyer / banner specials into specials_staging table ready for Vision AI processing
   */
  static async syncSpecialsStaging(
    stagingItems: StagedVisualSpecial[],
    dealerId: string,
    dealerName?: string
  ): Promise<number> {
    if (stagingItems.length === 0) return 0;

    const pool = DatabaseManager.getPool();
    const snapshotDate = new Date().toISOString().split('T')[0];
    const cleanDealerId = dealerId.replace(/^store_/, '');
    let insertedCount = 0;

    for (let i = 0; i < stagingItems.length; i++) {
      const item = stagingItems[i];
      const id = item.id || `stg_${cleanDealerId}_${Date.now()}_${i}`;

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

      try {
        await pool.execute(query, [
          id,
          cleanDealerId,
          item.offerDealerName || dealerName || null,
          item.clientDealerName || dealerName || null,
          item.snapshotDate || snapshotDate,
          item.specialType || 'vehicle',
          item.title || 'Vehicle Special Flyer',
          item.details || item.imageUrl || null,
          item.status || 'pending',
          item.rawText || null,
          item.extractedJson ? JSON.stringify(item.extractedJson) : null,
          item.imageHash,
          item.domain || null
        ]);
        insertedCount++;
      } catch (err: any) {
        console.warn(`[Database] Failed to stage visual special ${id}: ${err.message}`);
      }
    }

    console.log(`[Database] Staged ${insertedCount} visual specials into specials_staging for dealer: ${dealerId}`);
    return insertedCount;
  }

  static async close(): Promise<void> {
    if (DatabaseManager.pool) {
      await DatabaseManager.pool.end().catch(() => {});
      DatabaseManager.pool = null;
    }
  }
}
