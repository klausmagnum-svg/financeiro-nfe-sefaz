"use client";

import { useState } from "react";
import FiscalModulePage from "../FiscalModulePage";
import SyncNFSeModal from "@/app/components/SyncNFSeModal";

export const dynamic = 'force-dynamic';

export default function NfsePage() {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  return (
    <>
      <FiscalModulePage
        title="NFS-e"
        subtitle="Gerencie notas fiscais de serviço prestadas e tomadas pelos clientes."
        tabs={["Prestadas", "Tomadas", "Consulta por chave/número", "Importações"]}
        actions={["Sincronizar NFS-e", "Importar XML", "Importar PDF", "Consultar nota"]}
        columns={["Cliente", "Número", "Município", "Prestador", "Tomador", "Data de emissão", "Valor do serviço", "ISS", "Status", "Origem", "Ações"]}
        emptyMessage="Nenhuma NFS-e encontrada. Sincronize, importe um documento ou consulte uma nota."
        onSyncClick={() => setIsSyncModalOpen(true)}
      />
      <SyncNFSeModal
        isOpen={isSyncModalOpen}
        onCancel={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => setIsSyncModalOpen(false)}
      />
    </>
  );
}
