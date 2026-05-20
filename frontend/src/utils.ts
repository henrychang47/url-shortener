import { APP_BASE_PATH } from './config';

export function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function shortUrlForCode(code: string) {
  return `${window.location.origin}${APP_BASE_PATH}/r/${code}`;
}
