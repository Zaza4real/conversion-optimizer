"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entities = void 0;
const shop_entity_1 = require("../shops/entities/shop.entity");
const product_cache_entity_1 = require("../products-cache/entities/product-cache.entity");
const recommendation_entity_1 = require("../recommendations/entities/recommendation.entity");
const newsletter_signup_entity_1 = require("../landing/entities/newsletter-signup.entity");
exports.entities = [shop_entity_1.Shop, product_cache_entity_1.ProductCache, recommendation_entity_1.Recommendation, newsletter_signup_entity_1.NewsletterSignup];
