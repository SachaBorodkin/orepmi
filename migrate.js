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

  } catch (err) {
    console.error('Migration error:', err)
  } finally {
    await pool.end()
  }
}

runMigrations()
