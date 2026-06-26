import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errorHandler';
import { listLocations } from '../../lib/nigeriaLocationCounts';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parent = typeof req.query.parent === 'string' ? req.query.parent : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const result = await listLocations({
      ...(parent ? { parent } : {}),
      ...(q ? { q } : {}),
    });

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      message: 'Locations fetched',
      parentId: result.parentId,
      locations: result.items,
    });
  })
);

export default router;
