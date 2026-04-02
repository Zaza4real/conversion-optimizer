"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const path = require("path");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production. Set it in Railway (Variables) from your PostgreSQL service.');
}
exports.default = new typeorm_1.DataSource({
    type: 'postgres',
    url: databaseUrl || 'postgresql://postgres:postgres@localhost:5432/conversion_optimizer',
    entities: [],
    migrations: [path.join(__dirname, '..', 'migrations', '*.ts')],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development' ? ['migration'] : false,
});
