import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
});
