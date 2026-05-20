/// <reference types="vite/client" />

/**
 * Baked-in app version from apps/desktop/package.json via Vite `define`
 * (see apps/web/vite.config.ts). Used by Demo Mode to detect drift between
 * a curated payload's pipeline_version and the running build.
 */
declare const __APP_VERSION__: string;
