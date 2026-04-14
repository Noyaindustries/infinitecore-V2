import { useParams, Link } from 'react-router-dom';

export default function ModuleDashboard() {
  const { id } = useParams();
  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">Module {id}</h1>
      <p className="text-gray-600 mt-2">Tableau de bord du module.</p>
      <Link to="/login" className="text-[#F27D26] mt-4 inline-block hover:underline">
        Aller à la connexion
      </Link>
    </div>
  );
}
