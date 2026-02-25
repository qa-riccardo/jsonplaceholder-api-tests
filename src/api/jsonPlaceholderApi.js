import { z } from 'zod';
import { HttpClient } from './httpClient.js';
import { UserSchema } from '../schemas/user.js';
import { PostSchema } from '../schemas/post.js';
import { CommentSchema } from '../schemas/comment.js';
import { ApiError, ValidationError } from '../utils/errors.js';

export class JsonPlaceholderApi {
  constructor(http = new HttpClient()) {
    this.http = http;
  }

  async findUserByUsername(username) {
    const data = await this.http.get(`/users?username=${encodeURIComponent(username)}`);
    const parsed = z.array(UserSchema).safeParse(data);

    if (!parsed.success) {
      throw new ValidationError('Users response schema validation failed', {
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.length === 0) {
      throw new ApiError(`User not found for username: ${username}`, { username });
    }

    if (parsed.data.length > 1) {
      throw new ApiError(`Multiple users found for username: ${username}`, {
        username,
        userIds: parsed.data.map((u) => u.id),
      });
    }

    return parsed.data[0];
  }

  async getPostsByUserId(userId) {
    const data = await this.http.get(`/posts?userId=${userId}`);
    const parsed = z.array(PostSchema).safeParse(data);

    if (!parsed.success) {
      throw new ValidationError('Posts response schema validation failed', {
        issues: parsed.error.issues,
      });
    }

    return parsed.data;
  }

  async getCommentsByPostId(postId) {
    const data = await this.http.get(`/comments?postId=${postId}`);
    const parsed = z.array(CommentSchema).safeParse(data);

    if (!parsed.success) {
      throw new ValidationError('Comments response schema validation failed', {
        issues: parsed.error.issues,
      });
    }

    return parsed.data;
  }
}
