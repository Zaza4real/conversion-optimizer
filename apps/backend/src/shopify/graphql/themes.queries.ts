/**
 * Theme GraphQL queries (active theme; we do not edit theme files).
 */

export const GET_THEMES = `
  query GetThemes {
    themes(first: 10) {
      edges {
        node {
          id
          name
          role
        }
      }
    }
  }
`;

export const GET_THEME_BY_ID = `
  query GetTheme($id: ID!) {
    theme(id: $id) {
      id
      name
      role
    }
  }
`;
