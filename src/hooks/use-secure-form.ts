import { useState, useEffect } from 'react';

interface RateLimitConfig {
  key: string;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

export function useSecureForm(rateLimit: RateLimitConfig) {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    checkRateLimit();
  }, []);

  useEffect(() => {
    if (remainingTime > 0) {
      const timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1000) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [remainingTime]);

  const checkRateLimit = () => {
    const storageKey = `rateLimit_${rateLimit.key}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) return;

    const state: RateLimitState = JSON.parse(stored);
    const now = Date.now();

    if (now < state.resetTime) {
      if (state.count >= rateLimit.maxRequests) {
        setIsRateLimited(true);
        setRemainingTime(state.resetTime - now);
      }
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  const incrementAttempt = (): boolean => {
    const storageKey = `rateLimit_${rateLimit.key}`;
    const stored = localStorage.getItem(storageKey);
    const now = Date.now();

    let state: RateLimitState;

    if (!stored) {
      state = {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      };
    } else {
      state = JSON.parse(stored);
      
      if (now >= state.resetTime) {
        state = {
          count: 1,
          resetTime: now + rateLimit.windowMs,
        };
      } else {
        state.count += 1;
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(state));

    if (state.count > rateLimit.maxRequests) {
      setIsRateLimited(true);
      setRemainingTime(state.resetTime - now);
      return false;
    }

    return true;
  };

  return {
    isRateLimited,
    remainingTime,
    incrementAttempt,
  };
}