import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errorHandler';
import { getCategories } from './categories.service';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await getCategories();

    res.json({
      message: 'Categories fetched',
      categories,
    });
  })
);

export default router;
