'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getAbTests, createAbTest, startAbTest, getAbTestResults } from '@/lib/api';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FlaskConical, Play, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

interface AbTest {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed';
  variantAId: string;
  variantBId: string;
  splitPercentage: number;
  winnerMetric: string;
  winnerVariant: string | null;
  sampleSize: number | null;
  startedAt: string | null;
  createdAt: string;
}

interface VariantStats {
  sentCount: number;
  clickedCount: number;
}

interface TestResults {
  test: AbTest;
  variantA: VariantStats | null;
  variantB: VariantStats | null;
  winner: 'A' | 'B' | null;
}

const statusVariant: Record<string, 'secondary' | 'warning' | 'success'> = {
  draft: 'secondary',
  running: 'warning',
  completed: 'success',
};

const emptyVariant = { title: '', message: '', iconUrl: '', clickAction: '' };
const emptyForm = {
  name: '',
  splitPercentage: 50,
  winnerMetric: 'ctr',
  variantA: { ...emptyVariant },
  variantB: { ...emptyVariant },
};

export default function AbTestsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Record<string, TestResults | null>>({});
  const [loadingResults, setLoadingResults] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(emptyForm);

  const loadTests = (siteId: string) => {
    setLoading(true);
    getAbTests(siteId)
      .then((res) => setTests(res.data))
      .catch(() => toast.error('Failed to load A/B tests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!currentSite) return;
    loadTests(currentSite.id);
  }, [currentSite]);

  const updateVariant = (v: 'variantA' | 'variantB', key: string, val: string) =>
    setForm((prev) => ({ ...prev, [v]: { ...prev[v], [key]: val } }));

  const handleCreate = async () => {
    if (!currentSite || !form.name || !form.variantA.title || !form.variantB.title) {
      toast.error('Test name and both variant titles are required');
      return;
    }
    setSubmitting(true);
    try {
      await createAbTest(currentSite.id, {
        name: form.name,
        splitPercentage: form.splitPercentage,
        winnerMetric: form.winnerMetric,
        variantA: {
          title: form.variantA.title,
          message: form.variantA.message,
          ...(form.variantA.iconUrl && { iconUrl: form.variantA.iconUrl }),
          ...(form.variantA.clickAction && { clickAction: form.variantA.clickAction }),
        },
        variantB: {
          title: form.variantB.title,
          message: form.variantB.message,
          ...(form.variantB.iconUrl && { iconUrl: form.variantB.iconUrl }),
          ...(form.variantB.clickAction && { clickAction: form.variantB.clickAction }),
        },
      });
      toast.success('A/B test created');
      setShowForm(false);
      setForm(emptyForm);
      loadTests(currentSite.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create A/B test');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (testId: string) => {
    if (!currentSite) return;
    try {
      await startAbTest(currentSite.id, testId);
      toast.success('A/B test started — notifications are sending');
      loadTests(currentSite.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start test');
    }
  };

  const toggleResults = async (testId: string) => {
    if (testId in expandedResults) {
      setExpandedResults((prev) => { const c = { ...prev }; delete c[testId]; return c; });
      return;
    }
    if (!currentSite) return;
    setLoadingResults((prev) => ({ ...prev, [testId]: true }));
    try {
      const res = await getAbTestResults(currentSite.id, testId);
      setExpandedResults((prev) => ({ ...prev, [testId]: res.data }));
    } catch {
      toast.error('Failed to load results');
    } finally {
      setLoadingResults((prev) => ({ ...prev, [testId]: false }));
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">No site selected</p>
        <p className="text-sm text-muted-foreground mt-1">Select or create a site to manage A/B tests</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A/B Tests</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare notification variants to maximize engagement</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? 'Cancel' : '+ New A/B Test'}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">New A/B Test</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label>Test Name *</Label>
                <Input className="mt-1.5" placeholder="e.g. Holiday promo test" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Winner Metric</Label>
                <select value={form.winnerMetric} onChange={(e) => setForm((p) => ({ ...p, winnerMetric: e.target.value }))}
                  className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="ctr">CTR (Click-through Rate)</option>
                  <option value="sentCount">Send Volume</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(['variantA', 'variantB'] as const).map((v, i) => (
                <div key={v} className={`p-4 rounded-lg border-2 ${i === 0 ? 'border-blue-200 bg-blue-50/40' : 'border-purple-200 bg-purple-50/40'}`}>
                  <p className={`text-sm font-semibold mb-3 ${i === 0 ? 'text-blue-700' : 'text-purple-700'}`}>
                    Variant {i === 0 ? 'A' : 'B'}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label>Title *</Label>
                      <Input className="mt-1" placeholder="Notification title" value={form[v].title}
                        onChange={(e) => updateVariant(v, 'title', e.target.value)} />
                    </div>
                    <div>
                      <Label>Message</Label>
                      <Textarea className="mt-1" placeholder="Notification body..." rows={2} value={form[v].message}
                        onChange={(e) => updateVariant(v, 'message', e.target.value)} />
                    </div>
                    <div>
                      <Label>Click URL (optional)</Label>
                      <Input className="mt-1" placeholder="https://..." value={form[v].clickAction}
                        onChange={(e) => updateVariant(v, 'clickAction', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-4">
              <div>
                <Label>Traffic Split (A %)</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input type="number" min={10} max={90} value={form.splitPercentage}
                    onChange={(e) => setForm((p) => ({ ...p, splitPercentage: parseInt(e.target.value) || 50 }))}
                    className="w-20" />
                  <span className="text-sm text-muted-foreground">/ {100 - form.splitPercentage}% B</span>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Test'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tests List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading tests...</div>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FlaskConical className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No A/B tests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first test to compare variants</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const results = expandedResults[test.id];
            const isLoadingRes = loadingResults[test.id];
            const isExpanded = test.id in expandedResults;
            return (
              <Card key={test.id}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-semibold text-foreground">{test.name}</h3>
                        <Badge variant={statusVariant[test.status] ?? 'secondary'}>{test.status}</Badge>
                        {test.winnerVariant && <Badge variant="success">Winner: Variant {test.winnerVariant}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Split {test.splitPercentage}/{100 - test.splitPercentage} · Metric: {test.winnerMetric}
                        {test.sampleSize ? ` · ${test.sampleSize.toLocaleString()} subscribers` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {test.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => handleStart(test.id)}>
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggleResults(test.id)} title="View results">
                        <BarChart2 className="h-3.5 w-3.5 mr-1" />
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      {isLoadingRes ? (
                        <p className="text-sm text-muted-foreground">Loading results...</p>
                      ) : results ? (
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Variant A', data: results.variantA, isWinner: results.winner === 'A', cls: 'text-blue-700' },
                            { label: 'Variant B', data: results.variantB, isWinner: results.winner === 'B', cls: 'text-purple-700' },
                          ].map(({ label, data, isWinner, cls }) => (
                            <div key={label} className={`p-3 rounded-lg border ${isWinner ? 'border-green-300 bg-green-50' : 'bg-muted/30 border-border'}`}>
                              <p className={`text-xs font-semibold mb-2 ${cls}`}>{label} {isWinner ? '🏆' : ''}</p>
                              {data ? (
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-muted-foreground">Sent</span><span className="font-medium">{data.sentCount ?? 0}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Clicked</span><span className="font-medium">{data.clickedCount ?? 0}</span></div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">CTR</span>
                                    <span className="font-medium text-primary">
                                      {data.sentCount ? ((data.clickedCount / data.sentCount) * 100).toFixed(1) : '0.0'}%
                                    </span>
                                  </div>
                                </div>
                              ) : <p className="text-xs text-muted-foreground">No data yet</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No results available yet</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
