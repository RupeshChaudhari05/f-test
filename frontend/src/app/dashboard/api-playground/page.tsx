'use client';

/**
 * Interactive API Playground
 * ==========================
 * A Swagger-like page where users can explore and test the Posh Push REST API.
 *
 * Features:
 *  - Browse endpoints grouped by resource
 *  - Fill in parameters via generated form inputs
 *  - Execute the request against the live backend
 *  - View the JSON response with syntax highlighting
 *  - Copy curl / JavaScript / Python code snippets
 */

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronRight, Play, Copy, Check,
  Code, Terminal, BookOpen,
} from 'lucide-react';

// ── Type definitions ────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Param {
  name: string;
  /** 'path' | 'query' | 'body' */
  in: 'path' | 'query' | 'body';
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue?: string;
}

interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;          // may include :siteId / :id
  summary: string;
  description: string;
  params: Param[];
}

interface Group {
  label: string;
  endpoints: Endpoint[];
}

// ── Endpoint catalogue ───────────────────────────────────────────────────────

const GROUPS: Group[] = [
  {
    label: 'Sites',
    endpoints: [
      {
        id: 'list-sites', method: 'GET', path: '/api/v1/sites',
        summary: 'List all sites',
        description: 'Returns all sites belonging to the authenticated user.',
        params: [],
      },
      {
        id: 'create-site', method: 'POST', path: '/api/v1/sites',
        summary: 'Create a site',
        description: 'Creates a new push notification site.',
        params: [
          { name: 'name',   in: 'body', description: 'Display name',  required: true,  type: 'string', defaultValue: 'My Site' },
          { name: 'domain', in: 'body', description: 'Root domain',   required: true,  type: 'string', defaultValue: 'https://example.com' },
        ],
      },
    ],
  },
  {
    label: 'Subscribers',
    endpoints: [
      {
        id: 'list-subs', method: 'GET', path: '/api/v1/sites/:siteId/subscribers',
        summary: 'List subscribers',
        description: 'Returns paginated subscribers for a site.',
        params: [
          { name: 'siteId', in: 'path',  description: 'Site ID',  required: true,  type: 'string' },
          { name: 'page',   in: 'query', description: 'Page',     required: false, type: 'number', defaultValue: '1' },
          { name: 'limit',  in: 'query', description: 'Per page', required: false, type: 'number', defaultValue: '20' },
        ],
      },
    ],
  },
  {
    label: 'Notifications',
    endpoints: [
      {
        id: 'send-notif', method: 'POST', path: '/api/v1/sites/:siteId/notifications/send',
        summary: 'Send a notification',
        description: 'Immediately sends a push notification to all or segmented subscribers.',
        params: [
          { name: 'siteId',      in: 'path', description: 'Site ID',    required: true,  type: 'string' },
          { name: 'title',       in: 'body', description: 'Title',      required: true,  type: 'string', defaultValue: 'Hello!' },
          { name: 'message',     in: 'body', description: 'Body text',  required: true,  type: 'string', defaultValue: 'This is a test notification.' },
          { name: 'clickAction', in: 'body', description: 'Click URL',  required: false, type: 'string', defaultValue: 'https://example.com' },
          { name: 'targetType',  in: 'body', description: 'all | segment | tags', required: false, type: 'string', defaultValue: 'all' },
        ],
      },
      {
        id: 'list-notifs', method: 'GET', path: '/api/v1/sites/:siteId/notifications',
        summary: 'List notifications',
        description: 'Returns sent / scheduled notifications.',
        params: [
          { name: 'siteId', in: 'path',  description: 'Site ID',  required: true,  type: 'string' },
          { name: 'page',   in: 'query', description: 'Page',     required: false, type: 'number', defaultValue: '1' },
          { name: 'limit',  in: 'query', description: 'Per page', required: false, type: 'number', defaultValue: '20' },
        ],
      },
    ],
  },
  {
    label: 'Analytics',
    endpoints: [
      {
        id: 'dashboard', method: 'GET', path: '/api/v1/sites/:siteId/analytics/dashboard',
        summary: 'Dashboard stats',
        description: 'Returns aggregate subscriber, delivery, and click stats.',
        params: [{ name: 'siteId', in: 'path', description: 'Site ID', required: true, type: 'string' }],
      },
      {
        id: 'geo', method: 'GET', path: '/api/v1/sites/:siteId/analytics/geo',
        summary: 'Geographic breakdown',
        description: 'Returns subscriber count grouped by country.',
        params: [
          { name: 'siteId', in: 'path',  description: 'Site ID', required: true,  type: 'string' },
          { name: 'limit',  in: 'query', description: 'Max rows', required: false, type: 'number', defaultValue: '20' },
        ],
      },
      {
        id: 'devices', method: 'GET', path: '/api/v1/sites/:siteId/analytics/devices',
        summary: 'Device breakdown',
        description: 'Returns subscriber count grouped by device type.',
        params: [{ name: 'siteId', in: 'path', description: 'Site ID', required: true, type: 'string' }],
      },
      {
        id: 'growth', method: 'GET', path: '/api/v1/sites/:siteId/analytics/growth',
        summary: 'Subscriber growth',
        description: 'Returns daily new subscriber counts for the past N days.',
        params: [
          { name: 'siteId', in: 'path',  description: 'Site ID',  required: true,  type: 'string' },
          { name: 'days',   in: 'query', description: 'Lookback', required: false, type: 'number', defaultValue: '30' },
        ],
      },
    ],
  },
  {
    label: 'Migration',
    endpoints: [
      {
        id: 'migrate-csv', method: 'POST', path: '/api/v1/sites/:siteId/migration/csv',
        summary: 'Import via CSV',
        description: 'Import subscribers from a CSV string.',
        params: [
          { name: 'siteId',     in: 'path', description: 'Site ID',     required: true,  type: 'string' },
          { name: 'csvContent', in: 'body', description: 'Raw CSV text', required: true,  type: 'string', defaultValue: 'endpoint\nhttps://fcm.googleapis.com/...' },
        ],
      },
    ],
  },
  {
    label: 'Automations',
    endpoints: [
      {
        id: 'list-automations', method: 'GET', path: '/api/v1/sites/:siteId/automations',
        summary: 'List automations',
        description: 'Returns all automations (drip, RSS, social) for a site.',
        params: [{ name: 'siteId', in: 'path', description: 'Site ID', required: true, type: 'string' }],
      },
    ],
  },
];

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PUT:    'bg-yellow-100 text-yellow-700',
  PATCH:  'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

// ── Main page ────────────────────────────────────────────────────────────────

export default function ApiPlaygroundPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Sites']));
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  // Pre-fill siteId when endpoint is selected
  const selectEndpoint = useCallback(
    (endpoint: Endpoint) => {
      setSelected(endpoint);
      setResponse(null);
      setResponseStatus(null);

      // Pre-fill path params with currentSite.id
      const initial: Record<string, string> = {};
      endpoint.params.forEach((p) => {
        if (p.name === 'siteId' && currentSite) {
          initial[p.name] = currentSite.id;
        } else if (p.defaultValue !== undefined) {
          initial[p.name] = p.defaultValue;
        } else {
          initial[p.name] = '';
        }
      });
      setParamValues(initial);
    },
    [currentSite],
  );

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  async function runRequest() {
    if (!selected) return;
    setRunning(true);
    setResponse(null);

    try {
      // Build the resolved URL (replace :param tokens)
      let url = selected.path;
      selected.params
        .filter((p) => p.in === 'path')
        .forEach((p) => {
          url = url.replace(`:${p.name}`, encodeURIComponent(paramValues[p.name] || ''));
        });

      // Build query params
      const query: Record<string, string> = {};
      selected.params
        .filter((p) => p.in === 'query' && paramValues[p.name])
        .forEach((p) => { query[p.name] = paramValues[p.name]; });

      // Build body
      const bodyParams = selected.params.filter((p) => p.in === 'body');
      let body: Record<string, any> | undefined;
      if (bodyParams.length) {
        body = {};
        bodyParams.forEach((p) => {
          const val = paramValues[p.name];
          if (val !== '' && val !== undefined) {
            body![p.name] = p.type === 'number' ? Number(val) : val;
          }
        });
      }

      const res = await api.request({
        method: selected.method,
        url,
        params: query,
        data: body,
      });

      setResponseStatus(res.status);
      setResponse(res.data);
    } catch (err: any) {
      setResponseStatus(err?.response?.status ?? 0);
      setResponse(err?.response?.data ?? { error: err?.message });
    } finally {
      setRunning(false);
    }
  }

  // ── Code snippet generators ─────────────────────────────────────────────

  function buildSnippet(lang: 'curl' | 'js' | 'python'): string {
    if (!selected) return '';

    let url = `http://localhost:3000${selected.path}`;
    selected.params
      .filter((p) => p.in === 'path')
      .forEach((p) => {
        url = url.replace(`:${p.name}`, paramValues[p.name] || `{${p.name}}`);
      });

    const queryStr = selected.params
      .filter((p) => p.in === 'query' && paramValues[p.name])
      .map((p) => `${p.name}=${encodeURIComponent(paramValues[p.name])}`)
      .join('&');
    if (queryStr) url += `?${queryStr}`;

    const bodyParams = selected.params.filter((p) => p.in === 'body');
    const bodyObj: Record<string, any> = {};
    bodyParams.forEach((p) => {
      if (paramValues[p.name]) bodyObj[p.name] = paramValues[p.name];
    });
    const bodyJson = JSON.stringify(bodyObj, null, 2);
    const token = typeof window !== 'undefined' ? localStorage.getItem('posh_token') || 'YOUR_JWT_TOKEN' : 'YOUR_JWT_TOKEN';

    if (lang === 'curl') {
      const lines = [
        `curl -X ${selected.method} '${url}' \\`,
        `  -H 'Authorization: Bearer ${token}' \\`,
        `  -H 'Content-Type: application/json'`,
        ...(bodyParams.length ? [`  -d '${bodyJson}'`] : []),
      ];
      return lines.join(' \\\n');
    }

    if (lang === 'js') {
      return `// JavaScript (fetch)
const response = await fetch('${url}', {
  method: '${selected.method}',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json',
  },${bodyParams.length ? `\n  body: JSON.stringify(${bodyJson}),` : ''}
});
const data = await response.json();
console.log(data);`;
    }

    // python
    return `# Python (requests)
import requests, json

url = '${url}'
headers = {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json',
}${bodyParams.length ? `\nbody = ${bodyJson}\nresponse = requests.${selected.method.toLowerCase()}(url, headers=headers, json=body)` : `\nresponse = requests.${selected.method.toLowerCase()}(url, headers=headers)`}
print(response.json())`;
  }

  function copySnippet() {
    navigator.clipboard.writeText(buildSnippet(snippetLang));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 overflow-hidden">

      {/* Left sidebar – endpoint list */}
      <aside className="w-64 flex-shrink-0 border border-border rounded-lg overflow-y-auto bg-card">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            API Reference
          </h2>
        </div>

        {GROUPS.map((group) => {
          const isOpen = openGroups.has(group.label);
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {group.label}
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {isOpen && group.endpoints.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => selectEndpoint(ep)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-muted/50 transition-colors ${selected?.id === ep.id ? 'bg-muted' : ''}`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${METHOD_COLOR[ep.method]}`}>
                    {ep.method}
                  </span>
                  <span className="text-xs text-foreground leading-tight">{ep.summary}</span>
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      {/* Main panel */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Code className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Select an endpoint from the left to get started.</p>
          </div>
        ) : (
          <>
            {/* Endpoint header */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold px-2 py-1 rounded ${METHOD_COLOR[selected.method]}`}>
                    {selected.method}
                  </span>
                  <code className="text-sm font-mono text-foreground">{selected.path}</code>
                </div>
                <p className="text-sm text-muted-foreground pt-1">{selected.description}</p>
              </CardHeader>
            </Card>

            {/* Parameters */}
            {selected.params.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selected.params.map((param) => (
                    <div key={param.name} className="grid grid-cols-3 gap-3 items-start">
                      <div>
                        <p className="text-xs font-medium">{param.name}{param.required && <span className="text-red-500 ml-0.5">*</span>}</p>
                        <p className="text-[10px] text-muted-foreground">{param.in} · {param.type}</p>
                      </div>
                      <div className="col-span-2">
                        {param.type === 'json' ? (
                          <textarea
                            className="w-full p-2 border border-input rounded text-xs font-mono bg-background h-20 resize-y"
                            value={paramValues[param.name] ?? ''}
                            onChange={(e) => setParamValues((p) => ({ ...p, [param.name]: e.target.value }))}
                            placeholder={param.description}
                          />
                        ) : param.type === 'boolean' ? (
                          <select
                            className="w-full p-2 border border-input rounded text-sm bg-background"
                            value={paramValues[param.name] ?? ''}
                            onChange={(e) => setParamValues((p) => ({ ...p, [param.name]: e.target.value }))}
                          >
                            <option value="">—</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type={param.type === 'number' ? 'number' : 'text'}
                            className="w-full p-2 border border-input rounded text-sm bg-background"
                            value={paramValues[param.name] ?? ''}
                            onChange={(e) => setParamValues((p) => ({ ...p, [param.name]: e.target.value }))}
                            placeholder={param.description}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Code snippets */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4" /> Code Snippet
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {(['curl', 'js', 'python'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSnippetLang(lang)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${snippetLang === lang ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        {lang === 'js' ? 'JavaScript' : lang === 'python' ? 'Python' : 'cURL'}
                      </button>
                    ))}
                    <Button variant="outline" size="sm" onClick={copySnippet}>
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {buildSnippet(snippetLang)}
                </pre>
              </CardContent>
            </Card>

            {/* Execute button */}
            <Button onClick={runRequest} disabled={running} className="w-full">
              {running ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Sending…</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Execute Request</>
              )}
            </Button>

            {/* Response */}
            {response !== null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Response
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${(responseStatus ?? 0) < 300 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {responseStatus}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
