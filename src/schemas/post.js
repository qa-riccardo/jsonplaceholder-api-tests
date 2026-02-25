import { z } from 'zod';

export const PostSchema = z.object({
  userId: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
});
