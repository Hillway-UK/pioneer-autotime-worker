import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GeofenceAutoClockoutInfo() {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle>Auto-Clockout: We've got your back — and your clock!</CardTitle>
        </div>
        <CardDescription>
          Focus on your work, not your timesheet. If you leave your job-site during the last hour of your shift, we'll automatically clock you out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="how-it-works">
            <AccordionTrigger>🧭 How we know you're really off-site</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>
                Each site has a geofence — a circle around the location. We only auto-clockout when you're clearly beyond that circle. 
                To keep it fair, we use a "safe-out" threshold (a little farther than the fence) and a short grace period.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="thresholds">
            <AccordionTrigger>"Safe-Out" Thresholds</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>We support geofence radii from 50 m to 500 m. You're considered outside once your device reports a distance at or beyond the threshold below:</p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-semibold">Geofence radius (R)</th>
                      <th className="text-left p-2 font-semibold">Safe-Out threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [50, 90],
                      [100, 150],
                      [200, 260],
                      [300, 380],
                      [400, 500],
                      [500, 625]
                    ].map(([radius, threshold], idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                        <td className="p-2">{radius} m</td>
                        <td className="p-2">{threshold} m from center</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground italic">We calculate this automatically from your site's radius.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="accuracy">
            <AccordionTrigger>What's "accuracy"?</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>Every location fix comes with an accuracy number (meters).</p>
              <Alert>
                <AlertDescription>
                  If accuracy = 30 m, it means the phone is likely within 30 m of the point it reported.
                </AlertDescription>
              </Alert>
              <p>We combine distance + accuracy so a "close-but-fuzzy" reading won't auto-clock you out.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="grace-period">
            <AccordionTrigger>⏱ Gentle Grace Period</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>If you step outside briefly and pop back in, no problem.</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>We wait <strong>4 minutes</strong> to see if you re-enter before finalizing the auto-clockout.</li>
                <li>We also give a <strong>60-second race buffer</strong> to respect a manual clock-out tapped at nearly the same time.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="when-applies">
            <AccordionTrigger>📅 When this applies</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p><strong>Only during the last 60 minutes before your scheduled shift end.</strong></p>
              <p>Leave anytime in that hour — 49 minutes before or even 5 minutes before — and the rule applies.</p>
              <p className="text-muted-foreground">
                If you worked off-site or left early with permission, just submit a Time Amendment with your actual clock-out time and reason.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="examples">
            <AccordionTrigger>🧪 Examples (quick intuition)</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <p className="font-semibold">R = 200 m site:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You're at 255 m from center, accuracy = 12 m → <span className="text-green-600 font-semibold">Outside? Yes</span></li>
                  <li>You're at 230 m, accuracy = 15 m → <span className="text-green-600 font-semibold">Outside? Yes</span></li>
                  <li>You're at 205 m, accuracy = 40 m → <span className="text-red-600 font-semibold">Outside? No</span> (could still be inside)</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">Timing:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Exit at shift_end − 49 min → <span className="text-green-600 font-semibold">Eligible</span> (within last hour)</li>
                  <li>Exit at shift_end − 1 h 49 min → <span className="text-red-600 font-semibold">Not eligible</span> (outside last-hour window)</li>
                  <li>Exit at shift_end − 5 min, re-enter in 2 min → <span className="text-red-600 font-semibold">No auto-clockout</span> (grace handled it)</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Need a correction?</strong> Submit a Time Amendment — quick and easy.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
