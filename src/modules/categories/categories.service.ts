import db from '../../db/client';

export const getCategories = async () => {
  return db.category.findMany({
    orderBy: { name: 'asc' },
  });
};
