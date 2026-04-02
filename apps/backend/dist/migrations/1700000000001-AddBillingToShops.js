"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBillingToShops1700000000001 = void 0;
class AddBillingToShops1700000000001 {
    constructor() {
        this.name = 'AddBillingToShops1700000000001';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS recurring_charge_id TEXT;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE shops
      DROP COLUMN IF EXISTS recurring_charge_id;
    `);
    }
}
exports.AddBillingToShops1700000000001 = AddBillingToShops1700000000001;
