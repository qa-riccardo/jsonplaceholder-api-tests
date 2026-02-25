import test from 'node:test';
import assert from 'node:assert/strict';

import { JsonPlaceholderApi } from '../src/api/jsonPlaceholderApi.js';
import { HttpClient } from '../src/api/httpClient.js';
import { findInvalidEmails } from '../src/utils/email.js';
import { ApiError, ValidationError } from '../src/utils/errors.js';
import { createMockServer } from './helpers/mockServer.js';

const LIVE_BASE_URL = 'https://jsonplaceholder.typicode.com';
const runLive = process.env.RUN_LIVE === 'true';
const liveTest = runLive ? test : test.skip;

liveTest('happy path (live): Delphine -> posts -> comments -> all emails valid', async () => {
  const api = new JsonPlaceholderApi(new HttpClient(LIVE_BASE_URL));

  const user = await api.findUserByUsername('Delphine');
  assert.equal(user.username, 'Delphine');

  const posts = await api.getPostsByUserId(user.id);
  assert.ok(posts.length > 0);

  const invalidByPost = [];

  for (const post of posts) {
    const comments = await api.getCommentsByPostId(post.id);
    const invalid = findInvalidEmails(comments.map((c) => c.email));
    if (invalid.length) invalidByPost.push({ postId: post.id, invalid });
  }

  assert.deepEqual(invalidByPost, []);
});

test('user not found -> throws a clear error', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      if (url.searchParams.get('username') === 'Delphine') return json(200, []);
      return json(200, []);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ApiError');
      assert.match(err.message, /User not found/);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('multiple users found -> throws to prevent ambiguous workflow', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      if (url.searchParams.get('username') === 'Delphine') {
        return json(200, [
          { id: 9, name: 'A', username: 'Delphine', email: 'a@a.com' },
          { id: 10, name: 'B', username: 'Delphine', email: 'b@b.com' },
        ]);
      }
      return json(200, []);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ApiError');
      assert.match(err.message, /Multiple users/);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('posts empty -> fail fast (unexpected for a blog author)', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    'GET /posts': async ({ json }) => json(200, []),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    const posts = await api.getPostsByUserId(user.id);

    assert.deepEqual(posts, []);
    assert.throws(() => {
      if (posts.length === 0) throw new ApiError('No posts found for user', { userId: user.id });
    }, /No posts found/);
  } finally {
    await mock.close();
  }
});

test('invalid email in comments -> detect and report invalid values', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    'GET /posts': async ({ json }) => json(200, [{ userId: 9, id: 101, title: 't', body: 'b' }]),
    'GET /comments': async ({ url, json }) => {
      const postId = Number(url.searchParams.get('postId'));
      return json(200, [
        { postId, id: 1, name: 'ok', email: 'good@example.com', body: 'x' },
        { postId, id: 2, name: 'bad', email: 'not-an-email', body: 'y' },
      ]);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    const posts = await api.getPostsByUserId(user.id);
    const comments = await api.getCommentsByPostId(posts[0].id);

    const invalid = findInvalidEmails(comments.map((c) => c.email));
    assert.deepEqual(invalid, ['not-an-email']);
  } finally {
    await mock.close();
  }
});

test('network instability: retries on 5xx then succeeds', async () => {
  let callCount = 0;
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      if (url.searchParams.get('username') !== 'Delphine') return json(200, []);
      callCount += 1;
      if (callCount === 1) return json(500, { error: 'oops' });
      return json(200, [{ id: 9, name: 'C', username: 'Delphine', email: 'c@c.com' }]);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    process.env.RETRIES = '2';
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    assert.equal(user.id, 9);
    assert.equal(callCount, 2);
  } finally {
    await mock.close();
  }
});

test('empty comments for a post -> no invalid emails (vacuously valid)', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    'GET /posts': async ({ json }) => json(200, [{ userId: 9, id: 101, title: 't', body: 'b' }]),
    'GET /comments': async ({ json }) => json(200, []),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    const posts = await api.getPostsByUserId(user.id);
    const comments = await api.getCommentsByPostId(posts[0].id);

    assert.deepEqual(comments, []);
    const invalid = findInvalidEmails(comments.map((c) => c.email));
    assert.deepEqual(invalid, []);
  } finally {
    await mock.close();
  }
});

test('malformed user response (missing required field) -> throws ValidationError', async () => {
  const mock = createMockServer({
    // Returns a user object missing the required `email` field
    'GET /users': async ({ json }) =>
      json(200, [{ id: 9, name: 'C', username: 'Delphine' /* email omitted */ }]),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ValidationError');
      assert.match(err.message, /schema validation failed/i);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('malformed post response (wrong field type) -> throws ValidationError', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    // userId should be a number, sending a string instead
    'GET /posts': async ({ json }) =>
      json(200, [{ userId: 'not-a-number', id: 101, title: 't', body: 'b' }]),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    await assert.rejects(() => api.getPostsByUserId(user.id), (err) => {
      assert.equal(err.name, 'ValidationError');
      assert.match(err.message, /schema validation failed/i);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('malformed comment response (missing email field) -> throws ValidationError', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    'GET /posts': async ({ json }) => json(200, [{ userId: 9, id: 101, title: 't', body: 'b' }]),
    // email field is missing from comments
    'GET /comments': async ({ url, json }) => {
      const postId = Number(url.searchParams.get('postId'));
      return json(200, [{ postId, id: 1, name: 'no-email', body: 'x' /* email omitted */ }]);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    const posts = await api.getPostsByUserId(user.id);
    await assert.rejects(() => api.getCommentsByPostId(posts[0].id), (err) => {
      assert.equal(err.name, 'ValidationError');
      assert.match(err.message, /schema validation failed/i);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('API returns 429 (rate-limited) -> no retry, throws ApiError with status 429', async () => {
  let callCount = 0;
  const mock = createMockServer({
    'GET /users': async ({ json }) => {
      callCount += 1;
      return json(429, { error: 'Too Many Requests' });
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ApiError');
      assert.equal(err.details.status, 429);
      return true;
    });
    // 429 is not retryable — must be called exactly once
    assert.equal(callCount, 1);
  } finally {
    await mock.close();
  }
});

test('network timeout -> retries then throws ApiError', async () => {
  let callCount = 0;
  const mock = createMockServer({
    'GET /users': async ({ delay, json }) => {
      callCount += 1;
      // Delay longer than the configured timeout to force a timeout error
      await delay(5_000);
      return json(200, []);
    },
  });
  const { baseUrl } = await mock.listen();

  try {
    // Use a very short timeout so the test doesn't take long
    const http = new HttpClient(baseUrl);
    http.client.defaults.timeout = 50;
    http.client.defaults.baseURL = baseUrl;

    const api = new JsonPlaceholderApi(http);
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ApiError');
      return true;
    });
    // Should have retried: 1 original + RETRIES attempts
    assert.ok(callCount > 1, `Expected retries, got callCount=${callCount}`);
  } finally {
    await mock.close();
  }
});
