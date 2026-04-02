"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_THEME_BY_ID = exports.GET_THEMES = void 0;
exports.GET_THEMES = `
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
exports.GET_THEME_BY_ID = `
  query GetTheme($id: ID!) {
    theme(id: $id) {
      id
      name
      role
    }
  }
`;
