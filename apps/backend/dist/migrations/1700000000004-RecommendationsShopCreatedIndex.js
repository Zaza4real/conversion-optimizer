"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationsShopCreatedIndex1700000000004 = void 0;
class RecommendationsShopCreatedIndex1700000000004 {
    constructor() {
        this.name = 'RecommendationsShopCreatedIndex1700000000004';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recommendations_shop_created"
      ON recommendations (shop_id, created_at DESC)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recommendations_shop_created"`);
    }
}
exports.RecommendationsShopCreatedIndex1700000000004 = RecommendationsShopCreatedIndex1700000000004;
