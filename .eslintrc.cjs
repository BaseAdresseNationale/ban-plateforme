module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-stylistic/recommended'
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.base.json'
      },
      node: {
        extensions: ['.ts', '.js']
      }
    }
  },
  rules: {
    'import/extensions': ['error', 'ignorePackages', {
      'ts': 'always',
      'js': 'always'
    }]
  },
  env: {
    es2022: true,
    node: true
  },
  ignorePatterns: ['dist', 'node_modules']
};