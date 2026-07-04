import { Suspense } from "react";
import ClienteForm from "../ClienteForm";

export default function NovoClientePage() {
  return (
    <Suspense fallback={null}>
      <ClienteForm />
    </Suspense>
  );
}
