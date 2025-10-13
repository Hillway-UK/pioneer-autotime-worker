import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { toast } from 'sonner';
import { notifyUpdateAvailable } from './contexts/UpdateContext';

// Register service worker with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[App] SW registered:', registration);

        // Check for updates periodically (every 30 minutes)
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          console.log('[App] SW update found');

          newWorker.addEventListener('statechange', () => {
            console.log('[App] SW state changed:', newWorker.state);
            
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('[App] New SW installed, showing update prompt');
              
              // Show toast notification
              toast('✨ Update Available', {
                description: 'A new version with updated logos is ready.',
                duration: Infinity,
                action: {
                  label: 'Refresh',
                  onClick: () => {
                    console.log('[App] User clicked refresh from toast');
                    newWorker.postMessage('SKIP_WAITING');
                  }
                },
              });

              // Notify UpdateContext to show persistent banner
              notifyUpdateAvailable(newWorker);
            }
          });
        });

        // Reload when new SW takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[App] New SW took control, reloading...');
          window.location.reload();
        });
      })
      .catch((error) => {
        console.error('[App] SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
