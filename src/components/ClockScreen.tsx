import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, MapPin, Clock, LogOut, Loader2, User, HelpCircle, X, Check, Wallet, RefreshCw, Construction, FileText, Info } from 'lucide-react';
import { toast } from 'sonner';
import OrganizationLogo from '@/components/OrganizationLogo';
import PWAInstallDialog from '@/components/PWAInstallDialog';
import NotificationPanel from '@/components/NotificationPanel';
import { useWorker } from '@/contexts/WorkerContext';
import { useUpdate } from '@/contexts/UpdateContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Worker {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  organization_id?: string;
  organizations?: { name: string; logo_url?: string };
  shift_end?: string;
  pwa_install_info_dismissed?: boolean;
}

interface Job {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_active: boolean;
}

interface ClockEntry {
  id: string;
  worker_id: string;
  job_id: string;
  clock_in: string;
  clock_out?: string;
  jobs: { name: string };
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
}

interface ExpenseType {
  id: string;
  name: string;
  amount: number;
  description?: string;
}

export default function ClockScreen() {
  const navigate = useNavigate();
  const { worker: contextWorker, loading: workerLoading, refreshWorker } = useWorker();
  const { triggerUpdate, updateAvailable } = useUpdate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Expense management state
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [submittingExpenses, setSubmittingExpenses] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [currentShiftExpenses, setCurrentShiftExpenses] = useState<any[]>([]);
  const [refreshingJobs, setRefreshingJobs] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [completedClockEntry, setCompletedClockEntry] = useState<any>(null);
  const [showPWADialog, setShowPWADialog] = useState(false);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const locationIntervalRef = useRef<number | null>(null);

  // Set worker from context
  useEffect(() => {
    if (contextWorker) {
      setWorker(contextWorker as unknown as Worker);
    }
  }, [contextWorker]);

  useEffect(() => {
    const init = async () => {
      if (!contextWorker) return;
      if (!contextWorker) return;

      // Load initial data
      loadJobs();
      checkCurrentStatus();
      requestLocation();
      fetchExpenseTypes();
      
      // Check if worker has dismissed PWA dialog from database
      if (contextWorker && !contextWorker.pwa_install_info_dismissed) {
        setShowPWADialog(true);
      }

      // Update time every second
      const timeInterval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => {
        clearInterval(timeInterval);
      };
    };

    init();
  }, [contextWorker, navigate]);


  // Real-time jobs listener
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          console.log('Job change detected:', payload);
          // Reload jobs when any change occurs
          loadJobs();
          
          // Show toast notification for new jobs
          if (payload.eventType === 'INSERT' && payload.new.is_active) {
            toast.success(`New job available: ${payload.new.name}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time clock entries listener - sync UI when auto-clocked out
  useEffect(() => {
    if (!worker?.id) return;

    console.log('🔧 Setting up real-time listener for clock_entries...');
    
    const clockChannel = supabase
      .channel('clock-entries-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clock_entries',
          filter: `worker_id=eq.${worker.id}`
        },
        (payload) => {
          console.log('🔔 Clock entry updated:', payload);
          
          // If an entry was auto-clocked out, refresh the status
          if (payload.new?.auto_clocked_out) {
            console.log('⚠️  Auto clock-out detected! Refreshing status...');
            toast.warning('You were automatically clocked out');
            checkCurrentStatus();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clockChannel);
    };
  }, [worker?.id]);

  const loadJobs = async (showToast = false) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      toast.error('Failed to load jobs');
      console.error('Job loading error:', error);
      return;
    }
    
    setJobs(data || []);
    if (showToast) {
      toast.success(`${data?.length || 0} job sites loaded`);
    }
  };

  const handleRefreshJobs = async () => {
    setRefreshingJobs(true);
    try {
      await loadJobs(true);
    } finally {
      setRefreshingJobs(false);
    }
  };

  // Background location tracking for geofence auto-clock-out
  const sendLocationUpdate = async (position: GeolocationPosition) => {
    if (!currentEntry || !worker) return;

    try {
      await supabase.functions.invoke('track-location', {
        body: {
          worker_id: worker.id,
          clock_entry_id: currentEntry.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  };

  const startLocationTracking = () => {
    if (!worker?.shift_end || !currentEntry) return;
    
    console.log('Starting background location tracking...');
    setIsTrackingLocation(true);

    // Send initial location
    navigator.geolocation.getCurrentPosition(
      (position) => sendLocationUpdate(position),
      (error) => console.error('Error getting location:', error),
      { enableHighAccuracy: true }
    );

    // Send location every 45 seconds
    const interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => sendLocationUpdate(position),
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true }
      );
    }, 45000); // 45 seconds

    locationIntervalRef.current = interval;
  };

  const stopLocationTracking = () => {
    console.log('Stopping background location tracking...');
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setIsTrackingLocation(false);
  };

  const checkIsInLastHourWindow = (shiftEnd: string): boolean => {
    const now = new Date();
    const [shiftHour, shiftMin] = shiftEnd.split(':').map(Number);
    
    const shiftEndTime = new Date();
    shiftEndTime.setHours(shiftHour, shiftMin, 0, 0);
    
    const windowStart = new Date(shiftEndTime.getTime() - 60 * 60 * 1000); // 60 minutes before
    
    return now >= windowStart && now <= shiftEndTime;
  };

  // Manage location tracking based on clock status and last hour window
  useEffect(() => {
    if (currentEntry && worker?.shift_end && !currentEntry.clock_out) {
      const isInLastHour = checkIsInLastHourWindow(worker.shift_end);
      
      if (isInLastHour && !isTrackingLocation) {
        startLocationTracking();
      } else if (!isInLastHour && isTrackingLocation) {
        stopLocationTracking();
      }
    } else if (isTrackingLocation) {
      stopLocationTracking();
    }

    return () => {
      if (isTrackingLocation) {
        stopLocationTracking();
      }
    };
  }, [currentEntry, worker?.shift_end, isTrackingLocation]);

  const fetchExpenseTypes = async () => {
    setLoadingExpenses(true);
    console.log('🔧 DEBUG: Fetching expense types...');
    try {
      const { data, error } = await supabase
        .from('expense_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('❌ ERROR fetching expense types:', error);
        return;
      }
      
      if (data) {
        console.log('✅ SUCCESS: Loaded expense types:', data.length, 'items');
        console.log('Expense types data:', data);
        setExpenseTypes(data);
      } else {
        console.log('⚠️  No expense types data returned');
      }
    } catch (err) {
      console.error('❌ EXCEPTION in fetchExpenseTypes:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const fetchCurrentShiftExpenses = async (clockEntryId?: string) => {
    const entryId = clockEntryId || currentEntry?.id;
    if (!entryId) return;
    
    try {
      const { data, error } = await supabase
        .from('additional_costs')
        .select('*, expense_types(name, amount)')
        .eq('clock_entry_id', entryId);
      
      if (!error && data) {
        setCurrentShiftExpenses(data);
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching shift expenses:', error);
      return [];
    }
  };

  const checkCurrentStatus = async () => {
    try {
      const workerData = JSON.parse(localStorage.getItem('worker') || '{}');
      const workerId = workerData.id || worker?.id;
      
      console.log('🔧 DEBUG: Checking current status for worker:', workerId);
      console.log('🔧 DEBUG: Worker from localStorage:', workerData);
      console.log('🔧 DEBUG: Worker from context:', worker?.id);
      
      if (!workerId) {
        console.error('❌ ERROR: No worker ID available');
        return;
      }

      // First check how many open entries exist
      const { data: allOpenEntries, error: countError } = await supabase
        .from('clock_entries')
        .select('id, clock_in, jobs(name)')
        .eq('worker_id', workerId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false });

      if (countError) {
        console.error('❌ ERROR checking open entries:', countError);
        return;
      }

      console.log('🔧 DEBUG: Found', allOpenEntries?.length || 0, 'open clock entries');
      
      if (allOpenEntries && allOpenEntries.length > 1) {
        console.warn('⚠️  WARNING: Multiple open clock entries found! Taking most recent.');
        console.log('Open entries:', allOpenEntries);
      }

      // Use maybeSingle for safe handling - take most recent if multiple exist
      const { data: currentEntryData, error: entryError } = await supabase
        .from('clock_entries')
        .select('*, jobs(name)')
        .eq('worker_id', workerId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryError) {
        console.error('❌ ERROR fetching current entry:', entryError);
        return;
      }

      console.log('🔧 DEBUG: Current entry data:', currentEntryData);
      setCurrentEntry(currentEntryData);
      
      // Fetch expenses for current shift if clocked in
      if (currentEntryData) {
        console.log('✅ Worker is clocked in, fetching expenses for entry:', currentEntryData.id);
        fetchCurrentShiftExpenses(currentEntryData.id);
      } else {
        console.log('⚠️  Worker is not clocked in');
      }
    } catch (error) {
      console.error('❌ EXCEPTION in checkCurrentStatus:', error);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        toast.error('Location access is required to clock in');
        console.error('Location error:', error);
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  };

  const capturePhoto = async (): Promise<Blob> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.zIndex = '9999';
      video.style.backgroundColor = 'black';
      document.body.appendChild(video);
      
      await video.play();
      
      // Add capture button
      const captureBtn = document.createElement('button');
      captureBtn.innerHTML = '📸 Take Photo';
      captureBtn.style.position = 'fixed';
      captureBtn.style.bottom = '20px';
      captureBtn.style.left = '50%';
      captureBtn.style.transform = 'translateX(-50%)';
      captureBtn.style.zIndex = '10000';
      captureBtn.style.padding = '16px 32px';
      captureBtn.style.backgroundColor = '#3B82F6';
      captureBtn.style.color = 'white';
      captureBtn.style.border = 'none';
      captureBtn.style.borderRadius = '24px';
      captureBtn.style.fontSize = '18px';
      captureBtn.style.fontWeight = '600';
      captureBtn.style.cursor = 'pointer';
      document.body.appendChild(captureBtn);
      
      return new Promise((resolve, reject) => {
        captureBtn.onclick = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, 640, 480);
            }
            
            canvas.toBlob((blob) => {
              stream.getTracks().forEach(track => track.stop());
              document.body.removeChild(video);
              document.body.removeChild(captureBtn);
              
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to capture photo'));
              }
            }, 'image/jpeg', 0.8);
          } catch (error) {
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(video);
            document.body.removeChild(captureBtn);
            reject(error);
          }
        };
      });
    } catch (error) {
      toast.error('Camera access is required');
      throw error;
    }
  };

  const uploadPhoto = async (blob: Blob): Promise<string> => {
    const fileName = `${worker?.id}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('clock-photos')
      .upload(fileName, blob);
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('clock-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleClockIn = async () => {
    if (!selectedJobId || !location || !worker) {
      toast.error('Please select a job and enable location');
      return;
    }
    
    setLoading(true);
    
    try {
      // Check geofence
      const job = jobs.find(j => j.id === selectedJobId);
      if (!job) {
        toast.error('Selected job not found');
        setLoading(false);
        return;
      }

      const distance = calculateDistance(
        location.lat,
        location.lng,
        job.latitude,
        job.longitude
      );
      
      if (distance > job.geofence_radius) {
        toast.error(`You must be within ${job.geofence_radius}m of the job site. You are ${Math.round(distance)}m away.`);
        setLoading(false);
        return;
      }
      
      // Take photo
      const photoBlob = await capturePhoto();
      const photoUrl = await uploadPhoto(photoBlob);
      
      // Create clock entry
      const { data, error } = await supabase
        .from('clock_entries')
        .insert({
          worker_id: worker.id,
          job_id: selectedJobId,
          clock_in: new Date().toISOString(),
          clock_in_photo: photoUrl,
          clock_in_lat: location.lat,
          clock_in_lng: location.lng
        })
        .select('*, jobs(name)')
        .single();
      
      if (error) {
        toast.error('Failed to clock in: ' + error.message);
        return;
      }
      
      setCurrentEntry(data);
      toast.success('Clocked in successfully!');
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    }
    
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!currentEntry || !worker) return;
    
    // Check location is available
    if (!location) {
      toast.error('Location not available. Please enable location services.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Get the job details to check geofence
      const job = jobs.find(j => j.id === currentEntry.job_id);
      if (!job) {
        toast.error('Job not found');
        setLoading(false);
        return;
      }
      
      // Calculate distance from job site
      const distance = calculateDistance(
        location.lat,
        location.lng,
        job.latitude,
        job.longitude
      );
      
      // Validate geofence
      if (distance > job.geofence_radius) {
        toast.error(`You must be within ${job.geofence_radius}m of the job site to clock out. You are ${Math.round(distance)}m away.`);
        setLoading(false);
        return;
      }
      
      // Take photo
      const photoBlob = await capturePhoto();
      const photoUrl = await uploadPhoto(photoBlob);
      
      // Calculate hours
      const clockIn = new Date(currentEntry.clock_in);
      const clockOut = new Date();
      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      // Update clock entry
      const { data, error } = await supabase
        .from('clock_entries')
        .update({
          clock_out: clockOut.toISOString(),
          clock_out_photo: photoUrl,
          clock_out_lat: location?.lat,
          clock_out_lng: location?.lng,
          total_hours: Math.round(hours * 100) / 100
        })
        .eq('id', currentEntry.id)
        .select('*, jobs(name)')
        .single();
      
      if (error) {
        toast.error('Failed to clock out: ' + error.message);
        return;
      }
      
      // Store completed entry for expense dialog
      setCompletedClockEntry({
        ...data,
        clock_in_time: clockIn.toISOString(),
        clock_out_time: clockOut.toISOString(),
        total_hours: hours
      });
      
      setCurrentEntry(null);
      setCurrentShiftExpenses([]);
      
      // Show expense dialog if expense types available
      if (expenseTypes && expenseTypes.length > 0) {
        setShowExpenseDialog(true);
      } else {
        // No expense types available, show standard success message
        toast.success(`Clocked out successfully! Worked ${hours.toFixed(2)} hours`);
      }
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out');
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    localStorage.clear();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getElapsedTime = () => {
    if (!currentEntry) return '';
    
    const start = new Date(currentEntry.clock_in);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const totalSelectedExpenses = selectedExpenses.reduce((sum, id) => {
    const expense = expenseTypes.find(e => e.id === id);
    return sum + (expense?.amount || 0);
  }, 0);

  const handleExpenseDialogSubmit = async () => {
    if (!completedClockEntry) return;
    
    setSubmittingExpenses(true);
    let expenseCount = 0;
    let totalAmount = 0;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!worker) throw new Error('Worker not found');
      
      // Process selected expenses
      if (selectedExpenses.length > 0) {
        for (const expenseId of selectedExpenses) {
          const expense = expenseTypes.find(e => e.id === expenseId);
          if (expense) {
            const { error } = await supabase
              .from('additional_costs')
              .insert({
                worker_id: worker.id,
                clock_entry_id: completedClockEntry.id,
                description: expense.name,
                amount: expense.amount,
                expense_type_id: expense.id,
                cost_type: 'other',
                date: new Date().toISOString().split('T')[0]
              });
            
            if (!error) {
              expenseCount++;
              totalAmount += expense.amount;
            } else {
              console.error('Error adding expense:', error);
              toast.error(`Failed to add ${expense.name}`);
            }
          }
        }
      }
      
      // Calculate duration for success message
      const duration = (completedClockEntry.total_hours || 0).toFixed(2);
      let message = `Clocked out successfully! Worked ${duration} hours`;
      
      if (expenseCount > 0) {
        message += `. ${expenseCount} expense(s) claimed (£${totalAmount.toFixed(2)})`;
      }
      
      toast.success(message, { duration: 6000 });
      
      // Clean up
      setShowExpenseDialog(false);
      setSelectedExpenses([]);
      setCompletedClockEntry(null);
    } catch (error) {
      console.error('Error submitting expenses:', error);
      toast.error('Failed to save expenses');
    } finally {
      setSubmittingExpenses(false);
    }
  };

  const handlePWADialogDismiss = async () => {
    if (!worker?.id) return;
    
    try {
      const { error } = await supabase
        .from('workers')
        .update({ pwa_install_info_dismissed: true })
        .eq('id', worker.id);
      
      if (error) throw error;
      
      console.log('PWA install dialog dismissed for worker:', worker.id);
      
      // Refresh worker context to get updated flag
      await refreshWorker();
    } catch (error) {
      console.error('Error dismissing PWA dialog:', error);
    }
  };

  if (!worker || workerLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner type="verification" message="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe">
      <style>
        {`
          /* Disable text selection except inputs */
          * {
            -webkit-user-select: none;
            user-select: none;
          }
          
          input, textarea, select {
            -webkit-user-select: text;
            user-select: text;
          }
        `}
      </style>
      
      {/* Header */}
      <header className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Organization */}
            <div className="flex items-center space-x-3">
              <OrganizationLogo 
                organizationLogoUrl={worker.organizations?.logo_url}
                size="medium" 
                showText={false} 
              />
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">AutoTime</h1>
              </div>
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (updateAvailable) {
                    triggerUpdate();
                  } else {
                    toast.success("App is already up to date!");
                  }
                }}
                className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
                title="Refresh app"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => navigate('/profile')}
                className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
              >
                <User className="h-5 w-5" />
              </button>
              
              {worker && <NotificationPanel workerId={worker.id} />}
              
              <button
                onClick={() => navigate('/help')}
                className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
                title="Help & FAQs"
              >
                <Info className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleLogout}
                className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Current Time */}
        <Card className="border-l-4 border-gray-400 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4 text-center bg-gray-400 text-white">
            <div className="text-2xl font-heading font-bold">
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-sm text-white/80 font-body">
              {currentTime.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className={`p-6 text-center ${
            currentEntry ? 'bg-green-50 border-green-200' : 'bg-gray-50'
          }`}>
            {currentEntry ? (
              <>
                <Clock className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <h2 className="text-2xl font-heading font-bold text-green-800 mb-2">CLOCKED IN</h2>
                <p className="text-lg font-body font-medium text-foreground">{currentEntry.jobs.name}</p>
                <p className="text-sm font-body text-muted-foreground mt-1">
                  Since {new Date(currentEntry.clock_in).toLocaleTimeString()}
                </p>
                <p className="text-lg font-heading font-bold text-green-600 mt-2">
                  {getElapsedTime()}
                </p>
                {currentShiftExpenses.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">
                      {currentShiftExpenses.length} expense(s) claimed this shift
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-heading font-bold text-muted-foreground">CLOCKED OUT</h2>
                <p className="text-sm font-body text-muted-foreground mt-2">Ready to start work</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Location Status */}
        {location && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2 text-green-600" />
                GPS Accuracy: {Math.round(location.accuracy)}m
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {currentEntry ? (
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full py-8 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 active:scale-95"
            >
              <LogOut className="mx-auto h-12 w-12 mb-2" />
              {loading ? 'Processing...' : 'Clock Out'}
            </button>
          ) : (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-body font-medium text-foreground">
                      Select Job Site
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshJobs}
                      disabled={refreshingJobs}
                      className="h-8 px-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingJobs ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose a job site" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} ({job.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {jobs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No job sites available. Try refreshing.
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <button
                onClick={handleClockIn}
                disabled={loading || !selectedJobId || !location}
                className="w-full py-8 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-2xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 active:scale-95 disabled:active:scale-100"
              >
                <Clock className="mx-auto h-12 w-12 mb-2" />
                {loading ? 'Processing...' : 'Clock In'}
              </button>
            </>
          )}
        </div>

        {/* Expense Reminder for Clocked In Workers */}
        {currentEntry && expenseTypes.length > 0 && (
          <Card>
            <CardContent className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-700">
                  Remember to claim any expenses when you clock out
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timesheet Navigation */}
        <button
          onClick={() => navigate('/timesheets')}
          className="w-full p-4 bg-primary hover:bg-primary-dark text-primary-foreground rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <FileText className="h-5 w-5" />
          <span>View Timesheets</span>
        </button>
        
        {/* Expense Dialog */}
        {showExpenseDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Claim Expenses for This Shift</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select any expenses to claim for the shift you just completed:
                </p>
                
                {expenseTypes.length > 0 ? (
                  <div className="space-y-2 mb-6">
                    {expenseTypes.map((expense) => (
                      <label key={expense.id} className="flex items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          checked={selectedExpenses.includes(expense.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExpenses([...selectedExpenses, expense.id]);
                            } else {
                              setSelectedExpenses(selectedExpenses.filter(id => id !== expense.id));
                            }
                          }}
                          disabled={submittingExpenses}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{expense.name}</div>
                          <div className="text-sm text-muted-foreground">£{expense.amount.toFixed(2)}</div>
                          {expense.description && (
                            <div className="text-xs text-muted-foreground">{expense.description}</div>
                          )}
                        </div>
                      </label>
                    ))}
                    
                    {selectedExpenses.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total to claim:</span>
                          <span className="font-semibold text-blue-600">
                            £{expenseTypes
                              .filter(e => selectedExpenses.includes(e.id))
                              .reduce((sum, e) => sum + e.amount, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 mb-6">No expense types available</p>
                )}
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowExpenseDialog(false);
                      setSelectedExpenses([]);
                      const duration = (completedClockEntry?.total_hours || 0).toFixed(2);
                      toast.success(`Clocked out successfully! Worked ${duration} hours`);
                      setCompletedClockEntry(null);
                    }}
                    disabled={submittingExpenses}
                    className="flex-1"
                  >
                    Skip Expenses
                  </Button>
                  <Button
                    onClick={handleExpenseDialogSubmit}
                    disabled={submittingExpenses}
                    className={`flex-1 ${submittingExpenses ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {submittingExpenses ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : selectedExpenses.length > 0 ? (
                      `Submit ${selectedExpenses.length} Expense(s) & Finish`
                    ) : (
                      'No Expenses - Finish'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PWA Install Dialog */}
      <PWAInstallDialog 
        open={showPWADialog} 
        onOpenChange={setShowPWADialog}
        onDismiss={handlePWADialogDismiss}
      />

    </div>
  );
}