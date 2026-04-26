'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getAutomations, createAutomation } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
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
  const [triggerEvent, setTriggerEvent] = useState('cart_abandoned');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [clickAction, setClickAction] = useState('');
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
        ...(type === 'event_triggered' && { triggerConfig: { event: triggerEvent } }),
        notificationTemplate: { title, body: message, iconUrl: iconUrl || undefined, clickAction: clickAction || undefined },
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
            {type === 'event_triggered' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
                <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="cart_abandoned">Cart Abandoned</option>
                  <option value="purchase_completed">Purchase Completed</option>
                  <option value="form_submitted">Form Submitted</option>
                  <option value="page_visited">Page Visited</option>
                </select>
                {triggerEvent === 'cart_abandoned' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Fires when a subscriber adds to cart but doesn't purchase within the delay window.
                    Use <code className="bg-gray-100 px-1 rounded">{'{{product_name}}'}</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{cart_total}}'}</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{cart_url}}'}</code> in your message.
                  </p>
                )}
              </div>
            )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="url" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://your-site.com/icon.png" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Click URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="url" value={clickAction} onChange={(e) => setClickAction(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="{{cart_url}} or https://your-site.com" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={!name || !title}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            Create Automation
          </button>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (a: any) => <span className="font-medium">{a.name}</span>, accessorFn: (a: any) => a.name },
          { key: 'type', header: 'Type', render: (a: any) => <Badge variant="secondary" className="text-xs capitalize">{a.type.replace('_', ' ')}</Badge>, accessorFn: (a: any) => a.type },
          {
            key: 'isActive', header: 'Status',
            render: (a: any) => <Badge variant={a.isActive ? 'success' : 'secondary'} className="text-xs">{a.isActive ? 'Active' : 'Paused'}</Badge>,
            accessorFn: (a: any) => a.isActive ? 'active' : 'paused',
          },
          { key: 'createdAt', header: 'Created', render: (a: any) => <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>, accessorFn: (a: any) => a.createdAt },
        ] as any}
        data={loading ? [] : automations}
        rowKey={(a: any) => a.id}
        searchable
        searchPlaceholder="Search automations..."
        emptyMessage={loading ? 'Loading...' : 'No automations yet'}
      />
    </div>
  );
}
