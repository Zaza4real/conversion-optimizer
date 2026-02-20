import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';

@Entity('recommendations')
@Index('IDX_recommendations_shop_created', ['shopId', 'createdAt'])
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'shop_id', type: 'uuid' })
  shopId: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'text' })
  entityId: string;

  @Column({ type: 'text' })
  category: string;

  @Column({ name: 'rule_id', type: 'text' })
  ruleId: string;

  @Column({ type: 'text' })
  severity: string;

  @Column({ type: 'text' })
  rationale: string;

  @Column({ name: 'expected_impact', type: 'jsonb', nullable: true })
  expectedImpact: { metric?: string; low?: number; high?: number } | null;

  @Column({ name: 'patch_payload', type: 'jsonb', nullable: true })
  patchPayload: Record<string, unknown> | null;

  @Column({ type: 'text', default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop;
}
