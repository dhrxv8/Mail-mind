import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { detectCurrency } from "../api/billing.js";

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
      </svg>
    ),
    title: "Multi-Account Inbox",
    desc: "Student + personal + work Gmail in one place. Never context-switch again.",
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
    title: "Living Memory",
    desc: "Learns who your professors, recruiters, and clients are. Context compounds the longer you use it.",
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
      </svg>
    ),
    title: "Your Key, Your Credits",
    desc: "Use your Claude, GPT-4, Grok, or Gemini subscription. We never charge you for AI inference.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Connect Gmail",
    desc: "Sign in with Google. Add your personal, .edu, and work accounts in seconds.",
  },
  {
    step: "2",
    title: "Sync & Build Memory",
    desc: "MailMind reads your email history and builds a personal knowledge base about your world.",
  },
  {
    step: "3",
    title: "Add Your AI Key",
    desc: "Paste your Claude, GPT, Grok, or Gemini key. Now your AI knows everything about you.",
  },
];

const FREE_FEATURES = [
  "2 Gmail accounts",
  "30-day memory depth",
  "Bring your own AI key",
  "Chat with your email AI",
  "AI inbox triage",
];

const PRO_FEATURES = [
  "Unlimited Gmail accounts",
  "Full email history",
  "Real-time sync via Pub/Sub",
  "Priority memory processing",
  "Everything in Free",
];

const FAQS = [
  {
    q: "Do I have to pay for AI?",
    a: "No. You bring your own API key from Anthropic, OpenAI, xAI, or Google. We don't mark it up or proxy it — your key talks to their API directly.",
  },
  {
    q: "What does MailMind actually store?",
    a: "We store encrypted chunks of your email content (sender names, topics, summaries) as vector embeddings. Raw email bodies are never stored long-term.",
  },
  {
    q: "Can I use this with my work Gmail?",
    a: "Yes. You can connect any Gmail account you own. For managed Workspace accounts, your IT admin may restrict third-party OAuth — check with them first.",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free gives you 2 accounts and 30 days of memory depth — great for most users. Pro unlocks unlimited accounts, full email history, and real-time push sync.",
  },
];

export default function Landing() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <span className="font-bold text-xl text-slate-900">MailMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-600 font-medium hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-glow-sm"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-24 pb-20 text-center px-6 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06]"
                 style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
          </div>

          <div className="max-w-3xl mx-auto relative">
            <div className="inline-flex items-center gap-2 border border-brand-200 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-semibold mb-6 uppercase tracking-wide animate-fade-in">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-dot" />
              Bring Your Own AI Key
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight tracking-tight animate-slide-up">
              Your AI that actually
              <br />
              <span style={{ background: "linear-gradient(135deg, #4f46e5, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                knows you.
              </span>
            </h1>
            <p className="text-xl text-slate-500 mb-4 max-w-2xl mx-auto leading-relaxed animate-fade-in">
              Connect your Gmail accounts. Bring your Claude, GPT, or Gemini key.
              Build a personal memory layer that grows smarter every day.
            </p>
            <p className="text-slate-400 mb-10 text-sm animate-fade-in">
              We don&apos;t charge for AI — you already pay for it.
              We just make it know everything about you.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all hover:opacity-90 active:scale-95 shadow-lg hover:shadow-glow"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              <GoogleIcon className="w-5 h-5" />
              Connect Gmail — It&apos;s Free
            </Link>
            <p className="text-xs text-slate-400 mt-3">No credit card required.</p>
          </div>
        </section>

        {/* Social proof strip */}
        <div className="border-y border-slate-100 py-8 bg-slate-50/50">
          <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
            {[
              { value: "BYOAI",  label: "Claude, GPT, Grok, Gemini" },
              { value: "Multi",  label: "Gmail accounts unified" },
              { value: "$0",     label: "AI inference costs" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-slate-900"
                   style={{ background: "linear-gradient(135deg, #4f46e5, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {value}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">Getting started</p>
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-14 tracking-tight">
              Up and running in 3 minutes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
                <div key={step} className="relative text-center group">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-4 text-white transition-transform duration-200 group-hover:scale-110"
                       style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}>
                    {step}
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-5 left-full w-full h-px bg-slate-200" />
                  )}
                  <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-6 bg-slate-50/70">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-10 tracking-tight">
              Everything you need, nothing you don&apos;t
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-brand-600"
                       style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BYOAI pitch */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-brand-600 animate-float"
                 style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}>
              <svg className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
              Already paying for Claude or GPT?
            </h2>
            <p className="text-slate-500 text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
              Your subscription already gives you access to the world&apos;s best AI.
              MailMind connects that AI to your email history so it can actually help you —
              without charging you twice.
            </p>
            <div className="inline-flex flex-wrap gap-2 justify-center">
              {["Claude (Anthropic)", "GPT-4 (OpenAI)", "Grok (xAI)", "Gemini (Google)"].map((provider) => (
                <span
                  key={provider}
                  className="bg-brand-50 text-brand-700 border border-brand-100 px-3.5 py-1.5 rounded-full text-sm font-medium hover:bg-brand-100 transition-colors cursor-default"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <PricingSection />

        {/* Founder story */}
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto">
            <blockquote className="text-slate-600 text-lg leading-relaxed border-l-2 pl-6"
                        style={{ borderColor: "#6366f1" }}>
              &ldquo;I was a Data Science student juggling a .edu and a personal Gmail. I
              already paid for Claude. I was frustrated that it didn&apos;t know my
              professors, my deadlines, or my job search. So I built MailMind — it
              connects both accounts, learns from my emails, and lets me use my own
              key. No double-charging. Just one AI that actually knows me.&rdquo;
            </blockquote>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-6 bg-slate-50/70">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-10 tracking-tight">
              Frequently asked questions
            </h2>
            <div className="space-y-3">
              {FAQS.map(({ q, a }) => (
                <FaqItem key={q} question={q} answer={a} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
              Ready to meet your AI that knows you?
            </h2>
            <p className="text-slate-400 mb-8 text-sm">
              Free to start. No credit card required. Bring your own AI key.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all hover:opacity-90 active:scale-95 shadow-lg hover:shadow-glow"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              <GoogleIcon className="w-5 h-5" />
              Connect Gmail Free
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900">MailMind</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} MailMind. Your data stays yours.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden transition-shadow hover:shadow-card-hover">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="font-semibold text-slate-900 text-sm pr-4">{question}</h3>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-slate-500 text-sm leading-relaxed px-5 pb-5">{answer}</p>
        </div>
      </div>
    </div>
  );
}

function PricingSection() {
  const currency = useMemo(() => detectCurrency(), []);
  const isINR = currency === "inr";
  const proPrice = isINR ? "₹499" : "$6";

  return (
    <section className="py-24 px-6 bg-slate-50/70">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">Pricing</p>
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10 tracking-tight">
          Simple pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {/* Free */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <p className="font-bold text-xl text-slate-900 mb-1">Free</p>
            <p className="text-slate-400 text-sm mb-5">Perfect to get started</p>
            <p className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">
              {isINR ? "₹0" : "$0"}
              <span className="text-slate-400 text-lg font-normal">/mo</span>
            </p>
            <ul className="space-y-2.5 text-sm text-slate-600 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/login"
              className="block text-center border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-6 relative overflow-hidden shadow-glow-sm hover:shadow-glow transition-shadow duration-300"
               style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 100%)" }}>
            <div className="absolute -top-3 left-6 text-xs px-3 py-1 rounded-full font-semibold text-amber-900"
                 style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
              Most Popular
            </div>
            <p className="font-bold text-xl text-white mb-1">Pro</p>
            <p className="text-indigo-300 text-sm mb-5">For power users</p>
            <p className="text-4xl font-bold text-white mb-6 tracking-tight">
              {proPrice}
              <span className="text-indigo-300 text-lg font-normal">/mo</span>
            </p>
            <ul className="space-y-2.5 text-sm text-indigo-200 mb-6">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/login"
              className="block text-center bg-white text-brand-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-50 transition-colors"
            >
              Start Free, Upgrade Anytime
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" />
    </svg>
  );
}
