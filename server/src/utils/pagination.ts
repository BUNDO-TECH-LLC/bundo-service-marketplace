import { Request } from 'express';

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

export const getPagination = (req: Request, defaultLimit = 20): Pagination => {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 50)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const paginationMeta = (pagination: Pagination) => ({
  page: pagination.page,
  limit: pagination.limit,
});

export const paginationArgs = (
  pagination?: Pagination,
  defaultLimit?: number
): { take?: number; skip?: number } => {
  if (!pagination) {
    return defaultLimit === undefined ? {} : { take: defaultLimit };
  }

  return {
    take: pagination.limit,
    skip: pagination.skip,
  };
};
