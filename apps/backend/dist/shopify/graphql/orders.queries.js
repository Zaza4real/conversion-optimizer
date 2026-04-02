"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_ORDERS_PAGE = void 0;
exports.GET_ORDERS_PAGE = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount } }
          lineItems(first: 50) { edges { node { id quantity } } }
          createdAt
          sourceName
          landingSite
          referringSite
        }
      }
    }
  }
`;
