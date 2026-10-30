/**
 * Core application constants and metadata for TripSync.
 */
export const APP_CONFIG = {
  name: 'TripSync',
  tagline: 'When group travel changes, keep every balance & preference in sync.',
  milestone: 'TripSync v2.0: Group Consensus & Recalculation',
  version: '2.0.0',
  defaultCurrency: 'INR',
  supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'] as const,
  storageVersion: 'v1',
} as const;
