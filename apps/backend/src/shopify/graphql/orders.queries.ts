/**
 * Order GraphQL queries for sync and conversion/revenue.
 */

export const GET_ORDERS_PAGE = `
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
