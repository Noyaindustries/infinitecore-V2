import { useParams, Link } from 'react-router-dom';

export default function ModuleDashboard() {
  const { id } = useParams();
  return (
    <div className="p-4">
      <div className="max-w-3xl rounded-2xl border border-border-subtle bg-surface-secondary p-5">
        <h1 className="text-2xl font-bold text-text-primary">Module {id}</h1>
        <p className="mt-1 text-text-secondary">Tableau de bord du module.</p>
      </div>
      <Link to="/login" className="mt-3 inline-block text-[#F27D26] hover:underline">
        Aller à la connexion
      </Link>
    </div>
  );
}
