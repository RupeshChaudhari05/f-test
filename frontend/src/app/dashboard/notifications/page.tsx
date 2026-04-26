'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getNotifications, createNotification, sendNotification } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Send, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  status: string;
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  totalFailed: number;
  createdAt: string;
  sentAt: string | null;
  scheduledAt: string | null;
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'secondary' | 'destructive'> = {
  sent: 'success',
  sending: 'warning',
  scheduled: 'default',
  draft: 'secondary',
  failed: 'destructive',
  cancelled: 'secondary',
};

export default function NotificationsPage() {
  const currentSite = useStore((s) => s.currentSite);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { loadNotifications(); }, [currentSite]);

  // Auto-refresh every 3s while any notification is in "sending" state
  useEffect(() => {
    const hasSending = notifications.some((n) => n.status === 'sending');
    if (!hasSending) return;
    const timer = setInterval(() => loadNotifications(), 3000);
    return () => clearInterval(timer);
  }, [notifications]);

  const loadNotifications = () => {
    if (!currentSite) return;
    setLoading(true);
    getNotifications(currentSite.id)
      .then((res) => {
        const data = res.data;
        setNotifications(data.notifications || data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleSend = async () => {
    if (!currentSite || !title) return;
    setSending(true);
    try {
      await sendNotification(currentSite.id, {
        title,
        message,
        clickAction: clickUrl || undefined,
        iconUrl: iconUrl || undefined,
        imageUrl: imageUrl || undefined,
        targetType: 'all',
      });
      toast.success('Notification sent!');
      setShowComposer(false);
      setTitle(''); setMessage(''); setClickUrl(''); setIconUrl(''); setImageUrl('');
      loadNotifications();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>No Site Selected</CardTitle>
            <CardDescription>Select or create a site to manage notifications.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">Create and send push notifications to your subscribers</p>
        </div>
        <Button onClick={() => setShowComposer(!showComposer)}>
          {showComposer ? <><X className="h-4 w-4 mr-2" /> Cancel</> : <><Plus className="h-4 w-4 mr-2" /> New Notification</>}
        </Button>
      </div>

      {/* Composer */}
      {showComposer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Compose Notification
            </CardTitle>
            <CardDescription>Create and send a push notification to all subscribers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notifTitle">Title *</Label>
                  <Input id="notifTitle" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Breaking: New Feature Released!" maxLength={100} className="mt-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
                </div>
                <div>
                  <Label htmlFor="notifMessage">Message</Label>
                  <Textarea id="notifMessage" value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Click to learn more about our latest update..." rows={3} maxLength={250} className="mt-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{message.length}/250</p>
                </div>
                <div>
                  <Label htmlFor="clickUrl">Click URL</Label>
                  <Input id="clickUrl" type="url" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)}
                    placeholder="https://example.com/page" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="iconUrl">Icon URL</Label>
                    <Input id="iconUrl" type="url" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)}
                      placeholder="https://..." className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input id="imageUrl" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..." className="mt-1.5" />
                  </div>
                </div>
                <Button onClick={handleSend} disabled={!title || sending} className="w-full sm:w-auto">
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? 'Sending...' : 'Send to All Subscribers'}
                </Button>
              </div>

              {/* Preview */}
              <div>
                <Label className="mb-2 block">Preview</Label>
                <div className="bg-muted rounded-lg p-4">
                  <div className="bg-background rounded-lg shadow-md p-4 flex gap-3 max-w-sm">
                    {iconUrl ? <img src={iconUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" /> :
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Send className="h-6 w-6 text-primary" />
                      </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{title || 'Notification Title'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{message || 'Notification message body...'}</p>
                      {clickUrl && <p className="text-xs text-primary truncate mt-1">{clickUrl}</p>}
                    </div>
                  </div>
                  {imageUrl && <img src={imageUrl} alt="" className="mt-3 rounded-lg w-full max-w-sm object-cover" />}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Campaigns</CardTitle>
          <CardDescription>Click any column to sort. Search by title or status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'title', header: 'Notification',
                  render: (n: NotificationItem) => (
                    <div>
                      <div className="font-medium">{n.title}</div>
                      {n.message && <div className="text-xs text-muted-foreground truncate max-w-xs">{n.message}</div>}
                    </div>
                  ),
                  accessorFn: (n: NotificationItem) => n.title,
                },
                {
                  key: 'status', header: 'Status',
                  render: (n: NotificationItem) => <Badge variant={statusVariant[n.status] || 'secondary'}>{n.status}</Badge>,
                  accessorFn: (n: NotificationItem) => n.status,
                },
                { key: 'totalSent', header: 'Sent', render: (n: NotificationItem) => (n.totalSent || 0).toLocaleString(), accessorFn: (n: NotificationItem) => n.totalSent },
                { key: 'totalDelivered', header: 'Delivered', render: (n: NotificationItem) => (n.totalDelivered || 0).toLocaleString(), accessorFn: (n: NotificationItem) => n.totalDelivered },
                { key: 'totalClicked', header: 'Clicked', render: (n: NotificationItem) => (n.totalClicked || 0).toLocaleString(), accessorFn: (n: NotificationItem) => n.totalClicked },
                {
                  key: 'ctr', header: 'CTR',
                  render: (n: NotificationItem) => {
                    const ctr = n.totalDelivered > 0 ? ((n.totalClicked / n.totalDelivered) * 100) : 0;
                    return <span className={`font-medium ${ctr > 5 ? 'text-green-600' : ctr > 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>{ctr.toFixed(1)}%</span>;
                  },
                  accessorFn: (n: NotificationItem) => n.totalDelivered > 0 ? (n.totalClicked / n.totalDelivered) * 100 : 0,
                },
                {
                  key: 'totalFailed', header: 'Failed',
                  render: (n: NotificationItem) => <span className={n.totalFailed > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>{n.totalFailed || 0}</span>,
                  accessorFn: (n: NotificationItem) => n.totalFailed,
                },
                {
                  key: 'sentAt', header: 'Date',
                  render: (n: NotificationItem) => <span className="text-xs text-muted-foreground">{formatDateTime(n.sentAt || n.createdAt)}</span>,
                  accessorFn: (n: NotificationItem) => n.sentAt || n.createdAt,
                },
              ] as any}
              data={notifications}
              rowKey={(n: any) => n.id}
              searchable
              searchPlaceholder="Search notifications..."
              emptyMessage="No notifications yet. Create your first campaign!"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
