alter table public.usuarios_sistema
  add column if not exists setores text[] default '{}'::text[];

update public.usuarios_sistema
set setores = case
  when setores is null or cardinality(setores) = 0 then array_remove(array[setor], null)
  else setores
end;
