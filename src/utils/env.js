export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://jsonplaceholder.typicode.com',
  timeoutMs: Number(process.env.TIMEOUT_MS ?? 10_000),
  retries: Number(process.env.RETRIES ?? 2),
};
