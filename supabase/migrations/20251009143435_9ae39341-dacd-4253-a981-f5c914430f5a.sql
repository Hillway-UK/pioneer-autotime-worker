-- Enhance existing trigger to send notifications on amendment approval/rejection
CREATE OR REPLACE FUNCTION public.update_clock_entry_on_amendment_approval()
RETURNS trigger AS $$
DECLARE
  v_old_clock_in TIMESTAMP WITH TIME ZONE;
  v_old_clock_out TIMESTAMP WITH TIME ZONE;
  v_old_total_hours NUMERIC;
  v_new_clock_in TIMESTAMP WITH TIME ZONE;
  v_new_clock_out TIMESTAMP WITH TIME ZONE;
  v_new_total_hours NUMERIC;
  v_manager_id UUID;
  v_entry_date DATE;
BEGIN
  -- Only proceed if status changed to 'approved' OR 'rejected'
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    
    -- Get the clock entry date for notification
    SELECT DATE(clock_in) INTO v_entry_date
    FROM public.clock_entries
    WHERE id = NEW.clock_entry_id;
    
    -- APPROVED: Update clock entry
    IF NEW.status = 'approved' THEN
      -- Get current clock entry values
      SELECT clock_in, clock_out, total_hours
      INTO v_old_clock_in, v_old_clock_out, v_old_total_hours
      FROM public.clock_entries
      WHERE id = NEW.clock_entry_id;
      
      -- Determine new values
      v_new_clock_in := COALESCE(NEW.requested_clock_in, v_old_clock_in);
      v_new_clock_out := COALESCE(NEW.requested_clock_out, v_old_clock_out);
      
      -- Calculate new total_hours
      IF v_new_clock_out IS NOT NULL AND v_new_clock_in IS NOT NULL THEN
        v_new_total_hours := EXTRACT(EPOCH FROM (v_new_clock_out - v_new_clock_in)) / 3600.0;
      ELSE
        v_new_total_hours := NULL;
      END IF;
      
      -- Update clock entry
      UPDATE public.clock_entries
      SET 
        clock_in = v_new_clock_in,
        clock_out = v_new_clock_out,
        total_hours = v_new_total_hours,
        notes = COALESCE(notes || ' | ', '') || 
                'Updated via approved time amendment on ' || 
                TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = NEW.clock_entry_id;
      
      -- Get manager ID
      SELECT id INTO v_manager_id
      FROM public.managers
      WHERE email = auth.email()
      LIMIT 1;
      
      -- Create history record
      INSERT INTO public.clock_entry_history (
        clock_entry_id, changed_by, change_type,
        old_clock_in, old_clock_out, new_clock_in, new_clock_out,
        old_total_hours, new_total_hours,
        amendment_id, notes, metadata
      ) VALUES (
        NEW.clock_entry_id,
        COALESCE(v_manager_id, NEW.manager_id),
        'amendment_approval',
        v_old_clock_in, v_old_clock_out,
        v_new_clock_in, v_new_clock_out,
        v_old_total_hours, v_new_total_hours,
        NEW.id, NEW.manager_notes,
        jsonb_build_object(
          'approved_by', NEW.approved_by,
          'approved_at', NEW.approved_at,
          'reason', NEW.reason
        )
      );
      
      -- Send APPROVED notification
      INSERT INTO public.notifications (
        worker_id, title, body, type, created_at
      ) VALUES (
        NEW.worker_id,
        'Time Amendment Approved',
        format(
          'Your time amendment for %s has been approved.%s',
          TO_CHAR(v_entry_date, 'DD/MM/YYYY'),
          CASE 
            WHEN NEW.manager_notes IS NOT NULL AND NEW.manager_notes != '' 
            THEN E'\n\nManager notes: ' || NEW.manager_notes
            ELSE ''
          END
        ),
        'amendment_approved',
        NOW()
      );
    END IF;
    
    -- REJECTED: Send notification only
    IF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (
        worker_id, title, body, type, created_at
      ) VALUES (
        NEW.worker_id,
        'Time Amendment Rejected',
        format(
          'Your time amendment for %s has been rejected.%s',
          TO_CHAR(v_entry_date, 'DD/MM/YYYY'),
          CASE 
            WHEN NEW.manager_notes IS NOT NULL AND NEW.manager_notes != '' 
            THEN E'\n\nReason: ' || NEW.manager_notes
            ELSE E'\n\nNo reason provided.'
          END
        ),
        'amendment_rejected',
        NOW()
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to trigger edge function for amendment notifications
CREATE OR REPLACE FUNCTION notify_amendment_status()
RETURNS trigger AS $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  IF NEW.type IN ('amendment_approved', 'amendment_rejected') THEN
    function_url := 'https://kejblmetyrsehzvrxgmt.supabase.co/functions/v1/send-amendment-notification';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Call edge function asynchronously using pg_net
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'worker_id', NEW.worker_id,
        'title', NEW.title,
        'body', NEW.body,
        'type', NEW.type
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_amendment_notification_insert ON notifications;
CREATE TRIGGER on_amendment_notification_insert
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION notify_amendment_status();