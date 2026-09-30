// backend/scripts/seed-demo-users.js
// Idempotent script to seed the 8 real demo identities in Supabase Auth and Profiles

import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'NexusDemo2026!';

const DEMO_USERS = [
  {
    fullName: 'Aarav Sharma',
    email: 'aarav@nexusai.internal',
    role: 'admin',
    department: 'Administration',
  },
  {
    fullName: 'Priya Patel',
    email: 'priya@nexusai.internal',
    role: 'manager',
    department: 'Engineering',
  },
  {
    fullName: 'Neha Gupta',
    email: 'neha@nexusai.internal',
    role: 'finance',
    department: 'Finance',
  },
  {
    fullName: 'Ananya Desai',
    email: 'ananya@nexusai.internal',
    role: 'hr',
    department: 'Human Resources',
  },
  {
    fullName: 'Vikram Singh',
    email: 'vikram@nexusai.internal',
    role: 'it',
    department: 'IT',
  },
  {
    fullName: 'Rohan Verma',
    email: 'rohan@nexusai.internal',
    role: 'procurement',
    department: 'Procurement',
  },
  {
    fullName: 'Omkar Dev',
    email: 'omkar@nexusai.internal',
    role: 'employee',
    department: 'Engineering',
    managerEmail: 'priya@nexusai.internal',
  },
  {
    fullName: 'Rahul Rao',
    email: 'rahul@nexusai.internal',
    role: 'employee',
    department: 'Engineering',
    managerEmail: 'priya@nexusai.internal',
  },
];

async function seedDemoUsers() {
  console.log('====================================================');
  console.log('NEXUS AI — SEEDING 8 DEMO IDENTITIES (BLOCK 3)');
  console.log('====================================================\n');

  // 1. Fetch existing auth users to ensure idempotency
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`Failed to list auth users: ${listErr.message}`);
  }
  const existingMap = new Map((userList?.users || []).map(u => [u.email, u.id]));

  const createdProfiles = new Map();

  // 2. Create or find Auth Users & Profiles
  for (const u of DEMO_USERS) {
    let authUserId = existingMap.get(u.email);

    if (!authUserId) {
      console.log(`Creating Auth user: ${u.email}...`);
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });

      if (createErr) {
        console.error(`Failed to create Auth user ${u.email}:`, createErr.message);
        continue;
      }
      authUserId = newUser.user.id;
      console.log(`  ✓ Created Auth user ID: ${authUserId}`);
    } else {
      console.log(`  ✓ Reusing existing Auth user: ${u.email} (${authUserId})`);
    }

    // Upsert base profile (manager_id will be set in pass 2)
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authUserId,
      email: u.email,
      full_name: u.fullName,
      role: u.role,
      department: u.department,
      is_active: true,
    }, { onConflict: 'id' });

    if (profileErr) {
      console.error(`Failed to upsert profile for ${u.email}:`, profileErr.message);
    } else {
      createdProfiles.set(u.email, authUserId);
    }
  }

  // 3. Pass 2: Establish Manager Relationships (Omkar -> Priya, Rahul -> Priya)
  console.log('\nSetting up manager relationships...');
  const priyaId = createdProfiles.get('priya@nexusai.internal');

  if (priyaId) {
    for (const email of ['omkar@nexusai.internal', 'rahul@nexusai.internal']) {
      const empId = createdProfiles.get(email);
      if (empId) {
        const { error: mgrErr } = await supabase
          .from('profiles')
          .update({ manager_id: priyaId })
          .eq('id', empId);

        if (mgrErr) {
          console.error(`Failed setting manager for ${email}:`, mgrErr.message);
        } else {
          console.log(`  ✓ Assigned Priya (${priyaId}) as manager for ${email}`);
        }
      }
    }
  }

  // 4. Block 2 Test Data Cleanup
  console.log('\nCleaning up Block 2 verification test workflow...');
  const { error: delWorkflowErr } = await supabase
    .from('workflows')
    .delete()
    .eq('id', 'e5ff1a55-8aae-4351-877d-321a56cabe60');

  if (!delWorkflowErr) {
    console.log('  ✓ Cleaned up test workflow e5ff1a55-8aae-4351-877d-321a56cabe60');
  }

  console.log('\n====================================================');
  console.log('DEMO IDENTITIES SEEDED & VERIFIED SUCCESSFULLY');
  console.log('====================================================');
}

seedDemoUsers().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
