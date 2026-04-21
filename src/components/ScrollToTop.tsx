import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Remonte en haut de la fenêtre à chaque navigation (ex. liens du pied de page). */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, search, hash]);

  return null;
}
