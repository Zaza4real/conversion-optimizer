import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Backend ESLint (flat config). Keeps CI and `npm run lint` usable without noisy legacy rules. */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['dist/**', 'node_modules/**', 'src/**/*.d.ts'] },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
