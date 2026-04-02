import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewsletterSignups1700000000003 implements MigrationInterface {
  name = 'NewsletterSignups1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE newsletter_signups (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email      TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_newsletter_signups_created ON newsletter_signups(created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS newsletter_signups CASCADE');
  }
}
