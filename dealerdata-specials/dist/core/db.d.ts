import mysql from 'mysql2/promise';
import { CompetitorVehicleSpecial, StagedVisualSpecial } from '../types';
export declare class DatabaseManager {
    private static pool;
    static getPool(): mysql.Pool;
    /**
     * Syncs structured HTML / API specials into competitor_vehicle_specials table
     */
    static syncVehicleSpecials(specials: CompetitorVehicleSpecial[], dealerId: string, dealerName?: string): Promise<number>;
    /**
     * Syncs visual flyer / banner specials into specials_staging table ready for Vision AI processing
     */
    static syncSpecialsStaging(stagingItems: StagedVisualSpecial[], dealerId: string, dealerName?: string): Promise<number>;
    static close(): Promise<void>;
}
