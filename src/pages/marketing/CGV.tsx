import React from 'react';

export default function CGV() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen py-16 text-gray-300 font-sans">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-12 border-b-2 border-[#1F2937] pb-4">Conditions Générales de Vente (CGV)</h1>
        
        <div className="bg-[#1E1E2E] border border-[#2d2d3d] rounded-2xl shadow-sm p-8 space-y-10">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Objet</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Les présentes CGV régissent les relations contractuelles entre Noya Industries (via la plateforme Infinite Core) et ses clients, dans le cadre de la vente de services numériques (développement web, applications mobiles, modules SaaS, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Services proposés</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Infinite Core propose :
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Des services sur-mesure (PADDE-CI).</li>
              <li>Des modules prêts à l'emploi (Infinite Core Modules).</li>
            </ul>
            <p className="text-[#9CA3AF] leading-relaxed mt-4">
              Les descriptions, prix et délais sont indiqués sur la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Commandes et Devis</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Toute commande de service sur-mesure fait l'objet d'un devis préalable. La commande est validée après acceptation du devis et paiement de l'acompte (généralement 30% à 50%).
            </p>
            <p className="text-[#9CA3AF] leading-relaxed">
              Pour les modules prêts à l'emploi, la commande est validée dès le paiement intégral.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Tarifs et Paiement</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Les prix sont indiqués en Francs CFA (XOF), hors taxes (HT) ou toutes taxes comprises (TTC) selon la mention.
            </p>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Le paiement s'effectue par :
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mb-4">
              <li>Mobile Money (Wave, Orange, MTN, Moov).</li>
              <li>Carte bancaire (Visa, Mastercard).</li>
              <li>Virement bancaire.</li>
            </ul>
            <p className="text-[#9CA3AF] leading-relaxed">
              En cas de retard de paiement, des pénalités pourront être appliquées conformément à la législation en vigueur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Livraison et Délais</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              Les délais de livraison sont donnés à titre indicatif lors de la commande. Un retard ne peut justifier l'annulation de la commande ni donner lieu à des dommages et intérêts, sauf accord explicite.
            </p>
            <p className="text-[#9CA3AF] leading-relaxed">
              La livraison s'effectue via la plateforme Infinite Core (accès au code source, déploiement, ou lien de téléchargement).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Propriété intellectuelle</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Sauf mention contraire dans le devis, les droits de propriété intellectuelle sur les développements sur-mesure sont transférés au client après paiement intégral de la facture. Les modules prêts à l'emploi restent la propriété de Noya Industries et font l'objet d'une licence d'utilisation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Rétractation et Remboursement</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              S'agissant de services numériques personnalisés ou de contenus numériques fournis sur un support immatériel dont l'exécution a commencé, le droit de rétractation ne s'applique pas, conformément à la loi. Aucun remboursement n'est possible après le début des travaux ou le téléchargement d'un module.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Litiges</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux d'Abidjan (Côte d'Ivoire) seront seuls compétents.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
