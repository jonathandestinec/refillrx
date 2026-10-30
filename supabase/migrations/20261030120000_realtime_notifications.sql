-- RefillRx: stream notifications table changes over Supabase Realtime so the
-- sidebar unread badge and the notification feed update without a manual
-- refresh. Applied to the live project on 2026-10-30.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
