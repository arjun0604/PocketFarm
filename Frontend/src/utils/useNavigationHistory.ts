import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { areRoutesRelated } from './routeUtils';

// Keep track of the navigation history for the application
let history: string[] = [];

/**
 * A custom hook to track navigation history and provide a way to go back
 * to the previous page or a fallback route if no previous page exists.
 */
export function useNavigationHistory(fallbackRoute: string = '/dashboard') {
  const location = useLocation();
  const navigate = useNavigate();

  // Add current location to history when it changes
  useEffect(() => {
    // Avoid adding the same path twice in a row
    if (history.length === 0 || history[history.length - 1] !== location.pathname) {
      history.push(location.pathname);
    }
    
    // Limit history size to prevent memory issues
    if (history.length > 20) {
      history = history.slice(history.length - 20);
    }
    
    // For debugging - can be removed in production
    // console.log('Navigation history:', history);
  }, [location.pathname]);

  /**
   * Navigate back to the previous page or to the fallback route
   * if there's no previous page in history.
   */
  const goBack = () => {
    // Get current route and remove it from history
    const currentRoute = history.pop() || '';
    
    if (history.length > 0) {
      // Get the previous page
      const previousPage = history[history.length - 1];
      
      // If the previous page is related to the current page, 
      // we want to go back to it
      if (areRoutesRelated(currentRoute, previousPage)) {
        navigate(previousPage);
      } else {
        // Otherwise navigate to the most recent related page or fallback
        let targetPage = fallbackRoute;
        
        // Find the most recent related page
        for (let i = history.length - 1; i >= 0; i--) {
          if (areRoutesRelated(currentRoute, history[i])) {
            targetPage = history[i];
            break;
          }
        }
        
        navigate(targetPage);
      }
    } else {
      navigate(fallbackRoute);
    }
  };

  return { goBack };
} 