import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG || 'village-homeschool',
  project: process.env.SENTRY_PROJECT || 'village-app',
  
  // Only upload source maps in production builds
  silent: true,
  
  // Upload source maps
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
