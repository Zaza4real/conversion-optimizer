"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansTiers1700000000002 = void 0;
class PlansTiers1700000000002 {
    constructor() {
        this.name = 'PlansTiers1700000000002';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE shops ALTER COLUMN plan SET DEFAULT 'free';
    `);
        await queryRunner.query(`
      UPDATE shops SET plan = 'growth' WHERE plan = 'paid';
    `);
    }
    async down(queryRunner) {
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
exports.PlansTiers1700000000002 = PlansTiers1700000000002;
