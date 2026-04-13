import React from 'react';

export default function MentionsLegales() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen py-16 text-gray-300 font-sans">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-12 border-b-2 border-[#1F2937] pb-4">Mentions Légales</h1>
        
        <div className="bg-[#1E1E2E] border border-[#2d2d3d] rounded-2xl shadow-sm p-8 space-y-10">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Éditeur du site</h2>
            <div className="space-y-2 text-[#9CA3AF]">
              <p><span className="font-semibold">Raison sociale :</span> Noya Industries</p>
              <p><span className="font-semibold">Forme juridique :</span> Entreprise individuelle / SARL (à préciser selon statut juridique officiel)</p>
              <p><span className="font-semibold">Siège social :</span> Abidjan, Riviera, Côte d'Ivoire</p>
              <p><span className="font-semibold">Téléphone :</span> +225 01 03 015 467</p>
              <p><span className="font-semibold">Email :</span> contact@padde-ci.ci</p>
              <p><span className="font-semibold">Directeur de la publication :</span> N'guessan Opely Yannick Abraham</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Hébergement</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Le site infinitecore.app est hébergé sur un serveur VPS dédié (V5 — SSD NVMe 150 Go, KVM, protection DDoS).
              Serveur pris en charge par Noya Industries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Propriété intellectuelle</h2>
            <p className="text-[#9CA3AF] leading-relaxed mb-4">
              L'ensemble du contenu de ce site (textes, images, logos, code, architecture) est la propriété exclusive de Noya Industries. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.
            </p>
            <p className="text-[#9CA3AF] leading-relaxed">
              La marque Infinite Core et le logo associé sont des marques de Noya Industries. Toute utilisation non autorisée est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Responsabilité</h2>
            <p className="text-[#9CA3AF] leading-relaxed">
              Noya Industries s'efforce de maintenir les informations publiées exactes et à jour. Toutefois, la société ne peut garantir l'exactitude, la complétude ou l'actualité des informations diffusées sur ce site.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
