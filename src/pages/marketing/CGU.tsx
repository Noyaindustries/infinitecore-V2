import React from 'react';

export default function CGU() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen py-16 text-gray-300 font-sans">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-12 border-b-2 border-[#1F2937] pb-4">Conditions Générales d'Utilisation (CGU)</h1>
        
        <div className="bg-[#1E1E2E] border border-[#2d2d3d] rounded-2xl shadow-sm p-8 space-y-10">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Objet</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Les présentes CGU définissent les règles d'utilisation de la plateforme Infinite Core, éditée par Noya Industries. Elles s'appliquent à tout utilisateur (visiteur, client, développeur, partenaire).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Accès au service</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              L'accès à la plateforme est gratuit. Certains services (commande, gestion de projets) nécessitent la création d'un compte.
            </p>
            <p className="text-[#9CA3AF] leading-relaxed">
              L'utilisateur s'engage à fournir des informations exactes lors de son inscription et à maintenir la confidentialité de ses identifiants.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Utilisation de la plateforme</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              L'utilisateur s'engage à utiliser la plateforme de manière licite, loyale et conforme aux présentes CGU. Il s'interdit notamment :
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>D'utiliser la plateforme à des fins illégales ou frauduleuses.</li>
              <li>De porter atteinte aux droits de propriété intellectuelle de Noya Industries ou de tiers.</li>
              <li>De perturber le fonctionnement de la plateforme (virus, attaques DDoS, etc.).</li>
              <li>De collecter des données personnelles d'autres utilisateurs sans leur consentement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Contenu utilisateur</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              L'utilisateur est seul responsable du contenu (textes, images, fichiers) qu'il publie ou transmet via la plateforme. Il garantit détenir les droits nécessaires sur ce contenu. Noya Industries se réserve le droit de supprimer tout contenu illicite ou contraire aux CGU.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Responsabilité de Noya Industries</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Noya Industries s'efforce d'assurer la disponibilité de la plateforme 24h/24 et 7j/7, mais ne peut garantir un accès ininterrompu. La responsabilité de Noya Industries ne saurait être engagée en cas d'indisponibilité, de perte de données ou de dommages indirects liés à l'utilisation de la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Modification des CGU</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Noya Industries se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des modifications substantielles. L'utilisation continue de la plateforme vaut acceptation des nouvelles CGU.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
