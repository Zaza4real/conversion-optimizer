import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlansTiers1700000000002 implements MigrationInterface {
  name = 'PlansTiers1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shops ALTER COLUMN plan SET DEFAULT 'free';
    `);
    await queryRunner.query(`
      UPDATE shops SET plan = 'growth' WHERE plan = 'paid';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE shops SET plan = 'starter' WHERE plan = 'free';
    `);
    await queryRunner.query(`
      UPDATE shops SET plan = 'paid' WHERE plan IN ('starter', 'growth', 'pro');
    `);
    await queryRunner.query(`
      ALTER TABLE shops ALTER COLUMN plan SET DEFAULT 'starter';
    `);
  }
}
