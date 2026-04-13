import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-[#0A0A0F] min-h-screen pt-24 pb-24 font-sans text-gray-300">
      <div className="max-w-4xl mx-auto px-6">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-16 text-white tracking-tight">
          Nous avons passé 5 ans sur le terrain avant d'écrire une seule ligne de code.
        </h1>

        {/* Timeline */}
        <div className="space-y-8 mb-16 border-t border-[#1F2937] pt-12">
          <div className="flex flex-col md:flex-row gap-2 md:gap-8">
            <div className="md:w-40 font-bold text-[#6366F1] text-xl shrink-0">— 2021</div>
            <div className="text-lg text-[#9CA3AF]">Noya Industries fondée à Abidjan. Conseil, digital et accompagnement de PME ivoiriennes.</div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-8">
            <div className="md:w-40 font-bold text-[#6366F1] text-xl shrink-0">— 2022-2025</div>
            <div className="text-lg text-[#9CA3AF]">5 ans de terrain. Plus de 100 entreprises accompagnées. Même constat partout : WhatsApp, Excel, papier.</div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-8">
            <div className="md:w-40 font-bold text-[#6366F1] text-xl shrink-0">— 2026</div>
            <div className="text-lg text-[#9CA3AF]">Création d'Infinite Core. D'abord pour gérer Noya Industries. Maintenant pour toute l'Afrique.</div>
          </div>
        </div>

        {/* Quote */}
        <blockquote className="border-l-4 border-[#6366F1] pl-6 py-2 mb-16 bg-[#1E1E2E] rounded-r-xl">
          <p className="text-2xl md:text-3xl font-medium italic text-white leading-relaxed">
            « Donner à chaque entrepreneur africain les outils que les grandes entreprises mondiales utilisent — sans les prix, sans la complexité, sans le jargon. »
          </p>
        </blockquote>

        {/* Stats */}
        <div className="mb-16 border-t border-[#1F2937] pt-12">
          <h2 className="text-2xl font-bold mb-8 text-white">Les chiffres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <span className="text-[#6366F1] font-bold text-2xl w-12">— 97</span>
              <span className="text-lg text-[#9CA3AF]">entreprises actives</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#6366F1] font-bold text-2xl w-12">— 7</span>
              <span className="text-lg text-[#9CA3AF]">modules intégrés</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#6366F1] font-bold text-2xl w-16">— 2021</span>
              <span className="text-lg text-[#9CA3AF]">année de création</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#6366F1] font-bold text-2xl w-16">— 5 ans</span>
              <span className="text-lg text-[#9CA3AF]">de terrain avant le code</span>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-16 border-t border-[#1F2937] pt-12">
          <h2 className="text-2xl font-bold mb-8 text-white">Nos valeurs</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <span className="text-[#6366F1] font-bold text-xl shrink-0">—</span>
              <p className="text-lg text-[#9CA3AF]"><strong className="text-white">Proximité</strong> — On comprend vos problèmes parce qu'on les a vécus.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#6366F1] font-bold text-xl shrink-0">—</span>
              <p className="text-lg text-[#9CA3AF]"><strong className="text-white">Transparence</strong> — Prix clairs, données sécurisées, contrats lisibles.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#6366F1] font-bold text-xl shrink-0">—</span>
              <p className="text-lg text-[#9CA3AF]"><strong className="text-white">Croissance</strong> — Chaque outil est pensé pour évoluer avec vous.</p>
            </div>
            <div className="flex gap-4">
              <span className="text-[#6366F1] font-bold text-xl shrink-0">—</span>
              <p className="text-lg text-[#9CA3AF]"><strong className="text-white">Afrique d'abord</strong> — Conçu ici, pour ici, par des gens d'ici.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-[#1F2937] pt-12">
          <Link 
            to="/signup" 
            className="inline-flex items-center gap-2 bg-[#6366F1] hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            Rejoindre les 97 entreprises <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </div>
  );
}
