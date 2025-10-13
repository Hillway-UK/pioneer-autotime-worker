-- Add pwa_install_info_dismissed column to workers table
ALTER TABLE workers 
ADD COLUMN pwa_install_info_dismissed BOOLEAN DEFAULT FALSE;