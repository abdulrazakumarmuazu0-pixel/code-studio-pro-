/**
 * Central runtime configuration.
 * No secrets belong in this file. Production secrets must be injected by the
 * deployment environment and consumed by the future backend services.
 */
export const config = Object.freeze({
  appName: 'Code Studio Pro',
  environment: globalThis.__CODE_STUDIO_ENV__ || 'development',
  apiBaseUrl: globalThis.__CODE_STUDIO_API_BASE_URL__ || '',
  workspaceApiUrl: globalThis.__CODE_STUDIO_WORKSPACE_API_URL__ || '',
  deploymentApiUrl: globalThis.__CODE_STUDIO_DEPLOYMENT_API_URL__ || '',
  features: Object.freeze({
    cloudAuth: Boolean(globalThis.__CODE_STUDIO_API_BASE_URL__),
    cloudWorkspace: Boolean(globalThis.__CODE_STUDIO_WORKSPACE_API_URL__),
    cloudDeployment: Boolean(globalThis.__CODE_STUDIO_DEPLOYMENT_API_URL__)
  })
});
