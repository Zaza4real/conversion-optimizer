import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductCache } from '../../products-cache/entities/product-cache.entity';
import { Recommendation } from '../../recommendations/entities/recommendation.entity';

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  domain: string;

  @Column({ type: 'bytea', name: 'access_token_enc' })
  accessTokenEnc: Buffer;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ type: 'text', default: 'starter' })
  plan: string;

  @CreateDateColumn({ name: 'installed_at' })
  installedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'uninstalled_at', nullable: true })
  uninstalledAt: Date | null;

  @OneToMany(() => ProductCache, (pc) => pc.shop)
  productsCache?: ProductCache[];

  @OneToMany(() => Recommendation, (r) => r.shop)
  recommendations?: Recommendation[];
}
