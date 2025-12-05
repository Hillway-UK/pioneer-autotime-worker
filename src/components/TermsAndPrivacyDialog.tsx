import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface TermsAndPrivacyDialogProps {
  open: boolean;
  onAccepted: () => void;
  workerEmail: string;
}

export default function TermsAndPrivacyDialog({ open, onAccepted, workerEmail }: TermsAndPrivacyDialogProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeclineWarning, setShowDeclineWarning] = useState(false);

  const handleAccept = async () => {
    if (!agreed) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('workers')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('email', workerEmail);

      if (error) throw error;

      toast.success('Terms accepted successfully');
      onAccepted();
    } catch (error) {
      console.error('Error accepting terms:', error);
      toast.error('Failed to save acceptance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    setShowDeclineWarning(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <Dialog open={open} modal>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] flex flex-col p-0"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl font-bold text-center">
              PIONEER AUTOTIME
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center">
              Privacy Policy & Terms of Service
            </p>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4" style={{ maxHeight: '60vh' }}>
            <div className="space-y-6 text-sm">
              {/* Privacy Policy */}
              <section>
                <h2 className="text-lg font-bold mb-4">📱 PRIVACY POLICY (UK GDPR)</h2>
                <p className="text-xs text-muted-foreground mb-4">Last updated: 12-05-2025</p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">🔒 1. Introduction</h3>
                    <p className="text-muted-foreground mt-1">
                      Welcome to Pioneer AutoTime ("we", "us", "our"). We are committed to protecting your personal information in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. This Privacy Policy explains what we collect, why we collect it, how we use it, and the rights you have.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">📌 2. Data We Collect</h3>
                    <div className="text-muted-foreground mt-1 space-y-2">
                      <p><strong>2.1 Information You Provide:</strong> Name or display name, email address or phone number, shift details, availability, and work records, photos taken or uploaded within the app, notes or other content you submit.</p>
                      <p><strong>2.2 Photos (Identity & Attendance Verification):</strong> Pioneer AutoTime may request access to your camera or photo library to capture a profile photo, verify your identity, verify clock-in or clock-out events, and prevent fraudulent attendance logging. You will always be asked for permission first.</p>
                      <p><strong>2.3 Location Data (Attendance Validation):</strong> When you log in, clock in, or use location-based features, we may collect approximate or precise GPS location and device location information from your mobile OS. This helps confirm legitimate attendance and prevents false shift reporting.</p>
                      <p><strong>2.4 Automatically Collected Data:</strong> Device type and operating system, browser type (if using web app), IP address and timezone, usage logs such as login timestamps.</p>
                      <p><strong>2.5 Third-Party Services:</strong> We use secure third-party providers such as Supabase for authentication, storage, and processing. These services act as data processors under UK GDPR.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold">🛠️ 3. How We Use Your Data</h3>
                    <p className="text-muted-foreground mt-1">
                      We use your data to: provide shift management and time-tracking features, verify identity and attendance using photos & location, prevent fraud and ensure workplace integrity, improve app performance and security, send essential service notifications, provide customer support, and maintain accurate worker logs. Pioneer AutoTime does not sell your personal data.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">⚖️ 4. Legal Bases for Processing (UK GDPR)</h3>
                    <p className="text-muted-foreground mt-1">
                      We rely on the following lawful bases: <strong>Contractual necessity</strong> – to provide the AutoTime features; <strong>Legitimate interests</strong> – fraud prevention, workforce management, safety; <strong>Consent</strong> – access to photos and location services; <strong>Legal obligation</strong> – compliance with UK employment or record-keeping laws. You may withdraw consent at any time.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">🔐 5. Data Security</h3>
                    <p className="text-muted-foreground mt-1">
                      We implement strong security measures including encrypted communication (HTTPS/TLS), secure cloud storage (e.g., Supabase), and access controls and authentication safeguards. Despite our efforts, no system is 100% secure.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">🗂️ 6. Data Retention</h3>
                    <p className="text-muted-foreground mt-1">
                      We keep your data only as long as required for providing the service, workplace compliance, and legal or contractual obligations. When your account is deleted, data is removed or anonymised within a reasonable timeframe.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">👤 7. Your UK GDPR Rights</h3>
                    <p className="text-muted-foreground mt-1">
                      You have the right to: access your personal data, request correction of inaccurate data, request deletion of your data, withdraw consent (photos, location, etc.), restrict or object to processing, request data portability, and file a complaint with the ICO. Contact us to exercise your rights: 📧 support@pioneerautotime.com
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">🚫 8. Children</h3>
                    <p className="text-muted-foreground mt-1">
                      Pioneer AutoTime is not intended for users under 16.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">🔄 9. Changes</h3>
                    <p className="text-muted-foreground mt-1">
                      We may update this Privacy Policy and will notify you within the app.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">📬 10. Contact</h3>
                    <p className="text-muted-foreground mt-1">
                      For privacy questions or requests: 📧 support@pioneerautotime.com
                    </p>
                  </div>
                </div>
              </section>

              <hr className="my-6" />

              {/* Terms of Service */}
              <section>
                <h2 className="text-lg font-bold mb-4">📱 TERMS OF SERVICE</h2>
                <p className="text-xs text-muted-foreground mb-4">Last updated: 12-05-2025</p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">1. Acceptance</h3>
                    <p className="text-muted-foreground mt-1">
                      By tapping "Agree & Continue", you confirm you accept these Terms of Service and the Privacy Policy.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">2. Use of Pioneer AutoTime</h3>
                    <p className="text-muted-foreground mt-1">
                      You agree to use the App for lawful and work-related purposes only. You must not attempt to misuse, hack, or interfere with the App.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">3. Account Responsibilities</h3>
                    <p className="text-muted-foreground mt-1">
                      You are responsible for keeping your login details secure and all actions performed under your account. Report unauthorised access immediately.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">4. Photo & Location Requirements</h3>
                    <p className="text-muted-foreground mt-1">
                      Because Pioneer AutoTime is used for workforce time management, by using the app, you acknowledge and agree that the app may request your location when you log in or clock in/out, and the app may request access to your camera or photos for identity verification. These features help prevent false attendance and ensure workplace compliance. You may disable permissions at any time, but some features may stop working.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">5. Data Ownership</h3>
                    <p className="text-muted-foreground mt-1">
                      You retain ownership of the content and data you submit. By using the App, you grant Pioneer AutoTime permission to process your data solely for delivering the service.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">6. Service Availability</h3>
                    <p className="text-muted-foreground mt-1">
                      We strive for high availability but cannot guarantee uninterrupted service. We are not responsible for network issues, third-party outages, or device malfunctions.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">7. Limitation of Liability</h3>
                    <p className="text-muted-foreground mt-1">
                      To the maximum extent permitted by law: Pioneer AutoTime is provided "as is". We are not liable for indirect, incidental, or consequential damages. Our liability will not exceed the amount paid for the service (if any).
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">8. Termination</h3>
                    <p className="text-muted-foreground mt-1">
                      We may terminate or suspend access if you violate these Terms, misuse the App, or we discontinue the service. You may stop using the App at any time.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">9. Governing Law</h3>
                    <p className="text-muted-foreground mt-1">
                      These Terms are governed by the laws of England and Wales.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold">10. Contact</h3>
                    <p className="text-muted-foreground mt-1">
                      📧 support@pioneerautotime.com
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <div className="w-full space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms-agree"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  className="mt-1"
                />
                <label
                  htmlFor="terms-agree"
                  className="text-sm font-medium leading-relaxed cursor-pointer"
                >
                  I agree to the Privacy Policy and Terms of Service
                </label>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1"
                >
                  Decline
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={!agreed || loading}
                  className="flex-1"
                >
                  {loading ? <LoadingSpinner size="sm" /> : 'Agree & Continue'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeclineWarning} onOpenChange={setShowDeclineWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Use App Without Accepting</AlertDialogTitle>
            <AlertDialogDescription>
              You must accept the Privacy Policy and Terms of Service to use Pioneer AutoTime. 
              If you decline, you will be signed out of the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
