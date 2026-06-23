// supabase/functions/delete-user-admin/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: { user: callingUser } } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '')
    )
    if (!callingUser) throw new Error('User not authenticated')

    const { data: callingUserProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', callingUser.id)
      .single()

    if (profileError || !callingUserProfile || !callingUserProfile.is_admin) {
      return new Response(JSON.stringify({ error: 'Caller is not an admin or profile not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { userIdToDelete } = await req.json()
    if (!userIdToDelete) throw new Error('Missing userIdToDelete')
    if (userIdToDelete === callingUser.id) throw new Error('Admin cannot delete themselves.') // Safety check


    // Use the Admin API to delete the user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete)
    
    if (deleteError) throw deleteError
    // Deleting from auth.users should cascade to profiles table due to FK constraint with ON DELETE CASCADE

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})