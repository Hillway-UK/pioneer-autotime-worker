import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, MoreVertical, Plus, Home } from "lucide-react";

interface PWAInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: () => Promise<void>;
}

export default function PWAInstallDialog({ open, onOpenChange, onDismiss }: PWAInstallDialogProps) {
  const [deviceType, setDeviceType] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      setDeviceType("ios");
    } else if (isAndroid) {
      setDeviceType("android");
    } else {
      setDeviceType("other");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading font-extrabold">
            <Smartphone className="h-5 w-5 text-primary" />
            Install Auto Timesheets
          </DialogTitle>
          <DialogDescription>Install this app on your device for the best experience!</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {deviceType === "ios" && (
            <div className="space-y-3">
              <h3 className="font-heading font-bold text-lg">iOS Installation Steps:</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold">Open in Safari</p>
                    <p className="text-sm text-muted-foreground">Make sure you're viewing this in Safari browser</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      Tap the Share button
                      <Share className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Look at the bottom of your screen</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      Select "Add to Home Screen"
                      <Plus className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Scroll down in the share menu</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold">Confirm Installation</p>
                    <p className="text-sm text-muted-foreground">Tap "Add" to install to home screen</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deviceType === "android" && (
            <div className="space-y-3">
              <h3 className="font-heading font-bold text-lg">Android Installation Steps:</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold">Open in Chrome</p>
                    <p className="text-sm text-muted-foreground">Make sure you're viewing this in Chrome browser</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      Tap the three-dot menu
                      <MoreVertical className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">In the top-right corner</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      Select "Add to Home screen"
                      <Home className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Look for this option in the menu</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold">Confirm Installation</p>
                    <p className="text-sm text-muted-foreground">
                      Tap "Add" and the app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deviceType === "other" && (
            <div className="space-y-3">
              <h3 className="font-heading font-bold text-lg">Installation Steps:</h3>
              <p className="text-sm text-muted-foreground">
                To install this app, use your browser's "Add to Home Screen" or "Install App" option, typically found in
                the browser menu.
              </p>
            </div>
          )}

          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-semibold text-sm">Benefits:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Faster loading and smoother performance
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Full-screen experience
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Easy access from your home screen
              </li>
            </ul>
          </div>

          <Button 
            onClick={async () => {
              if (onDismiss) {
                await onDismiss();
              }
              onOpenChange(false);
            }} 
            className="w-full"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
