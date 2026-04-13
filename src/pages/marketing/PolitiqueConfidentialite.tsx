import React from 'react';

export default function PolitiqueConfidentialite() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen py-16 text-gray-300 font-sans">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-12 border-b-2 border-[#1F2937] pb-4">Politique de Confidentialité</h1>
        
        <div className="bg-[#1E1E2E] border border-[#2d2d3d] rounded-2xl shadow-sm p-8 space-y-10">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Collecte des données</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Nous collectons les données suivantes lors de votre inscription ou utilisation de la plateforme :
            </p>
            <ul className="list-disc list-inside text-[#9CA3AF] space-y-2 ml-4">
              <li>Nom, prénom, email, numéro de téléphone.</li>
              <li>Données de connexion (adresse IP, logs).</li>
              <li>Informations liées aux projets (fichiers, descriptions, livrables).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Utilisation des données</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Vos données sont utilisées pour :
            </p>
            <ul className="list-disc list-inside text-[#9CA3AF] space-y-2 ml-4">
              <li>Gérer votre compte et vos accès.</li>
              <li>Assurer la communication entre clients, développeurs et administrateurs.</li>
              <li>Traiter les paiements et la facturation.</li>
              <li>Améliorer la sécurité et les performances de la plateforme.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Partage des données</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec nos prestataires de paiement (ex: Stripe, CinetPay) uniquement dans le cadre de la transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Sécurité</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles (chiffrement, accès restreint) pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Vos droits</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Conformément à la réglementation (RGPD / Loi ivoirienne sur la protection des données), vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside text-[#9CA3AF] space-y-2 ml-4 mb-4">
              <li>Droit d'accès, de rectification et de suppression de vos données.</li>
              <li>Droit d'opposition au traitement.</li>
              <li>Droit à la portabilité de vos données.</li>
            </ul>
            <p className="text-[#9CA3AF] leading-relaxed">
              Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@padde-ci.ci" className="text-[#6366F1] hover:underline">contact@padde-ci.ci</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
