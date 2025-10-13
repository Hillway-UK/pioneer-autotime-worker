import { Sparkles, X } from 'lucide-react';
import { useUpdate } from '@/contexts/UpdateContext';
import { Button } from '@/components/ui/button';

export const UpdateBanner = () => {
  const { updateAvailable, triggerUpdate, dismissUpdate } = useUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-lg">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Update Available</h3>
              <p className="text-xs text-primary-foreground/90 mb-3">
                A new version with updated features is ready.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={triggerUpdate}
                  size="sm"
                  variant="secondary"
                  className="text-xs font-semibold"
                >
                  Refresh Now
                </Button>
                <Button
                  onClick={dismissUpdate}
                  size="sm"
                  variant="ghost"
                  className="text-xs text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Later
                </Button>
              </div>
            </div>
            <button
              onClick={dismissUpdate}
              className="flex-shrink-0 p-1 hover:bg-primary-foreground/10 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
