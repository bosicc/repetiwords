// Only shared pages can be authentication return destinations. Never redirect
// to an arbitrary URL supplied through a query string or form field.
export function authReturn(value) {
  return typeof value === 'string' && /^\/shared\/(?:[a-f0-9]{64}(?:\?save=1)?|practice\/[a-f0-9-]{36})$/.test(value) ? value : '/';
}
