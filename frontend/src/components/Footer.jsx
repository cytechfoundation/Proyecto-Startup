export default function Footer() {
  return (
    <footer className="border-t border-[var(--l-border)] px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-[var(--l-muted)] md:flex-row">
        <span className="font-bold text-[var(--l-text2)]">
          CYTECH<span className="text-[var(--l-accent)]">.</span>
        </span>
        <p>SaaS a medida · Cloud · Integraciones POS, pagos y DIAN</p>
        <p>© 2026 Cytech</p>
      </div>
    </footer>
  );
}
