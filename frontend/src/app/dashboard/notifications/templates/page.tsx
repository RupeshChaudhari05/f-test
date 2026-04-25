'use client';

/**
 * Advanced Notification Templates
 * ================================
 * A drag-and-drop visual builder for reusable push notification templates.
 *
 * Templates are composed of modular blocks:
 *   • Title block   – headline text
 *   • Body block    – supporting message text
 *   • Icon block    – icon URL input
 *   • Image block   – hero image URL
 *   • Action block  – click-through URL and optional button label
 *
 * Completed templates are saved as automations with type TEMPLATE (a convenience
 * alias handled in the UI). The user can later select templates when composing
 * a new notification.
 *
 * Drag-and-drop is implemented with the native HTML5 drag API so that no
 * extra dependencies are needed.
 */

import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { sendNotification } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Layout, Type, FileImage, MousePointerClick, Bell,
  GripVertical, Plus, Trash2, Eye, Send, Save,
} from 'lucide-react';

// ── Block type definitions ───────────────────────────────────────────────────

type BlockType = 'title' | 'body' | 'icon' | 'image' | 'action';

interface Block {
  id: string;
  type: BlockType;
  value: string;
  label?: string; // for action block CTA label
}

const BLOCK_PALETTE: { type: BlockType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { type: 'title',  label: 'Title',       icon: <Type className="h-4 w-4" />,              placeholder: 'Notification headline…' },
  { type: 'body',   label: 'Body',        icon: <Layout className="h-4 w-4" />,             placeholder: 'Supporting message text…' },
  { type: 'icon',   label: 'Icon URL',    icon: <Bell className="h-4 w-4" />,               placeholder: 'https://example.com/icon.png' },
  { type: 'image',  label: 'Hero Image',  icon: <FileImage className="h-4 w-4" />,          placeholder: 'https://example.com/banner.jpg' },
  { type: 'action', label: 'Click URL',   icon: <MousePointerClick className="h-4 w-4" />,  placeholder: 'https://example.com/landing' },
];

const BLOCK_COLORS: Record<BlockType, string> = {
  title:  'bg-blue-50 border-blue-200 text-blue-700',
  body:   'bg-green-50 border-green-200 text-green-700',
  icon:   'bg-purple-50 border-purple-200 text-purple-700',
  image:  'bg-pink-50 border-pink-200 text-pink-700',
  action: 'bg-orange-50 border-orange-200 text-orange-700',
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Stored templates (local only for now) ────────────────────────────────────

const DEFAULT_TEMPLATES: { name: string; blocks: Block[] }[] = [
  {
    name: 'Breaking News',
    blocks: [
      { id: uid(), type: 'title',  value: '🚨 Breaking: {{headline}}' },
      { id: uid(), type: 'body',   value: 'Read the full story now.' },
      { id: uid(), type: 'action', value: '{{articleUrl}}', label: 'Read more' },
    ],
  },
  {
    name: 'Flash Sale',
    blocks: [
      { id: uid(), type: 'title',  value: '🔥 Flash Sale – {{discount}}% off!' },
      { id: uid(), type: 'body',   value: 'Limited time offer. Ends at midnight.' },
      { id: uid(), type: 'image',  value: 'https://example.com/sale-banner.jpg' },
      { id: uid(), type: 'action', value: 'https://example.com/shop', label: 'Shop now' },
    ],
  },
  {
    name: 'New Content',
    blocks: [
      { id: uid(), type: 'icon',   value: 'https://example.com/icon.png' },
      { id: uid(), type: 'title',  value: 'New post: {{title}}' },
      { id: uid(), type: 'body',   value: '{{excerpt}}' },
      { id: uid(), type: 'action', value: '{{url}}' },
    ],
  },
];

// ── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const currentSite = useStore((s) => s.currentSite);

  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  // Drag-and-drop state
  const dragBlockId = useRef<string | null>(null);
  const dragOverBlockId = useRef<string | null>(null);

  // ── Block helpers ──────────────────────────────────────────────────────────

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, { id: uid(), type, value: '' }]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBlock(id: string, field: 'value' | 'label', val: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: val } : b)));
  }

  const onDragStart = useCallback((id: string) => {
    dragBlockId.current = id;
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverBlockId.current = id;
  }, []);

  const onDrop = useCallback(() => {
    const from = dragBlockId.current;
    const to = dragOverBlockId.current;
    if (!from || !to || from === to) return;

    setBlocks((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((b) => b.id === from);
      const toIdx   = arr.findIndex((b) => b.id === to);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });

    dragBlockId.current = null;
    dragOverBlockId.current = null;
  }, []);

  // ── Template management ───────────────────────────────────────────────────

  function loadTemplate(idx: number) {
    setActiveIdx(idx);
    // Deep-clone blocks so editing doesn't mutate the stored template
    setBlocks(templates[idx].blocks.map((b) => ({ ...b, id: uid() })));
    setTemplateName(templates[idx].name);
    setPreview(false);
  }

  function saveTemplate() {
    if (!templateName.trim()) return;
    const saved = { name: templateName.trim(), blocks: blocks.map((b) => ({ ...b })) };

    if (activeIdx !== null) {
      setTemplates((prev) => prev.map((t, i) => (i === activeIdx ? saved : t)));
    } else {
      setTemplates((prev) => {
        const next = [...prev, saved];
        setActiveIdx(next.length - 1);
        return next;
      });
    }
  }

  function newTemplate() {
    setActiveIdx(null);
    setBlocks([]);
    setTemplateName('New Template');
    setPreview(false);
  }

  // ── Send preview notification ─────────────────────────────────────────────

  async function sendPreview() {
    if (!currentSite) return;
    const title  = blocks.find((b) => b.type === 'title')?.value  || 'Test notification';
    const body   = blocks.find((b) => b.type === 'body')?.value   || '';
    const icon   = blocks.find((b) => b.type === 'icon')?.value   || undefined;
    const image  = blocks.find((b) => b.type === 'image')?.value  || undefined;
    const action = blocks.find((b) => b.type === 'action')?.value || undefined;

    setSending(true);
    try {
      await sendNotification(currentSite.id, {
        title, message: body, iconUrl: icon, imageUrl: image,
        clickAction: action, targetType: 'all',
      });
      alert('Test notification sent to all subscribers!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send test.');
    } finally {
      setSending(false);
    }
  }

  // ── Derived preview ──────────────────────────────────────────────────────

  const previewTitle  = blocks.find((b) => b.type === 'title')?.value  || 'Notification Title';
  const previewBody   = blocks.find((b) => b.type === 'body')?.value   || 'Message body text';
  const previewIcon   = blocks.find((b) => b.type === 'icon')?.value;
  const previewImage  = blocks.find((b) => b.type === 'image')?.value;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">

      {/* Left: template library */}
      <aside className="w-56 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Templates</h2>
          <Button size="sm" variant="outline" onClick={newTemplate} className="h-7 px-2">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-1">
          {templates.map((t, i) => (
            <button
              key={i}
              onClick={() => loadTemplate(i)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeIdx === i ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Block palette */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Add Block</h3>
          <div className="space-y-1">
            {BLOCK_PALETTE.map((bp) => (
              <button
                key={bp.type}
                onClick={() => addBlock(bp.type)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {bp.icon}
                {bp.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main canvas */}
      <div className="flex-1 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            className="flex-1 p-2 border border-input rounded-md text-sm bg-background font-medium"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name…"
          />
          <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}>
            <Eye className="h-4 w-4 mr-1" />
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={saveTemplate}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          {currentSite && (
            <Button size="sm" onClick={sendPreview} disabled={sending || blocks.length === 0}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? 'Sending…' : 'Test Send'}
            </Button>
          )}
        </div>

        {/* Preview mode */}
        {preview ? (
          <Card className="max-w-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Browser notification preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg p-3 bg-white shadow-sm flex gap-3">
                {previewIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewIcon} alt="icon" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{previewTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{previewBody}</p>
                </div>
              </div>
              {previewImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImage}
                  alt="hero"
                  className="mt-3 w-full h-32 object-cover rounded-lg border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          /* Block editor canvas */
          <div className="space-y-3">
            {blocks.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center text-muted-foreground">
                <Layout className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Add blocks from the left panel to build your template.</p>
              </div>
            )}

            {blocks.map((block) => {
              const palette = BLOCK_PALETTE.find((p) => p.type === block.type)!;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => onDragStart(block.id)}
                  onDragOver={(e) => onDragOver(e, block.id)}
                  onDrop={onDrop}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-move select-none ${BLOCK_COLORS[block.type]}`}
                >
                  {/* Drag handle */}
                  <GripVertical className="h-5 w-5 mt-1 opacity-40 flex-shrink-0" />

                  {/* Block content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      {palette.icon}
                      {palette.label}
                    </div>

                    {block.type === 'body' ? (
                      <textarea
                        className="w-full p-2 border border-border rounded text-sm bg-white resize-y h-20"
                        value={block.value}
                        onChange={(e) => updateBlock(block.id, 'value', e.target.value)}
                        placeholder={palette.placeholder}
                      />
                    ) : (
                      <input
                        type="text"
                        className="w-full p-2 border border-border rounded text-sm bg-white"
                        value={block.value}
                        onChange={(e) => updateBlock(block.id, 'value', e.target.value)}
                        placeholder={palette.placeholder}
                      />
                    )}

                    {/* Action block: also has a CTA label */}
                    {block.type === 'action' && (
                      <input
                        type="text"
                        className="w-full p-2 border border-border rounded text-sm bg-white"
                        value={block.label || ''}
                        onChange={(e) => updateBlock(block.id, 'label', e.target.value)}
                        placeholder="Button label (optional)"
                      />
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeBlock(block.id)}
                    className="p-1 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                    title="Remove block"
                  >
                    <Trash2 className="h-4 w-4 opacity-60" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
