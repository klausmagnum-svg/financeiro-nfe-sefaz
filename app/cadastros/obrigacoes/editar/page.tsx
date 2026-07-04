import { Suspense } from "react";
import ObrigacaoForm from "../ObrigacaoForm";

export default function EditarObrigacaoPage() {
  return (
    <Suspense fallback={null}>
      <ObrigacaoForm mode="edit" />
    </Suspense>
  );
}
