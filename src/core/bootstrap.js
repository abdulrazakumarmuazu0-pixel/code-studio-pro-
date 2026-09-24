import { ApplicationRuntime } from './application-runtime.js';

/**
 * Phase-02 bridge. It attaches production service boundaries to the existing
 * global CodeStudio instance without changing legacy UI behavior yet.
 */
export function attachProductionRuntime(app) {
  if (!app) throw new Error('CodeStudio application instance is required.');
  if (!app.runtime) app.runtime = new ApplicationRuntime(app);
  return app.runtime;
}
