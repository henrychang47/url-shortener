export const APP_BASE_PATH = '/url-shortener';
export const API_BASE_PATH = `${APP_BASE_PATH}/api`;

export function apiPath(path: string) {
  return `${API_BASE_PATH}${path}`;
}
