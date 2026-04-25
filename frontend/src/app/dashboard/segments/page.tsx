'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getSegments, createSegment, deleteSegment } from '@/lib/api';
import { Layers, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Segment {
  id: string;
  name: string;
  rules: any;
  isAuto: boolean;
  subscriberCount: number;
  createdAt: string;
}

export default function SegmentsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [rules, setRules] = useState<{ field: string; operator: string; value: string }[]>([
    { field: 'country', operator: 'eq', value: '' },
  ]);

  useEffect(() => {
    if (!currentSite) return;
    setLoading(true);
    getSegments(currentSite.id)
      .then((res) => setSegments(res.data))
      .catch(() => toast.error('Failed to load segments'))
      .finally(() => setLoading(false));
  }, [currentSite]);

  const handleDelete = async (id: string) => {
    if (!currentSite) return;
    try {
      await deleteSegment(currentSite.id, id);
      toast.success('Segment deleted');
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error('Failed to delete segment');
    }
  };

  const addRule = () => setRules([...rules, { field: 'country', operator: 'eq', value: '' }]);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, key: string, val: string) => {
    const updated = [...rules];
    (updated[i] as any)[key] = val;
    setRules(updated);
  };

  const handleCreate = async () => {
    if (!currentSite || !name) return;
    try {
      await createSegment(currentSite.id, { name, rules });
      toast.success('Segment created');
      setShowForm(false);
      setName('');
      setRules([{ field: 'country', operator: 'eq', value: '' }]);
      // Reload
      getSegments(currentSite.id).then((res) => setSegments(res.data));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const fieldOptions = ['country', 'city', 'browser', 'os', 'device', 'tag', 'language'];
  const operatorOptions = ['eq', 'neq', 'contains', 'in'];

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">No site selected</p>
        <p className="text-sm text-muted-foreground mt-1">Select or create a site to manage segments</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">Group subscribers by behaviour, location, and more</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          {showForm ? 'Cancel' : '+ New Segment'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Segment Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm max-w-md focus:ring-2 focus:ring-ring outline-none bg-background"
              placeholder="e.g. US Chrome Users"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Rules</label>
            {rules.map((rule, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(i, 'field', e.target.value)}
                  className="px-3 py-2 border border-input rounded-lg text-sm bg-background"
                >
                  {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(i, 'operator', e.target.value)}
                  className="px-3 py-2 border border-input rounded-lg text-sm bg-background"
                >
                  {operatorOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => updateRule(i, 'value', e.target.value)}
                  className="px-3 py-2 border border-input rounded-lg text-sm flex-1 max-w-xs bg-background"
                  placeholder="Value"
                />
                {rules.length > 1 && (
                  <button onClick={() => removeRule(i)} className="text-red-500 text-sm">Remove</button>
                )}
              </div>
            ))}
            <button onClick={addRule} className="text-sm text-primary hover:underline">+ Add Rule</button>
          </div>

          <button
            onClick={handleCreate}
            disabled={!name}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Create Segment
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Loading...</p>
        ) : segments.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">No segments created yet</p>
        ) : (
          segments.map((seg) => (
              <div key={seg.id} className="bg-card rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{seg.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{seg.subscriberCount} subscribers</p>
                </div>
                <div className="flex items-center gap-1.5">
                {seg.isAuto && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">Auto</span>
                )}
                <button onClick={() => handleDelete(seg.id)} title="Delete segment"
                  className="p-1 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(seg.rules as any[])?.map((r: any, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                    {r.field} {r.operator} {r.value}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
