import React, { createContext, useContext, useState, useEffect } from 'react';

interface UpdateContextType {
  updateAvailable: boolean;
  newServiceWorker: ServiceWorker | null;
  triggerUpdate: () => void;
  dismissUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const useUpdate = () => {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error('useUpdate must be used within UpdateProvider');
  }
  return context;
};

interface UpdateProviderProps {
  children: React.ReactNode;
  onUpdateAvailable?: (available: boolean, sw: ServiceWorker | null) => void;
}

export const UpdateProvider: React.FC<UpdateProviderProps> = ({ 
  children, 
  onUpdateAvailable 
}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newServiceWorker, setNewServiceWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleUpdateAvailable = (sw: ServiceWorker | null) => {
    console.log('[UpdateContext] Update available, SW:', sw);
    setUpdateAvailable(true);
    setNewServiceWorker(sw);
    setDismissed(false); // Reset dismissed state when new update arrives
  };

  const triggerUpdate = () => {
    console.log('[UpdateContext] User triggered update');
    if (newServiceWorker) {
      newServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      // Reload will happen automatically on 'controllerchange' event
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    console.log('[UpdateContext] User dismissed update temporarily');
    setDismissed(true);
  };

  useEffect(() => {
    if (onUpdateAvailable && updateAvailable && newServiceWorker) {
      onUpdateAvailable(true, newServiceWorker);
    }
  }, [updateAvailable, newServiceWorker, onUpdateAvailable]);

  const value: UpdateContextType = {
    updateAvailable: updateAvailable && !dismissed,
    newServiceWorker,
    triggerUpdate,
    dismissUpdate,
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
};

// Export a function to be called from main.tsx
let updateCallback: ((sw: ServiceWorker | null) => void) | null = null;

export const setUpdateCallback = (callback: (sw: ServiceWorker | null) => void) => {
  updateCallback = callback;
};

export const notifyUpdateAvailable = (sw: ServiceWorker | null) => {
  if (updateCallback) {
    updateCallback(sw);
  }
};
