'use client';

/**
 * Pricing / Upgrade Page
 * ======================
 * Displays the available subscription tiers (Free, Pro, Business, Enterprise)
 * with monthly / lifetime toggle. Each tier shows its feature limits and a
 * CTA that links to the admin upgrade flow.
 *
 * The current user's plan is highlighted so they can clearly see where they are
 * and what they would gain by upgrading.
 */

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getLicenseLimits } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap, Crown, Building2, Infinity } from 'lucide-react';

// ── Plan definitions ─────────────────────────────────────────────────────────

interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

interface Plan {
  id: string;
  name: string;
  icon: React.ReactNode;
  monthlyPrice: number | null; // null = contact sales
  lifetimePrice: number | null;
  color: string;         // Tailwind border + accent class
  badgeColor: string;
  features: PlanFeature[];
  limits: { subscribers: string; sites: string; notifications: string };
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    icon: <Zap className="h-5 w-5" />,
    monthlyPrice: 0,
    lifetimePrice: 0,
    color: 'border-border',
    badgeColor: 'bg-muted text-muted-foreground',
    limits: { subscribers: '1,000', sites: '1', notifications: '5,000 / mo' },
    features: [
      { label: 'Push notifications',      included: true },
      { label: 'Basic analytics',         included: true },
      { label: 'Service worker SDK',       included: true },
      { label: 'WordPress plugin',         included: true },
      { label: 'Advanced analytics',       included: false },
      { label: 'A/B testing',             included: false },
      { label: 'Automations (drip, RSS)',  included: false },
      { label: 'Custom branding',         included: false },
      { label: 'API access',              included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: <Crown className="h-5 w-5" />,
    monthlyPrice: 29,
    lifetimePrice: 299,
    color: 'border-primary ring-1 ring-primary',
    badgeColor: 'bg-primary text-primary-foreground',
    limits: { subscribers: '25,000', sites: '5', notifications: 'Unlimited' },
    features: [
      { label: 'Push notifications',      included: true },
      { label: 'Basic analytics',         included: true },
      { label: 'Service worker SDK',       included: true },
      { label: 'WordPress plugin',         included: true },
      { label: 'Advanced analytics',       included: true },
      { label: 'A/B testing',             included: true },
      { label: 'Automations (drip, RSS)',  included: true },
      { label: 'Custom branding',         included: false },
      { label: 'API access',              included: true },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    icon: <Building2 className="h-5 w-5" />,
    monthlyPrice: 99,
    lifetimePrice: 999,
    color: 'border-purple-400 ring-1 ring-purple-400',
    badgeColor: 'bg-purple-600 text-white',
    limits: { subscribers: '250,000', sites: '20', notifications: 'Unlimited' },
    features: [
      { label: 'Push notifications',      included: true },
      { label: 'Basic analytics',         included: true },
      { label: 'Service worker SDK',       included: true },
      { label: 'WordPress plugin',         included: true },
      { label: 'Advanced analytics',       included: true },
      { label: 'A/B testing',             included: true },
      { label: 'Automations (drip, RSS)',  included: true },
      { label: 'Custom branding / White-label', included: true },
      { label: 'API access',              included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: <Infinity className="h-5 w-5" />,
    monthlyPrice: null,
    lifetimePrice: null,
    color: 'border-amber-400 ring-1 ring-amber-400',
    badgeColor: 'bg-amber-500 text-white',
    limits: { subscribers: 'Unlimited', sites: 'Unlimited', notifications: 'Unlimited' },
    features: [
      { label: 'Push notifications',      included: true },
      { label: 'Basic analytics',         included: true },
      { label: 'Service worker SDK',       included: true },
      { label: 'WordPress plugin',         included: true },
      { label: 'Advanced analytics',       included: true },
      { label: 'A/B testing',             included: true },
      { label: 'Automations (drip, RSS)',  included: true },
      { label: 'Custom branding / White-label', included: true },
      { label: 'API access + SLA',        included: true, note: 'Priority support' },
    ],
  },
];

// ── Page component ───────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'lifetime'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('free');

  useEffect(() => {
    getLicenseLimits()
      .then((r) => {
        if (r.data?.plan) setCurrentPlan(r.data.plan);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Choose your plan</h1>
        <p className="text-muted-foreground text-lg">
          Scale your push notifications as your audience grows.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-lg mt-4">
          {(['monthly', 'lifetime'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                billing === b ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              {b === 'monthly' ? 'Monthly' : 'Lifetime'}
              {b === 'lifetime' && (
                <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1 rounded">
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = billing === 'monthly' ? plan.monthlyPrice : plan.lifetimePrice;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col border-2 ${plan.color} ${isCurrent ? 'shadow-lg' : ''}`}
            >
              {/* "Your plan" badge */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow">
                    Current plan
                  </span>
                </div>
              )}

              <CardHeader className="pb-2 pt-6">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${plan.badgeColor}`}>{plan.icon}</span>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>

                {/* Price */}
                <div className="mt-3">
                  {price === null ? (
                    <p className="text-2xl font-bold">Contact us</p>
                  ) : price === 0 ? (
                    <p className="text-2xl font-bold">Free</p>
                  ) : (
                    <p className="text-2xl font-bold">
                      ${price}
                      <span className="text-sm font-normal text-muted-foreground">
                        {billing === 'monthly' ? '/mo' : ' one-time'}
                      </span>
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>👤 {plan.limits.subscribers} subscribers</p>
                  <p>🌐 {plan.limits.sites} {plan.limits.sites === '1' ? 'site' : 'sites'}</p>
                  <p>📬 {plan.limits.notifications} notifications</p>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 justify-between gap-4">
                {/* Features list */}
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f.label} className={`flex items-start gap-2 text-sm ${f.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      <Check className={`h-4 w-4 flex-shrink-0 mt-0.5 ${f.included ? 'text-green-600' : 'opacity-30'}`} />
                      <span>
                        {f.label}
                        {f.note && <span className="ml-1 text-xs text-muted-foreground">({f.note})</span>}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan
                    </Button>
                  ) : plan.id === 'enterprise' ? (
                    <Button variant="outline" className="w-full" asChild>
                      <a href="mailto:sales@posh.com">Contact Sales</a>
                    </Button>
                  ) : (
                    <Button className="w-full">
                      {currentPlan === 'free' ? 'Upgrade to ' : 'Switch to '}
                      {plan.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ / Note */}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans can be cancelled with no penalty. Lifetime plans are non-refundable after 30 days.' },
              { q: 'What counts as a subscriber?', a: 'Any active push subscription registered through the SDK, regardless of device or browser.' },
              { q: 'Is data migrated on upgrade?', a: 'Yes. All your existing subscribers, notifications, and automations carry over immediately.' },
            ].map((faq) => (
              <div key={faq.q}>
                <p className="font-semibold mb-1">{faq.q}</p>
                <p className="text-muted-foreground text-xs">{faq.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
