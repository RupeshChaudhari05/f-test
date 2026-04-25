'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getAutomations, createAutomation } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Automation {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
}

export default function AutomationsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('welcome');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(0);

  useEffect(() => {
    if (!currentSite) return;
    setLoading(true);
    getAutomations(currentSite.id)
      .then((res) => setAutomations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentSite]);

  const handleCreate = async () => {
    if (!currentSite || !name || !title) return;
    try {
      await createAutomation(currentSite.id, {
        name,
        type,
        notificationTemplate: { title, body: message },
        delaySeconds: delayMinutes * 60,
      });
      toast.success('Automation created');
      setShowForm(false);
      getAutomations(currentSite.id).then((res) => setAutomations(res.data));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          {showForm ? 'Cancel' : '+ New Automation'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Welcome Series" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="welcome">Welcome</option>
                <option value="new_post">New Post</option>
                <option value="scheduled">Scheduled</option>
                <option value="drip">Drip Campaign</option>
                <option value="event_triggered">Event Triggered</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Welcome!" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
              <input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm" min={0} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Thanks for subscribing!" />
          </div>
          <button onClick={handleCreate} disabled={!name || !title}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            Create Automation
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : automations.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No automations yet</td></tr>
            ) : (
              automations.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{a.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(a.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
