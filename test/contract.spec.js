import test from 'node:test';
import assert from 'node:assert/strict';

import { JsonPlaceholderApi } from '../src/api/jsonPlaceholderApi.js';
import { HttpClient } from '../src/api/httpClient.js';
import { createMockServer } from './helpers/mockServer.js';

const LIVE_BASE_URL = 'https://jsonplaceholder.typicode.com';
const runLive = process.env.RUN_LIVE === 'true';
const liveTest = runLive ? test : test.skip;

liveTest('contract (live): user shape has all required fields with correct types', async () => {
  const api = new JsonPlaceholderApi(new HttpClient(LIVE_BASE_URL));
  const user = await api.findUserByUsername('Delphine');

  assert.equal(typeof user.id, 'number');
  assert.ok(Number.isInteger(user.id) && user.id > 0, 'id must be a positive integer');
  assert.equal(typeof user.name, 'string');
  assert.equal(typeof user.username, 'string');
  assert.equal(typeof user.email, 'string');
  assert.equal(user.username, 'Delphine');
});

liveTest('contract (live): post shape has all required fields with correct types', async () => {
  const api = new JsonPlaceholderApi(new HttpClient(LIVE_BASE_URL));
  const user = await api.findUserByUsername('Delphine');
  const posts = await api.getPostsByUserId(user.id);

  assert.ok(Array.isArray(posts) && posts.length > 0);

  for (const post of posts) {
    assert.equal(typeof post.userId, 'number');
    assert.equal(typeof post.id, 'number');
    assert.equal(typeof post.title, 'string');
    assert.equal(typeof post.body, 'string');
    assert.equal(post.userId, user.id, 'each post must belong to the queried user');
  }
});

liveTest('contract (live): comment shape has all required fields with correct types', async () => {
  const api = new JsonPlaceholderApi(new HttpClient(LIVE_BASE_URL));
  const user = await api.findUserByUsername('Delphine');
  const posts = await api.getPostsByUserId(user.id);
  const comments = await api.getCommentsByPostId(posts[0].id);

  assert.ok(Array.isArray(comments) && comments.length > 0);

  for (const comment of comments) {
    assert.equal(typeof comment.postId, 'number');
    assert.equal(typeof comment.id, 'number');
    assert.equal(typeof comment.name, 'string');
    assert.equal(typeof comment.email, 'string');
    assert.equal(typeof comment.body, 'string');
    assert.equal(comment.postId, posts[0].id, 'each comment must belong to the queried post');
  }
});

// Deterministic contract test: schema parsing catches a non-array response
test('contract (mock): non-array users response -> throws ValidationError', async () => {
  const mock = createMockServer({
    'GET /users': async ({ json }) => json(200, { id: 9, username: 'Delphine' }),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    await assert.rejects(() => api.findUserByUsername('Delphine'), (err) => {
      assert.equal(err.name, 'ValidationError');
      return true;
    });
  } finally {
    await mock.close();
  }
});

// Deterministic contract test: schema parsing catches a non-array posts response
test('contract (mock): non-array posts response -> throws ValidationError', async () => {
  const mock = createMockServer({
    'GET /users': async ({ url, json }) => {
      const username = url.searchParams.get('username') ?? '';
      return json(200, [{ id: 9, name: 'C', username, email: 'c@c.com' }]);
    },
    'GET /posts': async ({ json }) => json(200, { userId: 9, id: 1, title: 't', body: 'b' }),
  });
  const { baseUrl } = await mock.listen();

  try {
    const api = new JsonPlaceholderApi(new HttpClient(baseUrl));
    const user = await api.findUserByUsername('Delphine');
    await assert.rejects(() => api.getPostsByUserId(user.id), (err) => {
      assert.equal(err.name, 'ValidationError');
      return true;
    });
  } finally {
    await mock.close();
  }
});
