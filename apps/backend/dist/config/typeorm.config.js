"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTypeOrmConfig = getTypeOrmConfig;
const entities_1 = require("../entities");
function getTypeOrmConfig() {
    return {
        type: 'postgres',
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/conversion_optimizer',
        entities: entities_1.entities,
        synchronize: false,
        logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        extra: {
            max: 20,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 8000,
        },
    };
}
