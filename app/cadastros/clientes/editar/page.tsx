import { Suspense } from "react";
import ClienteForm from "../ClienteForm";

export default function EditarClientePage() {
  return (
    <Suspense fallback={null}>
      <ClienteForm mode="edit" />
    </Suspense>
  );
}
