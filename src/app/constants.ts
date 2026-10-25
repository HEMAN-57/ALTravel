/**
 * Core application constants and metadata for ALTravel.
 */
export const APP_CONFIG = {
  name: 'ALTravel',
  tagline: 'When travel goes wrong, find your next best move.',
  milestone: 'Milestone 1: Project Foundation',
  version: '0.1.0',
  defaultCurrency: 'INR',
  supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'] as const,
  storageVersion: 'v1',
} as const;
