'use client';

import { usePathname } from 'next/navigation';

/**
 * Transition d'entrée entre les pages.
 *
 * L'implémentation précédente conservait les enfants dans un état local
 * réactualisé par un setTimeout : les enfants n'étant pas dans les dépendances
 * de l'effet, tout changement de contenu sans changement d'URL restait
 * invisible pendant 50 ms — voire indéfiniment. Ici le remontage est piloté par
 * la `key` et l'animation par le CSS, sans état ni minuterie.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-[fadeSlideIn_0.2s_ease-out]">
      {children}
    </div>
  );
}
