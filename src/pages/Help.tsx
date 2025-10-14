import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Smartphone, Clock, FileText, Wallet, Edit, Lock, RefreshCw, MapPin, Bot, Share, Plus, Home, AlertCircle } from "lucide-react";
import OrganizationLogo from "@/components/OrganizationLogo";
import { GeofenceAutoClockoutInfo } from "@/components/GeofenceAutoClockoutInfo";
import { useWorker } from "@/contexts/WorkerContext";

export default function Help() {
  const navigate = useNavigate();
  const { worker } = useWorker();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <OrganizationLogo 
                organizationLogoUrl={worker?.organizations?.logo_url}
                size="medium" 
                showText={false} 
              />
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">AutoTime</h1>
              </div>
            </div>
            <button
              onClick={() => navigate('/clock')}
              className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 pb-20">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Page Title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Help & FAQs</h2>
            <p className="text-muted-foreground">Find answers to common questions</p>
          </div>

          {/* FAQ Accordion */}
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                
                {/* 1. How to Download the App */}
                <AccordionItem value="download-app">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Download the App on Your Phone</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Install AutoTime as an app on your iPhone for the best experience with faster loading, full-screen mode, and push notifications.
                    </p>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">iOS Installation Steps:</h4>
                      
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="font-medium text-sm">Open in Safari</p>
                          <p className="text-xs text-muted-foreground">Make sure you're viewing this page in Safari browser</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm flex items-center gap-2">
                            Tap the Share button
                            <Share className="h-3 w-3" />
                          </p>
                          <p className="text-xs text-muted-foreground">Look for the share icon at the bottom of your screen</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm flex items-center gap-2">
                            Select "Add to Home Screen"
                            <Plus className="h-3 w-3" />
                          </p>
                          <p className="text-xs text-muted-foreground">Scroll down in the share menu to find this option</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          4
                        </div>
                        <div>
                          <p className="font-medium text-sm">Confirm Installation</p>
                          <p className="text-xs text-muted-foreground">Tap "Add" to install AutoTime to your home screen</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          ✓
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm flex items-center gap-2">
                            Done!
                            <Home className="h-3 w-3" />
                          </p>
                          <p className="text-xs text-muted-foreground">AutoTime is now installed on your home screen like a native app</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t space-y-2">
                      <h4 className="font-semibold text-sm">Benefits:</h4>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-primary rounded-full"></div>
                          Faster loading and smoother performance
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-primary rounded-full"></div>
                          Full-screen experience without browser bars
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-primary rounded-full"></div>
                          Easy access from your home screen
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-primary rounded-full"></div>
                          Push notifications for important updates
                        </li>
                      </ul>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Troubleshooting:</strong> Can't find "Add to Home Screen"? Make sure you're using Safari browser, not Chrome or other browsers.
                      </AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                {/* 2. How to Clock In and Clock Out */}
                <AccordionItem value="clock-in-out">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Clock In and Clock Out</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Clocking In:</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>Enable GPS location permissions on your device</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>Select a job site from the dropdown menu</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>You must be within the geofence radius of the job site</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>The app will verify your location before allowing clock in</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>You may be prompted to take a photo for verification</span>
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Clocking Out:</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>You must be currently clocked in to clock out</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>Location verification is performed to ensure you're still at the site</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>You may be prompted to take a photo</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                            <span>After clocking out, you can claim expenses for this shift</span>
                          </li>
                        </ul>
                      </div>

                      <Alert>
                        <MapPin className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Important:</strong> GPS accuracy must be good (ideally under 50m) for successful clock in/out. If you're having trouble, try moving to an area with better GPS signal.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 3. How to View Timesheets */}
                <AccordionItem value="view-timesheets">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-left">How to View Timesheets</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      View your timesheet entries to track your work hours and earnings.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Navigate via <strong>Profile → View Timesheets</strong> or use the navigation button at the bottom of the clock screen</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>View entries organized by week (Monday to Sunday)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>See daily hours worked and total weekly hours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>View calculated pay based on your hourly rate</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Expenses are displayed with each timesheet entry</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Auto-clocked-out entries are marked with a special indicator</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. How to Add Expenses */}
                <AccordionItem value="add-expenses">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Add Expenses</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Claim expenses related to your work shift for reimbursement.
                    </p>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">During Clock Out (Recommended):</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>After clocking out, a dialog will appear asking if you have expenses to claim</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Select expense types from the available options</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Enter the amount and description for each expense</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>You can add multiple expenses in one submission</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">From Timesheets Page:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Navigate to the Timesheets page</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Find the timesheet entry you want to add expenses to</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Tap "Add Expense" button and fill in the details</span>
                        </li>
                      </ul>
                    </div>

                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Tip:</strong> It's easier to claim expenses immediately after clocking out while the details are fresh in your mind.
                      </AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                {/* 5. How to File for Time Amendments */}
                <AccordionItem value="time-amendments">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Edit className="h-5 w-5 text-primary" />
                      <span className="text-left">How to File for Time Amendments</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      If your timesheet entry has incorrect clock in/out times (such as from auto-clockout), you can request an amendment.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Open the <strong>Timesheets</strong> page</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Find the entry you want to amend and tap <strong>"Request Amendment"</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Fill in the corrected clock in and clock out times</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Provide a clear reason for the amendment request</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Submit the request for manager approval</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Track the status of your amendment (pending/approved/rejected)</span>
                      </li>
                    </ul>

                    <Alert>
                      <Edit className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Note:</strong> Amendment requests require manager approval. Make sure to provide a clear explanation to help expedite the approval process.
                      </AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                {/* 6. How to Update Password */}
                <AccordionItem value="update-password">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Update Password</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Keep your account secure by regularly updating your password.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Navigate to the <strong>Profile</strong> page from the clock screen</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Tap the <strong>"Change Password"</strong> button</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Enter your current password for verification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Enter your new password</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Confirm your new password by entering it again</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Submit to update your password</span>
                      </li>
                    </ul>

                    <Alert>
                      <Lock className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Password Requirements:</strong> Your password must meet security requirements including minimum length and complexity. Use a strong, unique password for best security.
                      </AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                {/* 7. How to Refresh Application for Updates */}
                <AccordionItem value="refresh-app">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Refresh the Application for Updates</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Keep AutoTime up to date to get the latest features and bug fixes.
                    </p>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Automatic Update Notification:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>When an update is available, a banner will appear at the top of the screen</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Tap <strong>"Refresh Now"</strong> on the banner to update immediately</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>The app will reload with the latest version</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">Manual Refresh:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>Tap the refresh icon (⟳) in the top navigation bar</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                          <span>The app will check for updates and reload if necessary</span>
                        </li>
                      </ul>
                    </div>

                    <Alert>
                      <RefreshCw className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Important:</strong> Regular updates ensure you have access to the latest security patches and features. Always update when prompted.
                      </AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                {/* 8. How to Refresh Job Sites */}
                <AccordionItem value="refresh-job-sites">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <span className="text-left">How to Refresh Job Sites</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Keep your job site list up to date to see newly added locations.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Tap the refresh icon (⟳) next to the <strong>"Select Job Site"</strong> dropdown on the clock screen</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>The app will fetch the latest job sites from the server</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>A toast notification will confirm when job sites are updated</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Job sites also update automatically when managers add new locations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                        <span>Real-time updates ensure you always see the most current job sites</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 9. How Auto-Clockout Works */}
                <AccordionItem value="auto-clockout">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <span className="text-left">How Auto-Clockout Works and Limitations</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <GeofenceAutoClockoutInfo />
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>

          {/* Additional Help */}
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Need More Help?</h3>
                <p className="text-sm text-muted-foreground">
                  If you have questions not covered here, please contact your manager or administrator for assistance.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
