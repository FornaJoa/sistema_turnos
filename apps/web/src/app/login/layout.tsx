import { Suspense } from "react";
import LoginPage from "./page";

export default function LoginRoute() {
  return (
    <Suspense fallback={<main className="p-6">Cargando...</main>}>
      <LoginPage />
    </Suspense>
  );
}
