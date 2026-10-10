import { Eye, EyeOff, Lock, LogIn, Printer, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticateAdmin } from "@/lib/admin-auth";

interface AdminLoginProps {
  onSuccess?: () => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid administrator email address.");
      return;
    }

    setLoading(true);
    try {
      await authenticateAdmin(cleanEmail, cleanPassword);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 antialiased selection:bg-primary/20">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Printer className="size-7" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sophy <span className="text-primary font-bold">Print</span>
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Operator & Shop Administration Portal</p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xs">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Lock className="size-3.5" />
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Sign In to Dashboard</h2>
              <p className="text-[11px] text-muted-foreground">Restricted to authorized operators only</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
                <span className="font-bold">Error:</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-semibold text-foreground">
                Operator Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sophyprint.com"
                className="bg-background h-10 text-xs"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background pr-10 h-10 text-xs"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={loading} className="w-full gap-2 shadow-xs h-10 text-xs font-semibold">
                {loading ? (
                  <>Verifying Credentials…</>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign In to Portal
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>Authenticated securely via Firebase Auth Service</span>
          </div>
        </div>

        {/* Back Link */}
        <p className="text-center text-xs text-muted-foreground">
          Not an operator?{" "}
          <a href="/" className="font-semibold text-primary hover:underline">
            Return to Student Printing
          </a>
        </p>
      </div>
    </div>
  );
}
