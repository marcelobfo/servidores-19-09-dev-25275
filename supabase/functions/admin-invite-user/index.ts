import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Token de autenticação ausente" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client with user context to verify admin
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Token inválido" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const callerId = claimsData.claims.sub as string;

  // Admin client with service role
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Check if caller is admin
  const { data: isAdmin } = await adminClient.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: "Acesso negado: apenas administradores" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, email, fullName, role, userId } = await req.json();

    if (action === "invite") {
      if (!email || !fullName) {
        return new Response(
          JSON.stringify({ error: "Email e nome são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user with temporary password
      const tempPassword = crypto.randomUUID().slice(0, 16) + "A1!";
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        console.error("Erro ao criar usuário:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile with name and email
      await adminClient
        .from("profiles")
        .update({ full_name: fullName, email })
        .eq("user_id", newUser.user.id);

      // If role is admin, insert into user_roles
      if (role === "admin") {
        await adminClient
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role: "admin" });
      }

      // Send password reset so user can set their own password
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      return new Response(
        JSON.stringify({
          message: "Usuário convidado com sucesso",
          userId: newUser.user.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "delete") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (userId === callerId) {
        return new Response(
          JSON.stringify({ error: "Você não pode excluir a si mesmo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error("Erro ao excluir usuário:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Usuário excluído com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
