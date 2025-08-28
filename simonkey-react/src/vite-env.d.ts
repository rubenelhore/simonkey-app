/// <reference types="vite/client" />

declare global {
  interface Window {
    amplitude: {
      getInstance: () => {
        init: (apiKey: string, config?: any) => void;
        logEvent: (event: string, properties?: any) => void;
        setUserId: (userId: string | null) => void;
        identify: (identify: any, properties?: any) => void;
        setUserProperties: (properties: any) => void;
      };
    };
  }
}

export {};
