import { Router, type Request, type Response } from 'express';

import { HAIRSTYLES_UI, type ApiResponse, type HairstyleListItem } from '@styleme/shared';

export const hairstylesRouter = Router();

hairstylesRouter.get('/api/hairstyles', (req: Request, res: Response<ApiResponse<HairstyleListItem[]>>) => {
  const gender = req.query.gender;
  let styles: readonly HairstyleListItem[] = HAIRSTYLES_UI;
  if (gender === 'male' || gender === 'female') {
    styles = HAIRSTYLES_UI.filter(h => h.gender === gender);
  }
  res.json({ success: true, data: [...styles] });
});
