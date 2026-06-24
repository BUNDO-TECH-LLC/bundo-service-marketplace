import { useState } from 'react';
import { api } from '../lib/api';
import { CategoryFormDialog, type CategoryFormValues } from '../components/CategoryFormDialog';
import type { ActionRunner, AdminCategoryRecord } from '../appTypes';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';
import { AdminTableScrollHint } from './AdminTableScrollHint';

export function AdminCatalogPanel({
  token,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryRecord | null>(null);
  const {
    items: categories,
    total,
    page,
    limit,
    loading,
    setPage,
    reload,
  } = useAdminList<AdminCategoryRecord>({
    token,
    path: '/admin/categories',
    limit: 24,
    select: (response) => (response.categories as AdminCategoryRecord[]) ?? [],
  });

  async function refreshAfterMutation() {
    await reload();
    await refresh();
  }

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
    await refreshAfterMutation();
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
        onConfirm={(values) =>
          runAction(() => saveCategory(values), editingCategory ? 'Category updated' : 'Category created')
        }
      />

      {loading && <p className="muted">Loading categories…</p>}
      {!loading && categories.length === 0 && (
        <EmptyState title="No categories yet" body="Create your first service category to power marketplace search." />
      )}

      {categories.length > 0 && (
        <div className="admin-table-scroll-wrap">
          <AdminTableScrollHint />
          <table className="admin-catalog-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Icon</th>
                <th scope="col">Offerings</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>{category.slug}</td>
                  <td>{category.iconKey}</td>
                  <td>{category._count?.offerings || 0}</td>
                  <td>
                    <div className="admin-data-table-actions">
                      <button
                        type="button"
                        className="secondary-button admin-data-table-action"
                        disabled={busy}
                        onClick={() => {
                          setEditingCategory(category);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-button admin-data-table-action"
                        disabled={busy}
                        onClick={() =>
                          runAction(async () => {
                            if (!window.confirm(`Delete ${category.name}?`)) return;
                            await api(`/admin/categories/${category.id}`, {
                              method: 'DELETE',
                              token,
                            });
                            await refreshAfterMutation();
                          }, 'Category deleted')
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} limit={limit} total={total} busy={busy || loading} onPageChange={setPage} />
    </section>
  );
}
