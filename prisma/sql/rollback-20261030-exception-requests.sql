-- Removes everything added by 202610300001_exception_requests.sql. Nothing else in the application depends on these tables.
-- Take a backup first (npm run backup:full), and switch the "booking_exceptions" feature off before running this.
-- Exception requests, offers, consents and the approval history are deleted with it; bookings, orders and vendors are not touched.
DROP TABLE IF EXISTS "ExceptionNotification";
DROP TABLE IF EXISTS "VendorApprovalEvent";
DROP TABLE IF EXISTS "VendorApproval";
DROP TABLE IF EXISTS "ExceptionConfig";
DROP TABLE IF EXISTS "StaffRole";
DROP TABLE IF EXISTS "NegotiationLog";
DROP TABLE IF EXISTS "CoordinatorTask";
DROP TABLE IF EXISTS "CustomerConsent";
DROP TABLE IF EXISTS "ExceptionOffer";
DROP TABLE IF EXISTS "ExceptionApprovalStep";
DROP TABLE IF EXISTS "ExceptionEvent";
DROP TABLE IF EXISTS "ExceptionRequest";
DROP FUNCTION IF EXISTS exception_offer_frozen();
DROP FUNCTION IF EXISTS exception_step_frozen();
DROP FUNCTION IF EXISTS exception_record_immutable();
