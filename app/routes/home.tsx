import { Link, useOutletContext } from "react-router";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "LinguaFast - Master English" },
    { name: "description", content: "The fastest way to learn English fluency." },
  ];
}

export default function Home() {
  const { user } = useOutletContext<{ user: any }>();

  return (
    <div>
      {/* Hero Section */}
      <section className="py-24 text-center">
        <div className="container mx-auto px-4">
          <div className="max-w-[800px] mx-auto">
            <div className="inline-block px-4 py-1 mb-6 rounded-full bg-primary-light text-primary font-semibold text-sm">
              🚀 Science-Based Vocabulary Learning
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-gray-900 mb-6">
              Master 1000+ Words in <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent">
                30 Days
              </span>
            </h1>

            <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-2xl mx-auto">
              Forget boring lists. Learn English vocabulary through interactive flashcards, spaced repetition, and real-world context.
            </p>

            <div className="flex gap-4 justify-center">
              <Link to={user ? "/topics" : "/register"} className="px-8 py-4 rounded-xl bg-primary text-white text-lg font-semibold shadow-sm hover:bg-primary-dark hover:-translate-y-px hover:shadow-glow transition-all">
                {user ? "Continue Learning" : "Start Memorizing"}
              </Link>
              <Link to="/topics" className="px-8 py-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-lg font-semibold hover:border-primary hover:text-primary transition-colors">
                Browse Packs
              </Link>
            </div>

            <div className="mt-16 opacity-80">
              <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Proven effective by learners from</p>
              <div className="flex justify-center gap-12 grayscale opacity-60">
                {/* Placeholders for logos */}
                <span className="font-bold text-xl">HARVARD</span>
                <span className="font-bold text-xl">DUOLINGO</span>
                <span className="font-bold text-xl">BABBEL</span>
                <span className="font-bold text-xl">MEMRISE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-gray-900">Why LinguaFast works</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              We use cognitive science to ensure you never forget what you learn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🧠"
              title="Spaced Repetition"
              desc="Our algorithm knows exactly when you're about to forget a word and brings it back for review."
            />
            <FeatureCard
              icon="⚡"
              title="Smart Flashcards"
              desc="Rich media cards with audio, images, and example sentences to create strong memory associations."
            />
            <FeatureCard
              icon="🎮"
              title="Gamified Progress"
              desc="Earn streaks, unlock achievements, and compete on leaderboards to stay motivated daily."
            />
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-16 text-center text-white shadow-xl">
            <h2 className="text-4xl font-bold mb-6">Expand your vocabulary today</h2>
            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              {user ? "Pick up where you left off and master new words today." : "Create a free account and get your first \"Core 500 Words\" pack for free."}
            </p>
            <Link to={user ? "/topics" : "/register"} className="inline-block px-10 py-4 rounded-xl bg-white text-primary text-lg font-bold shadow-2xl hover:bg-gray-50 hover:-translate-y-1 transition-all">
              {user ? "Explore Packs" : "Get Started Free"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="rounded-2xl bg-gray-50/50 p-8 border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="text-4xl mb-6 bg-white w-20 h-20 flex items-center justify-center rounded-2xl shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
