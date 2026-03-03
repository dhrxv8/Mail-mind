import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  {
    icon: "📬",
    title: "Multi-Account Inbox",
    desc: "Student + personal + work Gmail in one place. Never context-switch again.",
  },
  {
    icon: "🧠",
    title: "Living Memory",
    desc: "Learns who your professors, recruiters, and clients are. Context compounds the longer you use it.",
  },
  {
    icon: "🔑",
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
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✉️</span>
            <span className="font-bold text-xl text-gray-900">MailMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-20 pb-16 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <span>🧠</span> Bring Your Own AI Key
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your AI that actually
              <br />
              <span className="text-blue-600">knows you.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
              Connect your Gmail accounts. Bring your Claude, GPT, or Gemini key.
              Build a personal memory layer that grows smarter every day.
            </p>
            <p className="text-gray-500 mb-10">
              We don&apos;t charge for AI — you already pay for it.
              <br />
              We just make it know everything about you.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              <GoogleIcon className="w-5 h-5" />
              Connect Gmail — It&apos;s Free
            </Link>
            <p className="text-xs text-gray-400 mt-3">No credit card required.</p>
          </div>
        </section>

        {/* ── Social proof strip ────────────────────────────────────────────── */}
        <div className="bg-gray-50 border-y border-gray-100 py-6">
          <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
            {[
              { value: "BYOAI",  label: "Claude, GPT, Grok, Gemini" },
              { value: "Multi",  label: "Gmail accounts unified" },
              { value: "$0",     label: "AI inference costs" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-14">
              Up and running in 3 minutes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {HOW_IT_WORKS.map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section className="py-12 px-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
              Everything you need, nothing you don&apos;t
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BYOAI pitch ───────────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Already paying for Claude or GPT?
            </h2>
            <p className="text-gray-600 text-lg mb-6 leading-relaxed">
              Your subscription already gives you access to the world&apos;s best AI.
              MailMind connects that AI to your email history so it can actually help you —
              without charging you twice.
            </p>
            <div className="inline-flex flex-wrap gap-2 justify-center">
              {["Claude (Anthropic)", "GPT-4 (OpenAI)", "Grok (xAI)", "Gemini (Google)"].map(
                (provider) => (
                  <span
                    key={provider}
                    className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    {provider}
                  </span>
                )
              )}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
              Simple pricing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Free */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <p className="font-bold text-2xl text-gray-900 mb-1">Free</p>
                <p className="text-gray-500 text-sm mb-4">Perfect to get started</p>
                <p className="text-4xl font-bold text-gray-900 mb-6">
                  $0
                  <span className="text-gray-400 text-lg font-normal">/mo</span>
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className="block text-center border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>

              {/* Pro */}
              <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 relative">
                <div className="absolute -top-3 left-6 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Most Popular
                </div>
                <p className="font-bold text-2xl text-gray-900 mb-1">Pro</p>
                <p className="text-gray-500 text-sm mb-4">For power users</p>
                <p className="text-4xl font-bold text-gray-900 mb-6">
                  $6
                  <span className="text-gray-400 text-lg font-normal">/mo</span>
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-green-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className="block text-center bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Start Free, Upgrade Anytime
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Founder story ─────────────────────────────────────────────────── */}
        <section className="py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <blockquote className="text-gray-600 italic text-lg leading-relaxed border-l-4 border-blue-200 pl-6">
              &ldquo;I was a Data Science student juggling a .edu and a personal Gmail. I
              already paid for Claude. I was frustrated that it didn&apos;t know my
              professors, my deadlines, or my job search. So I built MailMind — it
              connects both accounts, learns from my emails, and lets me use my own
              key. No double-charging. Just one AI that actually knows me.&rdquo;
            </blockquote>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {FAQS.map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to meet your AI that knows you?
            </h2>
            <p className="text-gray-500 mb-8">
              Free to start. No credit card required. Bring your own AI key.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              <GoogleIcon className="w-5 h-5" />
              Connect Gmail Free
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">✉️</span>
            <span className="font-bold text-gray-900">MailMind</span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} MailMind. Your data stays yours.
          </p>
        </div>
      </footer>
    </div>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" />
    </svg>
  );
}
