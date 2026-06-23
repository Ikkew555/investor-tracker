// supabase/functions/set-admin-status/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient( // Use Admin client
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // SERVICE ROLE KEY
    )

    // Get invoking user (the admin making the request)
    const { data: { user: callingUser } } = await supabaseAdmin.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '')
    )
    if (!callingUser) throw new Error('User not authenticated')

    // Check if the calling user is an admin from the profiles table
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

    const { userIdToUpdate, isAdmin } = await req.json()
    if (!userIdToUpdate || typeof isAdmin !== 'boolean') {
      throw new Error('Missing userIdToUpdate or isAdmin status (must be boolean)')
    }

    // Prevent admin from de-admining themselves if they are the last admin (optional)
    // You might add more complex logic here

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', userIdToUpdate)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ message: 'User admin status updated' }), {
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