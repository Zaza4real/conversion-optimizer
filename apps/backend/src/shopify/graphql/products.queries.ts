/**
 * Product GraphQL queries for sync and scan.
 */

export const GET_PRODUCTS_PAGE = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          productType
          options { name values }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                availableForSale
                selectedOptions { name value }
              }
            }
          }
          images(first: 20) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          metafields(first: 20, namespace: "conversion_optimizer") {
            edges { node { key value } }
          }
        }
      }
    }
  }
`;

export const GET_PRODUCT_BY_ID = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      variants(first: 100) {
        edges { node { id title price compareAtPrice availableForSale } }
      }
      images(first: 30) {
        edges { node { id url altText width height } }
      }
      metafields(first: 30, namespace: "conversion_optimizer") {
        edges { node { key value } }
      }
    }
  }
`;
