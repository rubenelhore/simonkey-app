/// <reference types="vite/client" />

declare global {
  interface Window {
    amplitude: {
      init: (apiKey: string, config?: any) => void;
      track: (event: string, properties?: any) => void;
      setUserId: (userId: string | null) => void;
      identify: (properties: any) => void;
      add: (plugin: any) => void;
    };
    sessionReplay: {
      plugin: (config?: any) => any;
    };
  }
}

export {};
