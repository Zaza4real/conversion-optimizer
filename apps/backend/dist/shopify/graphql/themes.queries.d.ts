export declare const GET_THEMES = "\n  query GetThemes {\n    themes(first: 10) {\n      edges {\n        node {\n          id\n          name\n          role\n        }\n      }\n    }\n  }\n";
export declare const GET_THEME_BY_ID = "\n  query GetTheme($id: ID!) {\n    theme(id: $id) {\n      id\n      name\n      role\n    }\n  }\n";
