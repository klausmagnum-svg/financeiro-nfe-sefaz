import FiscalModulePage from "../FiscalModulePage";

export default function NfsePage() {
  return <FiscalModulePage title="NFS-e" subtitle="Gerencie notas fiscais de serviço prestadas e tomadas pelos clientes." tabs={["Prestadas", "Tomadas", "Consulta por chave/número", "Importações"]} actions={["Sincronizar NFS-e", "Importar XML", "Importar PDF", "Consultar nota"]} columns={["Cliente", "Número", "Município", "Prestador", "Tomador", "Data de emissão", "Valor do serviço", "ISS", "Status", "Origem", "Ações"]} emptyMessage="Nenhuma NFS-e encontrada. Sincronize, importe um documento ou consulte uma nota." />;
}
