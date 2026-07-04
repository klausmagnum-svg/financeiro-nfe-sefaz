import { Suspense } from "react";
import ObrigacaoForm from "../ObrigacaoForm";

export default function NovaObrigacaoPage() {
  return (
    <Suspense fallback={null}>
      <ObrigacaoForm mode="create" />
    </Suspense>
  );
}
