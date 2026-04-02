import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('newsletter_signups')
export class NewsletterSignup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
