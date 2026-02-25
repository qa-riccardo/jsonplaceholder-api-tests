import { z } from 'zod';

export const CommentSchema = z.object({
  postId: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string(),
  body: z.string(),
});
