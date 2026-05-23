import fs from 'node:fs';
import path from 'node:path';

const files = ['src/modules/artisans/artisans.routes.ts', 'src/modules/admin/admin.routes.ts'];

const importBlock = `import { asyncHandler } from '../../middlewares/errorHandler';
import { httpError } from '../../utils/errors';
`;

for (const relativePath of files) {
  const filePath = path.join(process.cwd(), relativePath);
  let source = fs.readFileSync(filePath, 'utf8');

  if (!source.includes('asyncHandler')) {
    source = source.replace(
      /(import \{ Router \} from 'express';\n)/,
      `$1${importBlock}`
    );
  }

  source = source.replace(
    /, async \(req, res\) => \{/g,
    ', asyncHandler(async (req, res) => {'
  );

  source = source.replace(
    /return res\.status\((\d+)\)\.json\(\{\s*message:\s*('(?:\\'|[^'])*'|`(?:\\`|[^`])*`)(?:,\s*[^}]+)?\s*\}\);/g,
    (_match, status, message) => `throw httpError(${status}, ${message});`
  );

  source = source.replace(/\n\}\);\n\nexport default router;/, '\n}));\n\nexport default router;');
  source = source.replace(/\n\}\n\);\n\nexport default router;/g, '\n})\n);\n\nexport default router;');

  fs.writeFileSync(filePath, source);
  console.log('Migrated', relativePath);
}
