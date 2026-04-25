'use client';

/**
 * Migration / Import Page
 * =======================
 * Lets users import existing push subscribers from:
 *  - OneSignal (paste JSON array)
 *  - Firebase (paste FCM token list)
 *  - Generic CSV upload
 *
 * Each tab shows a form, sends the data to the backend migration endpoints,
 * and displays a detailed import report.
 */

import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { importFromOneSignal, importFromFirebase, importFromCsv } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, XCircle, AlertCircle, ArrowRightLeft } from 'lucide-react';

type TabId = 'onesignal' | 'firebase' | 'csv';

interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const TABS: { id: TabId; label: string; description: string }[] = [
  {
    id: 'onesignal',
    label: 'OneSignal',
    description: 'Import subscribers from a OneSignal device export (JSON array).',
  },
  {
    id: 'firebase',
    label: 'Firebase',
    description: 'Import FCM registration tokens exported from Firebase.',
  },
  {
    id: 'csv',
    label: 'Generic CSV',
    description: 'Import from any platform using a CSV file with a header row.',
  },
];

export default function MigrationPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [activeTab, setActiveTab] = useState<TabId>('onesignal');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [osJson, setOsJson] = useState('');
  const [fbJson, setFbJson] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvEndpointCol, setCsvEndpointCol] = useState('endpoint');
  const [csvFcmCol, setCsvFcmCol] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentSite) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        Select a site to import subscribers.
      </div>
    );
  }

  async function handleImport() {
    setLoading(true);
    setReport(null);
    setError(null);

    try {
      let res: any;

      if (activeTab === 'onesignal') {
        let subscribers: any[];
        try {
          subscribers = JSON.parse(osJson);
          if (!Array.isArray(subscribers)) throw new Error('Must be a JSON array.');
        } catch {
          setError('Invalid JSON – must be an array of subscriber objects.');
          return;
        }
        res = await importFromOneSignal(currentSite.id, { subscribers });
      } else if (activeTab === 'firebase') {
        let tokens: any[];
        try {
          tokens = JSON.parse(fbJson);
          if (!Array.isArray(tokens)) throw new Error('Must be a JSON array.');
        } catch {
          setError('Invalid JSON – must be an array of token objects.');
          return;
        }
        res = await importFromFirebase(currentSite.id, { tokens });
      } else {
        // CSV
        if (!csvContent.trim()) {
          setError('Please paste or upload a CSV file.');
          return;
        }
        const columnMap: Record<string, string> = {};
        if (csvEndpointCol) columnMap.endpoint = csvEndpointCol;
        if (csvFcmCol) columnMap.fcmToken = csvFcmCol;

        res = await importFromCsv(currentSite.id, {
          csvContent,
          columnMap: Object.keys(columnMap).length ? columnMap : undefined,
        });
      }

      setReport(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvContent(ev.target?.result as string || '');
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          Subscriber Migration
        </h1>
        <p className="text-muted-foreground mt-1">
          Import existing subscribers from other push notification platforms into{' '}
          <strong>{currentSite.name}</strong>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setReport(null); setError(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card>
        <CardHeader>
          <CardTitle>{TABS.find((t) => t.id === activeTab)?.label} Import</CardTitle>
          <CardDescription>{TABS.find((t) => t.id === activeTab)?.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OneSignal */}
          {activeTab === 'onesignal' && (
            <>
              <p className="text-sm text-muted-foreground">
                Paste the JSON array from OneSignal's{' '}
                <strong>Audience → All Users → Export CSV/JSON</strong> tool.
                Each object must have an <code className="bg-muted px-1 rounded">endpoint</code> field.
              </p>
              <ExampleBadge code={`[{"endpoint":"https://fcm...","p256dh":"BN...","auth":"abc"}]`} />
              <textarea
                className="w-full h-40 p-3 border border-input rounded-md font-mono text-xs resize-y bg-background"
                placeholder='[{"endpoint": "https://fcm.googleapis.com/...", "p256dh": "...", "auth": "..."}]'
                value={osJson}
                onChange={(e) => setOsJson(e.target.value)}
              />
            </>
          )}

          {/* Firebase */}
          {activeTab === 'firebase' && (
            <>
              <p className="text-sm text-muted-foreground">
                Paste a JSON array of FCM token objects. Each object must have a{' '}
                <code className="bg-muted px-1 rounded">fcmToken</code> field.
              </p>
              <ExampleBadge code={`[{"fcmToken":"eX...abc","country":"US","os":"Android"}]`} />
              <textarea
                className="w-full h-40 p-3 border border-input rounded-md font-mono text-xs resize-y bg-background"
                placeholder='[{"fcmToken": "eX...abc", "country": "US", "deviceType": "mobile"}]'
                value={fbJson}
                onChange={(e) => setFbJson(e.target.value)}
              />
            </>
          )}

          {/* CSV */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload or paste a CSV file. The first row must be a header row.
                Tell us which column headers map to the subscriber fields below.
              </p>

              {/* Column map */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Endpoint column header
                  </label>
                  <input
                    className="w-full p-2 border border-input rounded-md text-sm bg-background"
                    placeholder="e.g. endpoint"
                    value={csvEndpointCol}
                    onChange={(e) => setCsvEndpointCol(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    FCM Token column header (if any)
                  </label>
                  <input
                    className="w-full p-2 border border-input rounded-md text-sm bg-background"
                    placeholder="e.g. fcm_token"
                    value={csvFcmCol}
                    onChange={(e) => setCsvFcmCol(e.target.value)}
                  />
                </div>
              </div>

              {/* File picker */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload a CSV file (max 5 MB)
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Paste fallback */}
              <p className="text-xs text-muted-foreground text-center">— or paste CSV content —</p>
              <textarea
                className="w-full h-32 p-3 border border-input rounded-md font-mono text-xs resize-y bg-background"
                placeholder="endpoint,country,browser&#10;https://fcm...,US,Chrome"
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Report */}
          {report && <ImportReportCard report={report} />}

          <Button onClick={handleImport} disabled={loading} className="w-full">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Start Import
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────────────

function ExampleBadge({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-muted rounded text-xs">
      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <span className="font-mono break-all">{code}</span>
    </div>
  );
}

function ImportReportCard({ report }: { report: ImportReport }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 font-medium text-sm flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        Import Complete
      </div>
      <div className="grid grid-cols-4 divide-x divide-border text-center">
        {[
          { label: 'Total',    value: report.total,    color: 'text-foreground' },
          { label: 'Imported', value: report.imported, color: 'text-green-600' },
          { label: 'Skipped',  value: report.skipped,  color: 'text-yellow-600' },
          { label: 'Failed',   value: report.failed,   color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {report.errors.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-medium text-red-600 mb-1">Errors:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {report.errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
