/**
 * Set by the setup checklist's "Hide this list" button and read on the server,
 * so a hidden list never flashes in before disappearing. Cookies are per host,
 * and each clinic has its own subdomain, so this is effectively per clinic.
 */
export const SETUP_HIDDEN_COOKIE = "setup_checklist_hidden";
