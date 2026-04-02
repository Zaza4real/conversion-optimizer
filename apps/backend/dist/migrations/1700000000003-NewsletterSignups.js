"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterSignups1700000000003 = void 0;
class NewsletterSignups1700000000003 {
    constructor() {
        this.name = 'NewsletterSignups1700000000003';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE newsletter_signups (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email      TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_newsletter_signups_created ON newsletter_signups(created_at DESC);
    `);
    }
    async down(queryRunner) {
        await queryRunner.query('DROP TABLE IF EXISTS newsletter_signups CASCADE');
    }
}
exports.NewsletterSignups1700000000003 = NewsletterSignups1700000000003;
