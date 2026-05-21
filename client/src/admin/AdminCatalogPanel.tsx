import { useState } from 'react';
import { api } from '../lib/api';
import { CategoryFormDialog, type CategoryFormValues } from '../components/CategoryFormDialog';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryRecord | null>(null);

  async function saveCategory(values: CategoryFormValues) {
    if (editingCategory) {
      await api(`/admin/categories/${editingCategory.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(values),
      });
    } else {
      await api('/admin/categories', {
        method: 'POST',
        token,
        body: JSON.stringify(values),
      });
    }
    setDialogOpen(false);
    setEditingCategory(null);
    await refresh();
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-toolbar">
        <p className="admin-panel-lead muted">Service categories shown in marketplace search and onboarding.</p>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => {
            setEditingCategory(null);
            setDialogOpen(true);
          }}
        >
          New category
        </button>
      </div>

      <CategoryFormDialog
        open={dialogOpen}
        title={editingCategory ? 'Edit category' : 'New category'}
        initial={
          editingCategory
            ? {
                name: editingCategory.name,
                slug: editingCategory.slug,
                iconKey: editingCategory.iconKey,
              }
            : undefined
        }
        busy={busy}
        onCancel={() => {
          setDialogOpen(false);
          setEditingCategory(null);
        }}
        onConfirm={(values) => runAction(() => saveCategory(values), editingCategory ? 'Category updated' : 'Category created')}
      />

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
                onClick={() => {
                  setEditingCategory(category);
                  setDialogOpen(true);
                }}
              >
                Edit
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    if (!window.confirm(`Delete ${category.name}?`)) return;
                    await api(`/admin/categories/${category.id}`, {
                      method: 'DELETE',
                      token,
                    });
                    await refresh();
                  }, 'Category deleted')
                }
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
