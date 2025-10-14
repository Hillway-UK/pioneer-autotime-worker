import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, ArrowLeft, Clock, FileText, Lock } from 'lucide-react';
import { toast } from 'sonner';
import OrganizationLogo from '@/components/OrganizationLogo';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { useWorker } from '@/contexts/WorkerContext';

export default function Profile() {
  const navigate = useNavigate();
  const { worker: contextWorker, loading: workerLoading } = useWorker();
  const [worker, setWorker] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Set worker from context
  useEffect(() => {
    if (contextWorker) {
      setWorker(contextWorker);
      setOrganizationName(contextWorker.organizations?.name || '');
    }
  }, [contextWorker]);

  if (workerLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary shadow-lg">
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
              className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-primary-dark rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
              {worker?.photo_url ? (
                <img src={worker.photo_url} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-gray-500" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{worker?.name}</h2>
              <p className="text-gray-600">{worker?.email}</p>
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Change Password
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="text-gray-900">{worker?.phone || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Hourly Rate</p>
              <p className="text-gray-900">£{worker?.hourly_rate?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Organization</p>
              <p className="text-gray-900">{organizationName || 'Not assigned'}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/clock')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Clock In/Out</span>
            </div>
            <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
          </button>
          
          <button
            onClick={() => navigate('/timesheets')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">View Timesheets</span>
            </div>
            <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
          </button>
        </div>
      </div>

      <ChangePasswordDialog 
        open={showPasswordDialog} 
        onOpenChange={setShowPasswordDialog} 
      />
    </div>
  );
}