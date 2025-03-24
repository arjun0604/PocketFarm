// Global type definitions for window object extensions
interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: {
          client_id: string;
          callback: (response: {credential: string}) => void;
          auto_select?: boolean;
        }) => void;
        prompt: (callback?: (notification: {
          isNotDisplayed: () => boolean;
          isSkippedMoment: () => boolean;
          isDismissedMoment: () => boolean;
          getMomentType: () => string;
        }) => void) => void;
        renderButton: (element: HTMLElement, options: object) => void;
      }
    };
  };
  googleClientId?: string;
} 