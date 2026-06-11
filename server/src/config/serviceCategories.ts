import fs from 'node:fs';
import path from 'node:path';

export type ServiceCategorySeed = {
  name: string;
  slug: string;
  iconKey: string;
  description: string;
};

function loadServiceCategories(): ServiceCategorySeed[] {
  const catalogPath = path.resolve(__dirname, '../../../shared/service-categories.json');
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as ServiceCategorySeed[];
}

export const SERVICE_CATEGORIES = loadServiceCategories();
