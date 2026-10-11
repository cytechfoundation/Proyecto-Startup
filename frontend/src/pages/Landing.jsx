import Navbar from "../components/Navbar.jsx";
import Hero from "../components/Hero.jsx";
import Segments from "../components/Segments.jsx";
import Services from "../components/Services.jsx";
import Founder from "../components/Founder.jsx";
import Donate from "../components/Donate.jsx";
import Social from "../components/Social.jsx";
import CtaBand from "../components/CtaBand.jsx";
import Footer from "../components/Footer.jsx";

/** Landing premium Cytech: glow radial + navbar flotante + reveal por scroll. */
export default function Landing() {
  return (
    <div className="relative min-h-screen bg-[var(--l-bg)] text-[var(--l-text)] antialiased">
      {/* Glow Effect: resplandores radiales en esquinas */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1E293B,transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.08),transparent_50%)]" />

      <div className="relative">
        <Navbar />
        <main>
          <Hero />
          <Segments />
          <Services />
          <Founder />
          <Donate />
          <Social />
          <CtaBand />
        </main>
        <Footer />
      </div>
    </div>
  );
}
