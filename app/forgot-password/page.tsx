"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("No se pudo procesar la solicitud");
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Olvidé mi contraseña</CardTitle>
          <CardDescription>
            Te enviaremos un enlace para crear una nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Si el correo está registrado, recibirás un enlace en los próximos minutos.
                Revisa también la carpeta de spam.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">Volver al login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/login">Volver al login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
