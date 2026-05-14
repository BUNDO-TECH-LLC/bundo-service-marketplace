import { api } from '../lib/api';
import type { ActionRunner, AdminCategoryRecord } from '../appTypes';

export function AdminCatalogPanel({
  token,
  categories,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: AdminCategoryRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function createNewCategory() {
    const name = window.prompt('Category name', '');
    if (!name) return;
    const slug = window.prompt('Category slug', name.toLowerCase().trim().replace(/\s+/g, '-'));
    if (!slug) return;
    const iconKey = window.prompt('Icon key', 'service');
    if (!iconKey) return;

    await api('/admin/categories', {
      method: 'POST',
      token,
      body: JSON.stringify({ name, slug, iconKey }),
    });
    await refresh();
  }

  async function editCategory(category: AdminCategoryRecord) {
    const name = window.prompt('Update category name', category.name);
    if (!name) return;
    const slug = window.prompt('Update category slug', category.slug);
    if (!slug) return;
    const iconKey = window.prompt('Update icon key', category.iconKey);
    if (!iconKey) return;

    await api(`/admin/categories/${category.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ name, slug, iconKey }),
    });
    await refresh();
  }

  async function removeCategory(category: AdminCategoryRecord) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    await api(`/admin/categories/${category.id}`, {
      method: 'DELETE',
      token,
    });
    await refresh();
  }

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>Manage the public service menu</h2>
          <p>Keep categories clean so search, onboarding, and discovery stay sharp.</p>
        </div>
        <button className="primary-button" disabled={busy} onClick={() => runAction(createNewCategory, 'Category created')}>
          New category
        </button>
      </header>

      <div className="admin-record-list">
        {categories.map((category) => (
          <article className="admin-record-card" key={category.id}>
            <div className="admin-record-head">
              <div>
                <h4>{category.name}</h4>
                <p>{category.slug}</p>
              </div>
              <span className="booking-status">{category._count?.offerings || 0} offerings</span>
            </div>
            <dl className="admin-inline-list">
              <div>
                <dt>Icon key</dt>
                <dd>{category.iconKey}</dd>
              </div>
              <div>
                <dt>Linked services</dt>
                <dd>{category._count?.offerings || 0}</dd>
              </div>
            </dl>
            <div className="admin-action-row">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => editCategory(category), 'Category updated')}
              >
                Edit
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeCategory(category), 'Category deleted')}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}