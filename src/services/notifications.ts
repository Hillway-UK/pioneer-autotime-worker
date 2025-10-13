import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  
  // Helper to get SW registration with timeout (prevents hanging)
  static async getActiveSWRegistration(timeoutMs = 300): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;

    // First, check if we ALREADY have a controlling registration
    try {
      const existing = await navigator.serviceWorker.getRegistration();
      if (existing) return existing;
    } catch (_) {
      /* ignore */
    }

    // As a last resort, wait briefly for .ready — but do NOT hang forever
    try {
      const p = navigator.serviceWorker.ready;
      const t = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
      return (await Promise.race([p, t])) as ServiceWorkerRegistration | null;
    } catch (_) {
      return null;
    }
  }

  // Generate dedupe key for idempotency
  static getDedupeKey(workerId: string, shiftDate: Date, kind: string, scheduledTime?: string): string {
    const dateStr = shiftDate.toISOString().split('T')[0];
    const timeStr = scheduledTime || '';
    return `${workerId}:${dateStr}:${kind}:${timeStr}`;
  }

  // Check if notification already sent (idempotency)
  static async checkNotificationSent(dedupeKey: string): Promise<boolean> {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .single();
    
    return !!data;
  }

  // Dual delivery: create in-app row + attempt push
  static async sendDualNotification(
    workerId: string,
    title: string,
    body: string,
    kind: string,
    dedupeKey: string
  ): Promise<void> {
    try {
      // 1. Create in-app notification row (always happens)
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          worker_id: workerId,
          title,
          body,
          type: kind,
          dedupe_key: dedupeKey,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to insert in-app notification:', insertError);
      }

      // 2. Attempt push notification (never blocks if permission denied)
      await this.attemptPushNotification(title, body);

    } catch (error) {
      console.error('Error in dual notification delivery:', error);
    }
  }

  // Dual push: ALWAYS fire both SW + Page (never branch, never throw)
  static async attemptPushNotificationBoth(title: string, body: string): Promise<void> {
    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'autotime-notification',
      requireInteraction: false,
      silent: false,
    };

    // 1) Service Worker path (don't wait on .ready, just try getRegistration)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.showNotification(title, options)
            .catch(err => console.log('[notif-dual] SW showNotification failed:', err));
        }
      }
    } catch (err) {
      console.log('[notif-dual] SW registration failed:', err);
    }

    // 2) Page Notification API (always attempt in parallel)
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, options);
        } else if (Notification.permission === 'default') {
          // Request once, then show if granted
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            new Notification(title, options);
          }
        }
        // If 'denied', just skip - don't block anything
      }
    } catch (err) {
      console.log('[notif-dual] Page Notification failed:', err);
    }
    
    // Never throw - push failures must not block in-app persistence
  }

  // Attempt push notification via ServiceWorker or fallback
  static async attemptPushNotification(title: string, body: string): Promise<void> {
    try {
      // 0) Environment sanity checks
      if (!('Notification' in window)) {
        console.log('[notif] Browser does not support Notification API');
        return;
      }

      // 1) Permission gate (page API will request if needed elsewhere)
      if (Notification.permission !== 'granted') {
        console.log('[notif] Permission not granted; skipping OS toast');
        return; // We still keep the in-app row; just no OS toast
      }

      // 2) Try Service Worker path **only if a registration is actually present**
      const reg = await this.getActiveSWRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'autotime-notification',
          requireInteraction: false,
          silent: false,
        });
        return;
      }

      // 3) Fallback to PAGE Notification API (works in your tests)
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'autotime-notification',
        requireInteraction: false,
        silent: false,
      });
    } catch (error) {
      console.error('[notif] Error showing push notification:', error);
      // Never throw; OS toast failure must not block in-app persistence
    }
  }

  // Request notification permission
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }

    return false;
  }

  // Enable notifications in database
  static async enableNotifications(workerId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermission();
      
      if (!hasPermission) {
        console.warn('[notif] Permission denied by user; will only insert in-app rows');
        // Don't throw - still allow in-app notifications
      }

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          worker_id: workerId,
          morning_reminder: true,
          evening_reminder: true,
          enabled_days: [1, 2, 3, 4, 5], // Mon-Fri
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'worker_id'
        });

      if (error) throw error;

      // Show test notification (will work via page API even if SW isn't ready)
      await this.attemptPushNotification(
        'Notifications Enabled!',
        'You\'ll receive clock-in/out reminders during your shifts.'
      );

      return true;
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      throw error;
    }
  }

  // Disable notifications
  static async disableNotifications(workerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('worker_id', workerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      throw error;
    }
  }

  // Check notification status
  static async checkNotificationStatus(workerId: string): Promise<boolean> {
    try {
      const hasPermission = Notification.permission === 'granted';
      if (!hasPermission) return false;
      
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('worker_id', workerId)
        .single();
        
      return !!data;
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }

  // Get unread count
  static async getUnreadCount(workerId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .is('read_at', null);
      
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all as read
  static async markAllAsRead(workerId: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('worker_id', workerId)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }
}
