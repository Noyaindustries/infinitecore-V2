import { Link } from 'react-router-dom';

export default function PolitiqueCookies() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen pt-24 pb-24 font-sans text-gray-300">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-12 border-b border-[#1F2937] pb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-white">Politique Cookies</h1>
          <p className="text-gray-500 italic">Dernière mise à jour : Mars 2026</p>
        </div>

        <div className="space-y-12 text-lg text-[#9CA3AF]">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Qu'est-ce qu'un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre navigateur lors de votre visite. Il permet de vous reconnaître et d'améliorer votre expérience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Les cookies que nous utilisons</h2>
            <ul className="space-y-4 list-none pl-0">
              <li className="flex gap-3">
                <span className="text-[#6366F1] font-bold">—</span>
                <div>
                  <strong className="text-white">Cookies essentiels (obligatoires)</strong> — Session utilisateur (connexion), préférences de langue. Sans ces cookies le site ne fonctionne pas.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-[#6366F1] font-bold">—</span>
                <div>
                  <strong className="text-white">Cookies analytiques (avec consentement)</strong> — Google Analytics 4 et Microsoft Clarity. Permettent de comprendre comment le site est utilisé. Aucune donnée personnelle transmise.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-[#6366F1] font-bold">—</span>
                <div>
                  <strong className="text-white">Cookies de confort (avec consentement)</strong> — Mémorisation de vos préférences d'affichage.
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Gestion de vos préférences</h2>
            <p>
              Lors de votre première visite, une bannière vous demande votre consentement pour les cookies non essentiels. Vous pouvez modifier vos préférences à tout moment depuis le lien 'Gestion des cookies' en bas de chaque page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">Cookies tiers</h2>
            <p>
              Google Analytics (Google LLC) : collecte des données de navigation anonymisées. Politique Google : <a href="https://policies.google.com/privacy" className="text-[#6366F1] hover:underline" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
