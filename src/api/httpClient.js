import axios from 'axios';
import { env } from '../utils/env.js';
import { ApiError } from '../utils/errors.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryable = (err) => {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === undefined || (status >= 500 && status <= 599);
};

export class HttpClient {
  constructor(baseURL = env.baseUrl) {
    this.client = axios.create({
      baseURL,
      timeout: env.timeoutMs,
      headers: { Accept: 'application/json' },
    });
  }

  async get(url, config) {
    const maxRetries = env.retries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.client.get(url, config);
        return res.data;
      } catch (err) {
        const shouldRetry = attempt < maxRetries && isRetryable(err);
        if (!shouldRetry) {
          throw new ApiError('HTTP GET failed', {
            url,
            baseURL: this.client.defaults.baseURL,
            status: err.response?.status,
            data: err.response?.data,
            message: err.message,
          });
        }
        await sleep(250 * 2 ** attempt);
      }
    }

    throw new ApiError('HTTP GET failed after retries', { url });
  }
}
