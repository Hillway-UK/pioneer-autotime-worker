import React from 'react';
import autoTimeLogo from '@/assets/autotime-logo.jpg';

interface AutoTimeLogoProps {
  size?: 'small' | 'large';
  className?: string;
  showText?: boolean;
}

export const AutoTimeLogo: React.FC<AutoTimeLogoProps> = ({ 
  size = 'large', 
  className = '',
  showText = true 
}) => {
  const logoSizeClass = size === 'small' ? 'h-8' : 'h-12';
  const textSizeClass = size === 'small' ? 'text-lg' : 'text-2xl';
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img 
        src={autoTimeLogo} 
        alt="AutoTime Logo" 
        className={`${logoSizeClass} w-auto object-contain`}
      />
      {showText && (
        <div>
          <div className={`font-heading font-extrabold ${textSizeClass} text-primary`}>
            AutoTime
          </div>
          {size === 'large' && (
            <div className="font-body text-xs text-muted-foreground tracking-widest -mt-1">
              WORKER TIME MANAGEMENT
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutoTimeLogo;