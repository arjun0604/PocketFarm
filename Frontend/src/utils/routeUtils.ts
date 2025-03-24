import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component to automatically scroll to the top of the page
 * when navigating between routes.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top when the pathname changes
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Helper function to determine the common part of two routes
 * @param route1 First route path
 * @param route2 Second route path
 * @returns Common path shared by both routes
 */
export function getCommonRoute(route1: string, route2: string): string {
  const parts1 = route1.split('/').filter(Boolean);
  const parts2 = route2.split('/').filter(Boolean);
  
  let common = '';
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      common += '/' + parts1[i];
    } else {
      break;
    }
  }
  
  return common || '/';
}

/**
 * Determines if two routes are related (share a common parent path)
 * @param route1 First route path
 * @param route2 Second route path 
 * @returns true if routes are related, false otherwise
 */
export function areRoutesRelated(route1: string, route2: string): boolean {
  const common = getCommonRoute(route1, route2);
  return common !== '/' && common.length > 0;
} 