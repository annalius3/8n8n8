import { Suspense } from "react";
import LoginClientPage from "@/components/login-client-page";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClientPage />
    </Suspense>
  );
}
