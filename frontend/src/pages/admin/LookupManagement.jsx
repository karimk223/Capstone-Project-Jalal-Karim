/**
 * src/pages/admin/LookupManagement.jsx
 * Implements FR-21 (Admin can deprecate lookup entries).
 * Implements FR-22 (Referral destinations grouped by category).
 * Addresses Gap 9 (flat, unmaintainable lookup list in legacy system).
 */

import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

const DESTINATION_CATEGORIES = [
  'MUNICIPALITY','UNION','COMMITTEE','NGO',
  'INTERNATIONAL_ORG','PRIVATE_COMPANY','GOVERNMENT_DIRECTORATE','ACTION',
];

function StatusPill({ active }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'Active' : 'Deprecated'}
    </span>
  );
}

function ToggleBtn({ isDeprecated, onToggle, loading }) {
  return (
    <button onClick={onToggle} disabled={loading}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isDeprecated
          ? 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
          : 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'
      }`}>
      {isDeprecated ? 'Restore' : 'Deprecate'}
    </button>
  );
}

// ── Complaint Types tab ────────────────────────────────────────────────────
function ComplaintTypesTab() {
  const [types, setTypes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState(null);
  const [newName, setNewName]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [showDeprecated, setShowDeprecated] = useState(false);

  async function fetchTypes() {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/lookups/complaint-types?include_deprecated=true');
      setTypes(res.data);
    } catch { /* swallow */ } finally { setLoading(false); }
  }

  useEffect(() => { fetchTypes(); }, []);

  async function handleToggle(type) {
    setToggling(type.type_id);
    try {
      await apiClient.patch(`/api/v1/admin/complaint-types/${type.type_id}`, {
        is_deprecated: type.is_deprecated ? 0 : 1,
      });
      await fetchTypes();
    } catch { /* silent */ } finally { setToggling(null); }
  }

  async function handleCreate() {
    setSaveError('');
    if (!newName.trim()) { setSaveError('Name is required.'); return; }
    setSaving(true);
    try {
      await apiClient.post('/api/v1/admin/complaint-types', { type_name: newName.trim() });
      setNewName('');
      await fetchTypes();
    } catch (err) {
      setSaveError(err.message || 'Failed to create type.');
    } finally { setSaving(false); }
  }

  const visible = types.filter(t => showDeprecated || !t.is_deprecated);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">New complaint type name</label>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Environmental Issue"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <button onClick={handleCreate} disabled={saving}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Type'}
        </button>
      </div>
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showDeprecated} onChange={e => setShowDeprecated(e.target.checked)} className="rounded" />
        Show deprecated entries
      </label>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No entries found.</td></tr>
              )}
              {visible.map(type => (
                <tr key={type.type_id} className={type.is_deprecated ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-gray-400">{type.type_id}</td>
                  <td className="px-4 py-3 text-gray-800">{type.type_name}</td>
                  <td className="px-4 py-3"><StatusPill active={!type.is_deprecated} /></td>
                  <td className="px-4 py-3">
                    <ToggleBtn isDeprecated={!!type.is_deprecated}
                      onToggle={() => handleToggle(type)} loading={toggling === type.type_id} />
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

// ── Referral Destinations tab ──────────────────────────────────────────────
function ReferralDestinationsTab() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [toggling, setToggling]         = useState(null);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [newForm, setNewForm]           = useState({ destination_name: '', category: '', personal_contact: '' });
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');

  async function fetchDestinations() {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/lookups/referral-destinations?include_deprecated=true');
      setDestinations(res.data);
    } catch { /* swallow */ } finally { setLoading(false); }
  }

  useEffect(() => { fetchDestinations(); }, []);

  async function handleToggle(dest) {
    setToggling(dest.destination_id);
    try {
      await apiClient.patch(`/api/v1/admin/referral-destinations/${dest.destination_id}`, {
        is_deprecated: dest.is_deprecated ? 0 : 1,
      });
      await fetchDestinations();
    } catch { /* silent */ } finally { setToggling(null); }
  }

  async function handleCreate() {
    setSaveError('');
    if (!newForm.destination_name.trim() || !newForm.category) {
      setSaveError('Name and Category are required.'); return;
    }
    setSaving(true);
    try {
      await apiClient.post('/api/v1/admin/referral-destinations', newForm);
      setNewForm({ destination_name: '', category: '', personal_contact: '' });
      await fetchDestinations();
    } catch (err) {
      setSaveError(err.message || 'Failed to create destination.');
    } finally { setSaving(false); }
  }

  const visible = destinations.filter(d => showDeprecated || !d.is_deprecated);
  const grouped = DESTINATION_CATEGORIES.reduce((acc, cat) => {
    const items = visible.filter(d => d.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Destination Name *</label>
          <input type="text" value={newForm.destination_name}
            onChange={e => setNewForm(f => ({ ...f, destination_name: e.target.value }))}
            placeholder="e.g. Municipality of Tripoli"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Category *</label>
          <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Select category…</option>
            {DESTINATION_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <button onClick={handleCreate} disabled={saving}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Destination'}
        </button>
      </div>
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showDeprecated} onChange={e => setShowDeprecated(e.target.checked)} className="rounded" />
        Show deprecated entries
      </label>

      {loading ? <p className="text-sm text-gray-400">Loading…</p>
        : Object.keys(grouped).length === 0
          ? <p className="py-6 text-center text-sm text-gray-400">No destinations found.</p>
          : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {cat.replace(/_/g, ' ')}
                  </p>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <tbody className="divide-y divide-gray-100">
                        {items.map(dest => (
                          <tr key={dest.destination_id} className={dest.is_deprecated ? 'opacity-50' : ''}>
                            <td className="px-4 py-2 text-gray-800">{dest.destination_name}</td>
                            <td className="px-4 py-2"><StatusPill active={!dest.is_deprecated} /></td>
                            <td className="px-4 py-2">
                              <ToggleBtn isDeprecated={!!dest.is_deprecated}
                                onToggle={() => handleToggle(dest)} loading={toggling === dest.destination_id} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LookupManagement() {
  const [activeTab, setActiveTab] = useState('types');
  const tabs = [
    { id: 'types',        label: 'Complaint Types' },
    { id: 'destinations', label: 'Referral Destinations' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Lookup Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add or deprecate complaint types and referral destinations.
          Deprecated entries are hidden from new complaint forms but kept for historical records.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'types'        && <ComplaintTypesTab />}
      {activeTab === 'destinations' && <ReferralDestinationsTab />}
    </div>
  );
}
