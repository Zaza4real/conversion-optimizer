import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingToShops1700000000001 implements MigrationInterface {
  name = 'AddBillingToShops1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS recurring_charge_id TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shops
      DROP COLUMN IF EXISTS recurring_charge_id;
    `);
  }
}
