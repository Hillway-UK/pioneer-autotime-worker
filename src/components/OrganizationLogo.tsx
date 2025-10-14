import React, { useState, useEffect, useRef } from "react";
import autoTimeLogo from "@/assets/autotime-logo.jpg";

interface OrganizationLogoProps {
  organizationLogoUrl?: string | null;
  size?: "small" | "medium" | "large";
  className?: string;
  showText?: boolean;
}

export const OrganizationLogo: React.FC<OrganizationLogoProps> = React.memo(
  ({ organizationLogoUrl, size = "large", className = "", showText = true }) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const prevUrlRef = useRef<string | null | undefined>(organizationLogoUrl);

    const logoSrc = imageError || !organizationLogoUrl ? autoTimeLogo : organizationLogoUrl;
    const logoSizeClass = size === "small" ? "h-8" : size === "medium" ? "h-10" : "h-12";
    const textSizeClass = size === "small" ? "text-lg" : "text-2xl";

    // Only reset state when URL actually changes
    useEffect(() => {
      if (organizationLogoUrl !== prevUrlRef.current) {
        if (organizationLogoUrl) {
          setImageError(false);
          setImageLoaded(false);
          console.log("📸 Organization logo URL changed:", organizationLogoUrl);
        } else {
          console.warn("⚠️ No organization logo URL provided");
        }
        prevUrlRef.current = organizationLogoUrl;
      }
    }, [organizationLogoUrl]);

    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <img
          src={logoSrc}
          alt="Organization Logo"
          className={`${logoSizeClass} w-auto object-contain`}
          onError={() => {
            console.error("❌ Failed to load organization logo:", organizationLogoUrl);
            setImageError(true);
            setImageLoaded(true);
          }}
          onLoad={() => {
            console.log("✅ Organization logo loaded successfully");
            setImageLoaded(true);
          }}
        />
        {showText && (
          <div>
            <div className={`font-heading font-extrabold ${textSizeClass} text-primary`}>Pioneer AutoTime</div>
            {size === "large" && (
              <div className="font-body text-xs text-muted-foreground tracking-widest -mt-1">
                WORKER TIME MANAGEMENT
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

OrganizationLogo.displayName = "OrganizationLogo";

export default OrganizationLogo;
