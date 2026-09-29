-- ================================================================
-- PRECI — Seed de dados de teste (rodar após o schema.sql)
-- ================================================================

-- 1. Cria a empresa de teste
insert into public.companies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Empresa Teste', 'empresa-teste')
on conflict do nothing;

-- 2. O usuário admin/admin PRECISA ser criado pelo Supabase Auth
--    (senhas não podem ser inseridas via SQL puro com segurança).
--    Duas formas de criar o usuário admin de teste:
--
--    a) Dashboard do Supabase: Authentication > Users > Add user
--       email: admin@preci.local | senha: admin
--
--    b) Via Supabase CLI / API (server-side, usando a service_role key):
--       supabase.auth.admin.create_user({
--         "email": "admin@preci.local",
--         "password": "admin",
--         "email_confirm": true
--       })
--
-- 3. Depois de criado, pegue o UUID gerado (auth.users.id) e rode:
--
-- insert into public.profiles (id, company_id, full_name, email, role)
-- values (
--   '<uuid-do-usuario-criado>',
--   '00000000-0000-0000-0000-000000000001',
--   'Administrador',
--   'admin@preci.local',
--   'admin'
-- );
