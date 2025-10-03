import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/*',
      {
        test: {
          name: 'bal-parser',
          environment: 'node',
          include: ['apps/bal-parser/**/*.test.ts'],
        }
      },{
        test: {
          name: 'bal-core-api',
          environment: 'node',
          include: ['apps/bal-core-api/**/*.test.ts'],
        }
      },{
        test: {
          name: 'ban-core-writer',
          environment: 'node',
          include: ['apps/ban-core-writer/**/*.test.ts'],
        }
      },{
        test: {
          name: 'beautifier',
          environment: 'node',
          include: ['apps/beautifier/**/*.test.ts'],
        }
      },{
        test: {
          name: 'merger',
          environment: 'node',
          include: ['apps/merger/**/*.test.ts'],
        }
      },{
        test: {
          name: 'orchestrator',
          environment: 'node',
          include: ['apps/orchestrator/**/*.test.ts'],
        }
      },{
        test: {
          name: 'target-key',
          environment: 'node',
          include: ['apps/target-key/**/*.test.ts'],
        }
      }
    ],
  },
});