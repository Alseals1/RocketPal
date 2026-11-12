export const APP_TITLE = 'Rocket Pals';

/** Debug mode (the `window.rocketPals` test handle and debug scene options) is on only for `?debug=1`. */
export function isDebugOn(params: URLSearchParams): boolean {
  return params.get('debug') === '1';
}
