/**
 * Configuración exclusiva para la medición local con Green Metrics Tool.
 *
 * Todas las integraciones se mantienen dentro de la red de contenedores. De
 * esta forma la medición no consume accidentalmente los servicios productivos
 * de Render, Railway o Supabase Storage.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  wsApiUrl: 'http://frontend/api/v1',
  iaUrl: 'http://ai-disabled.local',
  googleRedirectUri: 'http://frontend/api/v1/auth/google/callback',
};
