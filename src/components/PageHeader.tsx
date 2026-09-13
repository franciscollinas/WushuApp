export default function PageHeader({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tinta/60">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}