import { Router } from 'express';
import { getCategories } from './categories.service';

const router = Router();

router.get('/', async (_req, res) => {
  const categories = await getCategories();

  return res.json({
    message: 'Categories fetched',
    categories,
  });
});

export default router;
