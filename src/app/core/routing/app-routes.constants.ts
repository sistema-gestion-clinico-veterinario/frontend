export const APP_ROUTE_PATHS = {
  PROFILE: 'profile',
  CLINIC_PRIVACY_NOTICE: 'aviso-clinica',
  LEGAL_ACCEPTANCE: 'legal/accept'
} as const;

export const toAbsoluteRoute = (path: string): string => `/${path}`;

export const PRIVACY_RESOLUTION_ROUTES = Object.freeze([
  toAbsoluteRoute(APP_ROUTE_PATHS.CLINIC_PRIVACY_NOTICE),
  toAbsoluteRoute(APP_ROUTE_PATHS.LEGAL_ACCEPTANCE),
  toAbsoluteRoute(APP_ROUTE_PATHS.PROFILE)
]);
