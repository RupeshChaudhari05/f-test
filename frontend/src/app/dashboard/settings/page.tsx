'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getSite, updateSite, getLicenseLimits } from '@/lib/api';
import toast from 'react-hot-toast';
import { Copy, Settings, Globe, Crown, AlertTriangle, Code, Plug, FileCode, Palette, Lock, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function SiteSettingsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const user = useStore((s) => s.user);
  const setCurrentSite = useStore((s) => s.setCurrentSite);
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [license, setLicense] = useState<any>(null);
  const [integrationTab, setIntegrationTab] = useState<'script' | 'wordpress'>('script');

  // White-label / branding state
  const [branding, setBranding] = useState({
    logoUrl: '',
    primaryColor: '#4F46E5',
    promptTitle: 'Stay in the loop!',
    promptBody: 'Subscribe to receive the latest updates directly in your browser.',
    poweredByHidden: false,
  });
  const [brandingSaving, setBrandingSaving] = useState(false);

  useEffect(() => {
    if (!currentSite) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getSite(currentSite.id),
      getLicenseLimits()
    ]).then(([siteRes, licenseRes]) => {
      setSite(siteRes.data);
      setName(siteRes.data.name);
      setDomain(siteRes.data.domain);
      setWebhookUrl(siteRes.data.webhookUrl || '');
      setLicense(licenseRes.data);
      // Load stored branding values
      if (siteRes.data.branding) {
        setBranding((prev) => ({ ...prev, ...siteRes.data.branding }));
      }
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [currentSite]);

  const handleSave = async () => {
    if (!currentSite) return;
    setSaving(true);
    try {
      await updateSite(currentSite.id, { name, domain, webhookUrl: webhookUrl || null });
      setCurrentSite({ ...currentSite, name, domain });
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const getScriptSnippet = () => `<!-- Posh Push Notification SDK -->
<script src="${serverUrl}/sdk/posh-push.js"></script>
<script>
  PoshPush.init({
    apiKey: '${site?.apiKey || 'YOUR_API_KEY'}',
    serverUrl: '${serverUrl}'
  });
</script>`;

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-2 p-3 bg-muted rounded-full w-fit">
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>No Site Selected</CardTitle>
            <CardDescription>Create a site first to configure settings and generate integration code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/sites/new">
              <Button className="w-full">
                <Globe className="h-4 w-4 mr-2" />
                Create Your First Site
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your site configuration and get integration code</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            API Credentials
          </CardTitle>
          <CardDescription>Use these keys to integrate Posh Push with your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API Key</Label>
            <div className="flex gap-2 mt-1.5">
              <code className="flex-1 px-3 py-2 bg-muted border rounded-md text-sm font-mono truncate block leading-6">
                {site?.apiKey}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(site?.apiKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {site?.vapidPublicKey && (
            <div>
              <Label>VAPID Public Key</Label>
              <div className="flex gap-2 mt-1.5">
                <code className="flex-1 px-3 py-2 bg-muted border rounded-md text-sm font-mono truncate block leading-6">
                  {site.vapidPublicKey}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(site.vapidPublicKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Code Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integration Setup
          </CardTitle>
          <CardDescription>Choose your platform and follow the integration steps</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs>
            <TabsList className="mb-4">
              <TabsTrigger active={integrationTab === 'script'} onClick={() => setIntegrationTab('script')}>
                <FileCode className="h-4 w-4 mr-2" />
                JavaScript / Static Site
              </TabsTrigger>
              <TabsTrigger active={integrationTab === 'wordpress'} onClick={() => setIntegrationTab('wordpress')}>
                <Globe className="h-4 w-4 mr-2" />
                WordPress
              </TabsTrigger>
            </TabsList>

            <TabsContent hidden={integrationTab !== 'script'}>
              <div className="space-y-4">
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Step 1: Add the SDK script</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Paste this code before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:
                  </p>
                  <div className="relative">
                    <pre className="bg-gray-950 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{getScriptSnippet()}
                    </pre>
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(getScriptSnippet())}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Step 2: Service Worker</h4>
                  <p className="text-sm text-muted-foreground">
                    Download <code className="bg-muted px-1 rounded">{serverUrl}/sdk/posh-push-sw.js</code> and place it at the root of your site.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-1">How it works</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• The SDK shows a subscription prompt to visitors</li>
                    <li>• Visitors who accept receive push notifications</li>
                    <li>• All subscribers appear in your dashboard</li>
                    <li>• Send notifications from the Notifications page</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent hidden={integrationTab !== 'wordpress'}>
              <div className="space-y-4">
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h4 className="font-medium mb-2">WordPress Plugin Setup</h4>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex gap-2"><span className="bg-primary text-primary-foreground text-xs h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0">1</span> Download the Posh Push WordPress plugin from the <code className="bg-muted px-1 rounded">wordpress-plugin/</code> folder</li>
                    <li className="flex gap-2"><span className="bg-primary text-primary-foreground text-xs h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0">2</span> Upload to WordPress → Plugins → Add New → Upload Plugin</li>
                    <li className="flex gap-2"><span className="bg-primary text-primary-foreground text-xs h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0">3</span> Activate &quot;Posh Push Notifications&quot;</li>
                    <li className="flex gap-2"><span className="bg-primary text-primary-foreground text-xs h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0">4</span> Go to Settings → Posh Push and enter credentials below</li>
                  </ol>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>API Key</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input readOnly value={site?.apiKey || ''} className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(site?.apiKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Server URL</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input readOnly value={serverUrl} className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(serverUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-1">Auto-Notify on Publish</h4>
                  <p className="text-sm text-green-700">
                    Enable in WordPress settings to auto-send push notifications when new posts are published.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Update your site name, domain, and webhook URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div>
            <Label htmlFor="siteName">Site Name</Label>
            <Input id="siteName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="webhook">Webhook URL (optional)</Label>
            <Input id="webhook" type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://yoursite.com/webhook" className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1">Receive callbacks for delivery and click events</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Plan & Limits */}
      {license && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Plan & Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-primary capitalize">{license.plan}</div>
                <div className="text-sm text-muted-foreground">Plan</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{license.usage?.sites || 0}</div>
                <div className="text-sm text-muted-foreground">Sites</div>
                <div className="text-xs text-muted-foreground">
                  {license.remaining?.sites === -1 ? 'Unlimited' : `${license.remaining?.sites} left`}
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{license.usage?.subscribers || 0}</div>
                <div className="text-sm text-muted-foreground">Subscribers</div>
                <div className="text-xs text-muted-foreground">
                  {license.remaining?.subscribers === -1 ? 'Unlimited' : `${license.remaining?.subscribers} left`}
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-purple-600">{license.usage?.notifications || 0}</div>
                <div className="text-sm text-muted-foreground">Notifications</div>
                <div className="text-xs text-muted-foreground">
                  {license.remaining?.notifications === -1 ? 'Unlimited' : `${license.remaining?.notifications} left`}
                </div>
              </div>
            </div>
            {license.remaining?.sites === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Site Limit Reached</h3>
                  <p className="text-sm text-yellow-700 mt-1">Upgrade your plan to create more sites.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* ── White-label & Branding ─────────────────────────── */}
      {(() => {
        const canWhiteLabel = ['business', 'enterprise'].includes(license?.plan || '');
        const handleSaveBranding = async () => {
          if (!currentSite) return;
          setBrandingSaving(true);
          try {
            await updateSite(currentSite.id, { branding });
            toast.success('Branding saved');
          } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to save branding');
          } finally {
            setBrandingSaving(false);
          }
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                White-label &amp; Branding
              </CardTitle>
              <CardDescription>
                Customise the opt-in prompt appearance shown to your visitors.{' '}
                {!canWhiteLabel && (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <Lock className="h-3 w-3" /> Business plan required.{' '}
                    <Link href="/dashboard/pricing" className="underline">Upgrade →</Link>
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Logo URL */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Logo URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://cdn.example.com/logo.png"
                    value={branding.logoUrl}
                    onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
                    disabled={!canWhiteLabel}
                  />
                  {branding.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoUrl}
                      alt="Logo"
                      className="h-9 w-auto object-contain border rounded p-1"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>

              {/* Primary colour */}
              <div>
                <Label className="mb-1.5 block">Brand Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                    disabled={!canWhiteLabel}
                    className="h-9 w-12 border border-input rounded cursor-pointer disabled:opacity-50"
                  />
                  <Input
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                    disabled={!canWhiteLabel}
                    className="w-32 font-mono text-sm"
                  />
                  <div
                    className="h-8 w-16 rounded border"
                    style={{ background: branding.primaryColor }}
                  />
                </div>
              </div>

              {/* Prompt text */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="promptTitle" className="mb-1.5 block">Prompt Title</Label>
                  <Input
                    id="promptTitle"
                    value={branding.promptTitle}
                    onChange={(e) => setBranding((b) => ({ ...b, promptTitle: e.target.value }))}
                    disabled={!canWhiteLabel}
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="promptBody" className="mb-1.5 block">Prompt Body</Label>
                  <Input
                    id="promptBody"
                    value={branding.promptBody}
                    onChange={(e) => setBranding((b) => ({ ...b, promptBody: e.target.value }))}
                    disabled={!canWhiteLabel}
                    maxLength={200}
                  />
                </div>
              </div>

              {/* Hide powered-by */}
              <label className={`flex items-center gap-2 cursor-pointer ${!canWhiteLabel ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={branding.poweredByHidden}
                  onChange={(e) => setBranding((b) => ({ ...b, poweredByHidden: e.target.checked }))}
                  disabled={!canWhiteLabel}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-sm">Remove "Powered by Posh Push" attribution</span>
              </label>

              <Button onClick={handleSaveBranding} disabled={brandingSaving || !canWhiteLabel}>
                {brandingSaving ? 'Saving…' : 'Save Branding'}
              </Button>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
