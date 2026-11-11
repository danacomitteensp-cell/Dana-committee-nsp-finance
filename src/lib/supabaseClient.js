import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bkongmqltyevnsdzhutw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrb25nbXFsdHlldm5zZHpodXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTU3NDcsImV4cCI6MjA3ODc5MTc0N30.8gx5ca1c3a3hBiyknttBzgzov0plow7NkjnqlrNSyws'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
