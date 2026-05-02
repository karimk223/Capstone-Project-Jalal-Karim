/**
 * src/pages/UserManagement.jsx
 * UI polish pass (Day 3, hours 5–7):
 *   - Replaced all alert() calls with toast.error() / toast.success()
 *   - All hardcoded strings routed through t() — NFR-4
 *   - Loading/error/empty states consistent with ComplaintList pattern
 *   - Submit buttons disabled while pending — conventions §5.4
 *
 * Implements FR-1 (account creation), FR-4 (disable without deletion).
 * Addresses Gap 5 (real RBAC — Admin-only, enforced by ProtectedRoute + backend).
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getStaff, createStaff, updateStaff } from '../api/admin';
import { getRoles } from '../api/lookups';

export default function UserManagement() {
  const { t } = useTranslation();

  const [staffList, setStaffList] = useState([]);
  const [roles, setRoles]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '', email: '', password: '', role_id: '2',
  });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating]   = useState(false);

  // Edit state
  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [staffData, rolesData] = await Promise.all([getStaff(), getRoles()]);
      setStaffList(staffData);
      setRoles(rolesData);
    } catch (err) {
      setError(err.message || t('users.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  // ── Create ──────────────────────────────────────────────────────────────
  function handleCreateChange(e) {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.password) {
      setCreateError(t('users.createAllRequired'));
      return;
    }
    setIsCreating(true);
    try {
      await createStaff({
        full_name: createForm.full_name.trim(),
        email:     createForm.email.trim(),
        password:  createForm.password,
        role_id:   Number(createForm.role_id),
      });
      toast.success(t('users.createSuccess'));
      setCreateForm({ full_name: '', email: '', password: '', role_id: '2' });
      setShowCreate(false);
      await loadStaff();
    } catch (err) {
      setCreateError(err.message || t('users.errorCreate'));
    } finally {
      setIsCreating(false);
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  function startEdit(member) {
    setEditId(member.staff_id);
    setEditForm({ role_id: String(member.role_id), is_active: member.is_active });
  }

  async function handleSaveEdit(staffId) {
    setIsEditing(true);
    try {
      await updateStaff(staffId, {
        role_id:   Number(editForm.role_id),
        is_active: Number(editForm.is_active),
      });
      toast.success(t('users.updateSuccess'));
      setEditId(null);
      await loadStaff();
    } catch (err) {
      toast.error(err.message || t('users.errorUpdate'));
    } finally {
      setIsEditing(false);
    }
  }

  async function toggleActive(member) {
    try {
      await updateStaff(member.staff_id, { is_active: member.is_active ? 0 : 1 });
      toast.success(
        member.is_active ? t('users.disableSuccess') : t('users.enableSuccess')
      );
      await loadStaff();
    } catch (err) {
      toast.error(err.message || t('users.errorUpdate'));
    }
  }

  const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
    'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('users.title')}</h1>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-ministry-700 px-4 py-2 text-sm font-medium text-white hover:bg-ministry-800"
        >
          {showCreate ? t('common.cancel') : t('users.newUser')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('users.createTitle')}
          </h2>
          {createError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('register.fullName')} *</label>
              <input type="text" name="full_name" value={createForm.full_name}
                onChange={handleCreateChange} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('register.email')} *</label>
              <input type="email" name="email" value={createForm.email}
                onChange={handleCreateChange} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('register.password')} *</label>
              <input type="password" name="password" value={createForm.password}
                onChange={handleCreateChange} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('register.role')} *</label>
              <select name="role_id" value={createForm.role_id}
                onChange={handleCreateChange} className={`mt-1 ${inputClass}`}>
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <button type="submit" disabled={isCreating}
                className="rounded-md bg-ministry-700 px-4 py-2 text-sm font-medium text-white hover:bg-ministry-800 disabled:opacity-60">
                {isCreating ? t('common.loading') : t('register.submit')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-gray-500">{t('common.loading')}</div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Empty state */}
      {!isLoading && !error && staffList.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">{t('users.empty')}</p>
        </div>
      )}

      {/* Staff table */}
      {!isLoading && !error && staffList.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users.colName')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users.colEmail')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users.colRole')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users.colStatus')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t('users.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.map((member) => (
                <tr key={member.staff_id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{member.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>

                  <td className="px-4 py-3">
                    {editId === member.staff_id ? (
                      <select value={editForm.role_id}
                        onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm">
                        {roles.map((r) => (
                          <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-700">{member.role_name || member.role_id}</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {member.is_active ? t('profile.active') : t('profile.disabled')}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editId === member.staff_id ? (
                        <>
                          <button type="button" onClick={() => handleSaveEdit(member.staff_id)}
                            disabled={isEditing}
                            className="rounded-md bg-ministry-700 px-3 py-1 text-xs font-medium text-white hover:bg-ministry-800 disabled:opacity-60">
                            {t('common.save')}
                          </button>
                          <button type="button" onClick={() => setEditId(null)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">
                            {t('common.cancel')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(member)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">
                            {t('users.edit')}
                          </button>
                          <button type="button" onClick={() => toggleActive(member)}
                            className={`rounded-md px-3 py-1 text-xs font-medium ${
                              member.is_active
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}>
                            {member.is_active ? t('users.disable') : t('users.enable')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
