/** Centred card used by the sign-in, invite and password-reset pages. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen flex-1 place-items-center bg-zinc-100 px-4">
      <div className="card w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">atVenu</p>
        <h1 className="mb-6 text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
