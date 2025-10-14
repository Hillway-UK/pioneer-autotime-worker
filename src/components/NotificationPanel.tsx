import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notifications';
import { Bell, Check, Sparkles, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
// Removed formatDistanceToNow import - using custom relative time formatter
import { useUpdate } from '@/contexts/UpdateContext';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
  read_at: string | null;
}

interface NotificationPanelProps {
  workerId: string;
}

const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
};

export default function NotificationPanel({ workerId }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { updateAvailable, triggerUpdate, dismissUpdate } = useUpdate();

  // Load notifications
  useEffect(() => {
    loadNotifications();
    setupRealtimeSubscription();
  }, [workerId]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      updateUnreadCount(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `worker_id=eq.${workerId}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          const newNotif = payload.new as Notification;
          
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // Trigger dual push (SW + Page) for new notification
          NotificationService.attemptPushNotificationBoth(
            newNotif.title,
            newNotif.body
          ).catch(err => console.error('[notif-panel] Dual push error:', err));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `worker_id=eq.${workerId}`
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new as Notification : n))
          );
          loadNotifications(); // Refresh to update unread count
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateUnreadCount = (notifs: Notification[]) => {
    const count = notifs.filter((n) => !n.read_at).length;
    setUnreadCount(count);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await NotificationService.markAllAsRead(workerId);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        {unreadCount > 0 && (
          <div className="flex justify-end mt-2 pr-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {notifications.length === 0 && !updateAvailable ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {updateAvailable && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">
                        System Update Available
                      </h4>
                      <p className="text-sm mb-3 opacity-90">
                        A new version with updated features is ready. Refresh now to get the latest improvements.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={triggerUpdate}
                          className="bg-white text-purple-600 hover:bg-gray-100 font-semibold"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Refresh Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={dismissUpdate}
                          className="border-white text-white hover:bg-white/10"
                        >
                          Later
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    notification.read_at
                      ? 'bg-background border-border'
                      : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRelativeTimeString(new Date(notification.created_at))}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
