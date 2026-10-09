import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function runMigrations() {
  try {
    console.log('Running migrations...')

    // 1. Column "charge" on gps_logs and SELECT policy for public/anon read
    await pool.query('ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS charge SMALLINT DEFAULT NULL')
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gps_logs' AND policyname = 'Allow public read access on gps_logs'
        ) THEN
          CREATE POLICY "Allow public read access on gps_logs"
          ON public.gps_logs FOR SELECT
          USING (true);
        END IF;
      END $$;
    `)
    console.log('✓ Column "charge" and SELECT policy on gps_logs ensured')

    // 2. Column "avatar_url" on public.users
    await pool.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL')
    await pool.query('ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL')
    await pool.query('ALTER TABLE public.users ALTER COLUMN created_at SET DEFAULT NOW()')
    console.log('✓ Column "avatar_url" added to public.users (and password/created_at constraints adjusted)')

    // 3. Create real Supabase storage bucket "avatars"
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'avatars',
        'avatars',
        true,
        5242880,
        ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']
      )
      ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
    `)
    console.log('✓ Supabase Storage bucket "avatars" created/configured as public')

    // 4. Storage RLS policies for avatars
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Avatar images are publicly accessible'
        ) THEN
          CREATE POLICY "Avatar images are publicly accessible"
          ON storage.objects FOR SELECT
          USING (bucket_id = 'avatars');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload avatars'
        ) THEN
          CREATE POLICY "Authenticated users can upload avatars"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = 'avatars');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own avatars'
        ) THEN
          CREATE POLICY "Users can update their own avatars"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (bucket_id = 'avatars');
        END IF;
      END $$;
    `)
    console.log('✓ Storage policies for "avatars" bucket ensured')

    // 5. Sync existing Google OAuth avatars from auth.users into public.users
    const syncRes = await pool.query(`
      INSERT INTO public.users (name, email, avatar_url, created_at, updated_at)
      SELECT 
        COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
        email,
        COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture'),
        created_at,
        updated_at
      FROM auth.users
      ON CONFLICT (email) DO UPDATE SET
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        name = COALESCE(public.users.name, EXCLUDED.name),
        updated_at = NOW()
      RETURNING id, email, avatar_url;
    `)
    console.log(`✓ Synced ${syncRes.rowCount} users with avatars:`, syncRes.rows)

    // 6. Create trigger to sync auth.users with public.users on signup/login
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.users (name, email, avatar_url, updated_at)
        VALUES (
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
          NOW()
        )
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, public.users.name),
          avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
          updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;
      CREATE TRIGGER on_auth_user_sync
        AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();
    `)
    console.log('✓ Auth user sync trigger created on auth.users -> public.users')

    // 7. Table "tracker" with id, name, locked/unlocked, owner_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.tracker (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT 'TestTracker1',
        locked BOOLEAN NOT NULL DEFAULT true,
        owner_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'tracker' AND column_name = 'is_locked'
        ) THEN
          ALTER TABLE public.tracker ADD COLUMN is_locked BOOLEAN GENERATED ALWAYS AS (locked) STORED;
        END IF;
      END $$;
    `)

    // Seed first tracker if empty
    const firstUserQuery = await pool.query('SELECT id FROM public.users ORDER BY id ASC LIMIT 1')
    const firstUserId = firstUserQuery.rows[0]?.id || null

    await pool.query(`
      INSERT INTO public.tracker (id, name, locked, owner_id)
      VALUES (1, 'TestTracker1', true, $1)
      ON CONFLICT (id) DO NOTHING;
    `, [firstUserId])

    await pool.query(`SELECT setval('tracker_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.tracker));`)
    console.log('✓ Table "tracker" created and seeded with first tracker')

    // RLS & Permissions on tracker
    await pool.query('ALTER TABLE public.tracker ENABLE ROW LEVEL SECURITY;')
    await pool.query('GRANT ALL ON TABLE public.tracker TO anon, authenticated, service_role;')
    await pool.query('GRANT ALL ON SEQUENCE public.tracker_id_seq TO anon, authenticated, service_role;')

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tracker' AND policyname = 'Allow public read access on tracker'
        ) THEN
          CREATE POLICY "Allow public read access on tracker"
          ON public.tracker FOR SELECT
          USING (true);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tracker' AND policyname = 'Allow public update access on tracker'
        ) THEN
          CREATE POLICY "Allow public update access on tracker"
          ON public.tracker FOR UPDATE
          USING (true);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tracker' AND policyname = 'Allow public insert access on tracker'
        ) THEN
          CREATE POLICY "Allow public insert access on tracker"
          ON public.tracker FOR INSERT
          WITH CHECK (true);
        END IF;
      END $$;
    `)
    console.log('✓ Permissions and RLS policies on "tracker" ensured')

    // Create view public.trackers for compatibility
    await pool.query(`CREATE OR REPLACE VIEW public.trackers AS SELECT * FROM public.tracker;`)
    await pool.query(`GRANT ALL ON public.trackers TO anon, authenticated, service_role;`)

    // 8. Add tracker_id to gps_logs and assign first tracker id
    await pool.query(`
      ALTER TABLE public.gps_logs
      ADD COLUMN IF NOT EXISTS tracker_id BIGINT REFERENCES public.tracker(id) ON DELETE SET NULL;
    `)

    const updateGpsLogs = await pool.query(`
      UPDATE public.gps_logs
      SET tracker_id = (SELECT id FROM public.tracker ORDER BY id ASC LIMIT 1)
      WHERE tracker_id IS NULL;
    `)
    console.log(`✓ Updated ${updateGpsLogs.rowCount} rows in gps_logs with first tracker ID`)

    await pool.query(`
      ALTER TABLE public.gps_logs ALTER COLUMN tracker_id SET DEFAULT 1;
    `)

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.set_default_gps_tracker_id()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.tracker_id IS NULL THEN
          NEW.tracker_id := (SELECT id FROM public.tracker ORDER BY id ASC LIMIT 1);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_gps_tracker_id ON public.gps_logs;
      CREATE TRIGGER trg_gps_tracker_id
        BEFORE INSERT ON public.gps_logs
        FOR EACH ROW
        EXECUTE FUNCTION public.set_default_gps_tracker_id();
    `)

    // 9. Add hdop, altitude, course columns to gps_logs
    await pool.query(`
      ALTER TABLE public.gps_logs
      ADD COLUMN IF NOT EXISTS hdop float4,
      ADD COLUMN IF NOT EXISTS altitude float4,
      ADD COLUMN IF NOT EXISTS course float4;
    `)
    console.log('[migrate] Columns hdop, altitude, course added to gps_logs')

  } catch (err) {
    console.error('Migration error:', err)
  } finally {
    await pool.end()
  }
}

runMigrations()
