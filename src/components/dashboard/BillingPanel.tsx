"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, Zap, Globe, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for new businesses just getting started.",
    price: { NGN: "Free", USD: "Free" },
    features: [
      "Up to 3 services",
      "Manual bank transfer payments",
      "Custom booking page",
      "Embeddable website widget",
      "Basic availability & scheduling",
    ],
    lockedFeatures: [
      "Stripe online payments",
      "Dashboard statistics",
      "Automated email reminders",
      "Client management CRM",
      "Coupons & discounts",
      "WhatsApp & Telegram bots"
    ]
  },
  {
    id: "growth",
    name: "Growth",
    description: "Accept cards and let the system remind your clients.",
    price: { NGN: "₦5,000", USD: "$5" },
    annualPrice: { NGN: "₦50,000", USD: "$50" }, // Pay 10 get 12
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    features: [
      "Everything in Starter, plus:",
      "Accept Stripe & Paystack cards",
      "Full dashboard analytics",
      "Automated email reminders",
      "Unlimited services",
    ],
    lockedFeatures: [
      "Client management CRM",
      "Coupons & discounts",
      "WhatsApp & Telegram bots"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    description: "Run marketing campaigns and retain your clients.",
    price: { NGN: "₦15,000", USD: "$15" },
    annualPrice: { NGN: "₦150,000", USD: "$150" },
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    popular: true,
    features: [
      "Everything in Growth, plus:",
      "Client management CRM",
      "Coupons & discounts",
      "AI Setup Assistant",
      "Mass email broadcasts"
    ],
    lockedFeatures: [
      "WhatsApp & Telegram bots",
      "Live conversations tab"
    ]
  },
  {
    id: "business",
    name: "Business",
    description: "The ultimate autopilot. Bots handle your bookings.",
    price: { NGN: "₦25,000", USD: "$25" },
    annualPrice: { NGN: "₦250,000", USD: "$250" },
    icon: MessageCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    features: [
      "Everything in Pro, plus:",
      "WhatsApp automated booking bot",
      "Telegram automated booking bot",
      "Live chat conversations tab",
      "Priority 24/7 support"
    ],
    lockedFeatures: []
  }
];

export function BillingPanel({ 
  businessId, 
  currentPlan, 
  status, 
  trialEndsAt, 
  isLifetime 
}: { 
  businessId: string;
  currentPlan: string;
  status: string | null;
  trialEndsAt: string | null;
  isLifetime: boolean;
}) {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleUpgrade(planId: string) {
    if (planId === currentPlan) return;
    
    setLoadingId(planId);
    try {
      const res = await fetch("/api/dashboard/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, isAnnual, currency })
      });
      
      const data = await res.json();
      if (data.url) {
        // We will do a mock upgrade immediately for now and refresh
        router.refresh();
      } else {
        alert("Failed to upgrade: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setLoadingId(null);
    }
  }

  const isTrial = status === "trialing";
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="space-y-8">
      {/* Status Banner */}
      {isLifetime ? (
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 p-6 text-purple-900 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Lifetime Access Unlocked
          </h2>
          <p className="mt-1 text-sm font-bold opacity-80">You have a lifetime {currentPlan} plan. You will never be billed.</p>
        </div>
      ) : isTrial ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 shadow-sm">
          <h2 className="text-lg font-black">Free Trial Active</h2>
          <p className="mt-1 text-sm font-bold opacity-80">
            You are currently trialing the <span className="uppercase">{currentPlan}</span> plan. 
            You have {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left before your trial ends.
          </p>
        </div>
      ) : status === "past_due" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h2 className="text-lg font-black">Payment Failed</h2>
          <p className="mt-1 text-sm font-bold opacity-80">
            Your last payment failed. Please update your payment method within the grace period to avoid being downgraded to the Starter plan.
          </p>
        </div>
      ) : null}

      {/* Toggles */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button 
            onClick={() => setCurrency("NGN")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${currency === "NGN" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            ₦ NGN
          </button>
          <button 
            onClick={() => setCurrency("USD")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${currency === "USD" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            <Globe className="h-4 w-4" /> USD
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button 
            onClick={() => setIsAnnual(false)}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${!isAnnual ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setIsAnnual(true)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${isAnnual ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            Annually <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${isAnnual ? "bg-white/20" : "bg-purple-100 text-purple-700"}`}>2 MONTHS FREE</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const PlanIcon = plan.icon;
          
          return (
            <div 
              key={plan.id} 
              className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm transition-all ${plan.popular ? "border-purple-500 ring-1 ring-purple-500" : "border-slate-200"} ${isCurrent ? "bg-slate-50" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-500 px-3 py-1 text-xs font-black text-white">
                  MOST POPULAR
                </div>
              )}
              
              <div className="mb-4">
                {PlanIcon && <PlanIcon className={`mb-4 h-8 w-8 ${plan.color}`} />}
                <h3 className="text-xl font-black text-ink">{plan.name}</h3>
                <p className="mt-2 min-h-10 text-sm text-ink/60">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-black text-ink">
                  {isAnnual && plan.annualPrice ? plan.annualPrice[currency] : plan.price[currency]}
                </span>
                {plan.price[currency] !== "Free" && (
                  <span className="text-sm font-bold text-ink/40">
                    /{isAnnual ? "yr" : "mo"}
                  </span>
                )}
              </div>

              <button
                disabled={isCurrent || loadingId !== null}
                onClick={() => handleUpgrade(plan.id)}
                className={`mb-8 w-full rounded-xl py-3 text-sm font-black transition ${
                  isCurrent 
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : plan.popular 
                      ? "bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 hover:-translate-y-0.5"
                      : "bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5"
                }`}
              >
                {loadingId === plan.id ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : isCurrent ? (
                  "Current Plan"
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </button>

              <div className="flex-1 space-y-4">
                <p className="text-xs font-black tracking-widest text-ink/40 uppercase">What's included</p>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex gap-3 text-sm font-bold text-ink/80">
                      <Check className={`h-5 w-5 shrink-0 ${plan.color || "text-slate-400"}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.lockedFeatures.length > 0 && (
                  <>
                    <p className="mt-6 text-xs font-black tracking-widest text-ink/40 uppercase">Locked Features</p>
                    <ul className="space-y-3 opacity-50 grayscale">
                      {plan.lockedFeatures.map((feature, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-ink/60">
                          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
