/**
 * Defers construction of an SDK client until one of its properties is used.
 * Most authenticated reads use the application's opaque session and never need
 * the Supabase SDK, so eagerly constructing it wastes Worker CPU on every call.
 */
export function createLazyClient(factory, ...args) {
  let client;
  return new Proxy(Object.create(null), {
    get(_target, property) {
      client ||= factory(...args);
      const value = Reflect.get(client, property, client);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}
