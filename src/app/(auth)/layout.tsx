import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <header className="container mx-auto px-4 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🍷</span>
          <span className="font-playfair text-2xl font-bold text-primary">
            Pourfolio
          </span>
        </Link>
      </header>
      <main className="container mx-auto flex min-h-[calc(100vh-88px)] items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
