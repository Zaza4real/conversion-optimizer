import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecommendationsShopCreatedIndex1700000000004 implements MigrationInterface {
  name = 'RecommendationsShopCreatedIndex1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recommendations_shop_created"
      ON recommendations (shop_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recommendations_shop_created"`);
  }
}
