import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, Home, Share, Plus, ChevronLeft, Construction } from "lucide-react";

export default function InstallGuide() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#702D30] to-[#420808] text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate("/")}
              className="mr-4 p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <Construction className="w-6 h-6" />
            <span className="font-heading font-bold text-xl">Install Guide</span>
          </div>
        </div>
      </header>

      <div className="p-4">
        <div className="max-w-md mx-auto space-y-6">
          <Card className="border-l-4 border-[#702D30] shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading font-extrabold text-[#111111]">
                <Smartphone className="h-5 w-5 text-[#702D30]" />
                Install Auto Timesheets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="font-body text-muted-foreground mb-4">
                  Install Auto Timesheets as an app on your iPhone for the best experience!
                </p>
              </div>

              {/* iOS Installation Steps */}
              <div className="space-y-4">
                <h3 className="font-heading font-extrabold text-lg text-[#111111]">iOS Installation Steps:</h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-[#EAEAEA] rounded-lg border border-[#939393]">
                    <div className="bg-[#702D30] text-white rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-heading font-bold text-[#111111]">Open in Safari</p>
                      <p className="text-sm font-body text-[#111111]">
                        Make sure you're viewing this page in Safari browser
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="bg-[#FF6B35] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        Tap the Share button
                        <Share className="h-4 w-4" />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Look for the share icon at the bottom of your screen
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="bg-[#FF6B35] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        Select "Add to Home Screen"
                        <Plus className="h-4 w-4" />
                      </p>
                      <p className="text-sm text-muted-foreground">Scroll down in the share menu to find this option</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="bg-[#FF6B35] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Confirm Installation</p>
                      <p className="text-sm text-muted-foreground">
                        Tap "Add" to install Auto Timesheets to your home screen
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 border-l-4 border-[#FF6B35]">
                    <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        Done!
                        <Home className="h-4 w-4" />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Auto Timesheets is now installed on your home screen like a native app
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold">Benefits of Installing:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Faster loading and smoother performance
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Full-screen experience without browser bars
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Easy access from your home screen
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Push notifications for important updates
                  </li>
                </ul>
              </div>

              {/* Troubleshooting */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold">Troubleshooting:</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Can't find "Add to Home Screen"?</strong>
                  </p>
                  <p>Make sure you're using Safari browser, not Chrome or other browsers.</p>

                  <p className="pt-2">
                    <strong>App not working properly?</strong>
                  </p>
                  <p>Try refreshing the page or reinstalling the app.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
