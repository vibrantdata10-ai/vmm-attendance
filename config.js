// =====================================================
// VIBRANT MARKETING MANAGEMENT - CONFIGURATION
// Replace with your actual Supabase credentials
// =====================================================

const CONFIG = {
  SUPABASE_URL: 'https://ydjafowsvrcphyuvwxwt.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_UAOPVksoAr2BW765CXVNPA_vxjTYr74',
  COMPANY_NAME: 'Vibrant Marketing Management',

  // CLIENTS / COMPANIES
  CLIENTS: ['DU', 'Etisalat'],

  // ROLES:
  // admin  = full access + user management
  // boss   = view only (dashboard + export) for assigned client
  // hr     = dashboard + upload + export for assigned client
  // manager= agents + attendance + records for assigned client

  // Users are now stored in Supabase 'app_users' table
  // This is just the initial admin account - DO NOT REMOVE
    USERS: [
  { id: 'admin001', name: 'shanawaz', password: 'vibrant@6305', role: 'admin' },
  { id: 'boss001',  name: 'mr.Boss',  password: 'Vibrant!123', role: 'boss'  },
  { id: 'hr001',    name: 'mr.Yaser',    password: 'Vibrant!123',   role: 'hr'    },
  { id: 'manager', name: 'mr.shamshuddin',password:'Vibrant!123', role: 'manager'}

]
};
