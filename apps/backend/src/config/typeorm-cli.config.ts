import { DataSource } from 'typeorm';
import * as path from 'path';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/conversion_optimizer',
  entities: [],
  migrations: [path.join(__dirname, '..', 'migrations', '*.ts')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['migration'] : false,
});
