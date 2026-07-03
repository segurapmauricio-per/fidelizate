import { Suspense } from "react";
import ActivarPage from "./ActivarClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-4">Cargando...</div>}>
      <ActivarPage />
    </Suspense>
  );
}
