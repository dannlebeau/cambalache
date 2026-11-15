-- Mercado de subastas en consignación de Cambalache.
--
-- Regla de arquitectura: el navegador nunca escribe tablas directo. Toda escritura pasa por
-- funciones `security definer` que validan sesión, permisos y estado; las tablas solo se
-- leen, filtradas por RLS. Así nadie puede saltarse una regla de la subasta desde la consola.
--
-- Ciclo de una carta (publicaciones.estado):
--   pendiente_envio → (admin la recibe y aprueba) → en_subasta → adjudicada → vendida
--   pendiente_envio → cancelada (el vendedor se arrepiente antes de mandarla)
--   pendiente_envio / en_subasta sin pujas bajo el mínimo → por_devolver → devuelta
-- Cada ronda de 3 días es una fila de `subastas`; si cierra sin pujas se crea otra con −10%.
-- La post-venta (pago simulado, despacho, liquidación 10/90) vive en `ventas`.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  es_admin boolean not null default false,
  bloqueado boolean not null default false,
  debe_cambiar_password boolean not null default false,
  creado timestamptz not null default now()
);

-- Una sola fila (id = 1) con las reglas editables desde el admin.
create table public.configuracion (
  id smallint primary key default 1 check (id = 1),
  duracion_horas integer not null default 72 check (duracion_horas between 1 and 720),
  incremento_pct numeric(5, 4) not null default 0.05 check (incremento_pct > 0 and incremento_pct < 1),
  incremento_min_clp integer not null default 500 check (incremento_min_clp > 0),
  recargo_compra_inmediata numeric(5, 4) not null default 0.20 check (recargo_compra_inmediata > 0 and recargo_compra_inmediata < 5),
  comision numeric(5, 4) not null default 0.10 check (comision >= 0 and comision < 1),
  descuento_republicacion numeric(5, 4) not null default 0.10 check (descuento_republicacion > 0 and descuento_republicacion < 1),
  antisniping_minutos integer not null default 5 check (antisniping_minutos between 0 and 60),
  plazo_pago_horas integer not null default 48 check (plazo_pago_horas between 1 and 720)
);
insert into public.configuracion (id) values (1);

create table public.publicaciones (
  id bigint generated always as identity primary key,
  vendedor_id uuid not null references public.perfiles (id),
  juego text not null check (juego in ('ygo', 'poke', 'myl')),
  carta_ref text not null check (char_length(carta_ref) between 1 and 80),
  nombre text not null check (char_length(nombre) between 1 and 120),
  imagen text check (imagen is null or imagen ~ '^https://'),
  conservacion text not null check (conservacion in ('nueva', 'casi_nueva', 'buena', 'jugada', 'danada')),
  notas text check (char_length(notas) <= 500),
  precio_base integer not null check (precio_base >= 100),
  precio_minimo integer check (precio_minimo >= 100 and precio_minimo <= precio_base),
  estado text not null default 'pendiente_envio'
    check (estado in ('pendiente_envio', 'en_subasta', 'adjudicada', 'vendida', 'por_devolver', 'devuelta', 'cancelada')),
  motivo text check (char_length(motivo) <= 300),
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index publicaciones_vendedor_idx on public.publicaciones (vendedor_id);
create index publicaciones_estado_idx on public.publicaciones (estado);

create table public.subastas (
  id bigint generated always as identity primary key,
  publicacion_id bigint not null references public.publicaciones (id),
  ronda integer not null check (ronda >= 1),
  precio_base integer not null check (precio_base >= 100),
  inicio timestamptz not null default now(),
  fin timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'cerrada')),
  resultado text check (resultado in ('vendida', 'compra_inmediata', 'sin_pujas')),
  -- Resumen público de la puja más alta, para listar y para Realtime sin exponer `pujas`.
  precio_actual integer,
  num_pujas integer not null default 0,
  lider_id uuid references public.perfiles (id),
  unique (publicacion_id, ronda)
);
create unique index subastas_una_activa_idx on public.subastas (publicacion_id) where estado = 'activa';
create index subastas_fin_activas_idx on public.subastas (fin) where estado = 'activa';

create table public.pujas (
  id bigint generated always as identity primary key,
  subasta_id bigint not null references public.subastas (id),
  usuario_id uuid not null references public.perfiles (id),
  monto integer not null check (monto > 0),
  creada timestamptz not null default now()
);
create index pujas_subasta_idx on public.pujas (subasta_id, monto desc);
create index pujas_usuario_idx on public.pujas (usuario_id);

create table public.ventas (
  id bigint generated always as identity primary key,
  publicacion_id bigint not null references public.publicaciones (id),
  subasta_id bigint not null references public.subastas (id),
  comprador_id uuid not null references public.perfiles (id),
  tipo text not null check (tipo in ('puja', 'compra_inmediata', 'segundo_postor')),
  monto integer not null check (monto > 0),
  comision integer not null check (comision >= 0),
  pago_vendedor integer not null check (pago_vendedor >= 0),
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago', 'pagada', 'despachada', 'liquidada', 'impaga')),
  limite_pago timestamptz not null,
  pagada_en timestamptz,
  despachada_en timestamptz,
  liquidada_en timestamptz,
  creada timestamptz not null default now(),
  check (comision + pago_vendedor = monto)
);
-- Una carta tiene a lo más una venta viva (las impagas quedan como historial).
create unique index ventas_una_viva_idx on public.ventas (publicacion_id) where estado <> 'impaga';
create index ventas_comprador_idx on public.ventas (comprador_id);

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1), 'Usuario'), 60)
  );
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------------
-- Ayudas internas
-- ---------------------------------------------------------------------------

create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.es_admin from public.perfiles p where p.id = auth.uid()), false);
$$;

-- Usuario con sesión y sin bloqueo; si no, error. Devuelve su id.
create function public.usuario_activo()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := auth.uid();
  v_bloqueado boolean;
begin
  if v_id is null then
    raise exception 'Tienes que iniciar sesión.' using errcode = '28000';
  end if;
  select p.bloqueado into v_bloqueado from public.perfiles p where p.id = v_id;
  if v_bloqueado is null then
    raise exception 'Tu cuenta no tiene perfil.' using errcode = '28000';
  end if;
  if v_bloqueado then
    raise exception 'Tu cuenta está bloqueada. Escríbenos para revisarla.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function public.exigir_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.usuario_activo();
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function public.redondear_clp(p_monto numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (round(p_monto / 100) * 100)::integer;
$$;

-- Monto mínimo de la próxima puja.
create function public.puja_minima(p_subasta_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.precio_actual is null then s.precio_base
    else s.precio_actual + greatest(c.incremento_min_clp, ceil(s.precio_actual * c.incremento_pct)::integer)
  end
  from public.subastas s, public.configuracion c
  where s.id = p_subasta_id;
$$;

-- Precio de compra inmediata: (puja más alta o precio base) + recargo, redondeado a $100.
create function public.precio_compra_inmediata(p_subasta_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.redondear_clp(coalesce(s.precio_actual, s.precio_base) * (1 + c.recargo_compra_inmediata))
  from public.subastas s, public.configuracion c
  where s.id = p_subasta_id;
$$;

create function public.abrir_subasta(p_publicacion_id bigint, p_precio integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ronda integer;
  v_id bigint;
begin
  select coalesce(max(s.ronda), 0) + 1 into v_ronda from public.subastas s where s.publicacion_id = p_publicacion_id;
  insert into public.subastas (publicacion_id, ronda, precio_base, fin)
  values (
    p_publicacion_id, v_ronda, p_precio,
    now() + make_interval(hours => (select c.duracion_horas from public.configuracion c))
  )
  returning id into v_id;
  update public.publicaciones set estado = 'en_subasta', actualizada = now() where id = p_publicacion_id;
  return v_id;
end;
$$;

-- Republica con descuento o, si quedaría bajo el mínimo del vendedor, la deja por devolver.
create function public.republicar_o_devolver(p_publicacion_id bigint, p_precio_anterior integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nuevo integer;
  v_minimo integer;
begin
  select public.redondear_clp(p_precio_anterior * (1 - c.descuento_republicacion)) into v_nuevo from public.configuracion c;
  select p.precio_minimo into v_minimo from public.publicaciones p where p.id = p_publicacion_id;
  if v_nuevo < greatest(coalesce(v_minimo, 0), 100) then
    update public.publicaciones
       set estado = 'por_devolver', motivo = 'Sin venta y el siguiente precio quedaba bajo el mínimo.', actualizada = now()
     where id = p_publicacion_id;
  else
    perform public.abrir_subasta(p_publicacion_id, v_nuevo);
  end if;
end;
$$;

create function public.crear_venta(p_subasta_id bigint, p_comprador uuid, p_monto integer, p_tipo text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comision integer;
  v_publicacion bigint;
  v_id bigint;
begin
  select round(p_monto * c.comision)::integer into v_comision from public.configuracion c;
  select s.publicacion_id into v_publicacion from public.subastas s where s.id = p_subasta_id;
  insert into public.ventas (publicacion_id, subasta_id, comprador_id, tipo, monto, comision, pago_vendedor, limite_pago)
  values (
    v_publicacion, p_subasta_id, p_comprador, p_tipo, p_monto, v_comision, p_monto - v_comision,
    now() + make_interval(hours => (select c.plazo_pago_horas from public.configuracion c))
  )
  returning id into v_id;
  update public.publicaciones set estado = 'adjudicada', actualizada = now() where id = v_publicacion;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vencimientos: subastas que cierran y ventas sin pagar
-- ---------------------------------------------------------------------------

-- Idempotente. La llaman pg_cron cada minuto y el navegador antes de leer subastas.
create function public.procesar_vencimientos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub record;
  v_venta record;
  v_siguiente record;
begin
  -- Una sola ejecución a la vez; si otra está corriendo, esta no hace nada.
  if not pg_try_advisory_xact_lock(hashtext('cambalache.procesar_vencimientos')) then
    return;
  end if;

  for v_sub in
    select s.* from public.subastas s
     where s.estado = 'activa' and s.fin <= now()
     order by s.fin
       for update
  loop
    if v_sub.lider_id is not null then
      update public.subastas set estado = 'cerrada', resultado = 'vendida' where id = v_sub.id;
      perform public.crear_venta(v_sub.id, v_sub.lider_id, v_sub.precio_actual, 'puja');
    else
      update public.subastas set estado = 'cerrada', resultado = 'sin_pujas' where id = v_sub.id;
      perform public.republicar_o_devolver(v_sub.publicacion_id, v_sub.precio_base);
    end if;
  end loop;

  for v_venta in
    select v.* from public.ventas v
     where v.estado = 'pendiente_pago' and v.limite_pago <= now()
     order by v.limite_pago
       for update
  loop
    update public.ventas set estado = 'impaga' where id = v_venta.id;
    update public.perfiles set bloqueado = true where id = v_venta.comprador_id and not es_admin;

    -- Siguiente mejor postor: la puja más alta de alguien que no haya dejado impaga esta carta
    -- y que no esté bloqueado.
    select p.usuario_id, max(p.monto) as monto into v_siguiente
      from public.pujas p
      join public.perfiles pf on pf.id = p.usuario_id
     where p.subasta_id = v_venta.subasta_id
       and not pf.bloqueado
       and p.usuario_id not in (
         select v2.comprador_id from public.ventas v2
          where v2.publicacion_id = v_venta.publicacion_id and v2.estado = 'impaga')
     group by p.usuario_id
     order by max(p.monto) desc, min(p.creada)
     limit 1;

    if found then
      perform public.crear_venta(v_venta.subasta_id, v_siguiente.usuario_id, v_siguiente.monto, 'segundo_postor');
    else
      perform public.republicar_o_devolver(
        v_venta.publicacion_id,
        (select s.precio_base from public.subastas s where s.id = v_venta.subasta_id));
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones de usuarios
-- ---------------------------------------------------------------------------

create function public.publicar_carta(
  p_juego text,
  p_carta_ref text,
  p_nombre text,
  p_imagen text,
  p_conservacion text,
  p_notas text,
  p_precio_base integer,
  p_precio_minimo integer default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_activo();
  v_id bigint;
begin
  insert into public.publicaciones (vendedor_id, juego, carta_ref, nombre, imagen, conservacion, notas, precio_base, precio_minimo)
  values (
    v_usuario, p_juego, trim(p_carta_ref), trim(p_nombre), nullif(trim(p_imagen), ''), p_conservacion,
    nullif(trim(p_notas), ''), p_precio_base, p_precio_minimo
  )
  returning id into v_id;
  return v_id;
end;
$$;

create function public.cancelar_publicacion(p_publicacion_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_activo();
begin
  update public.publicaciones
     set estado = 'cancelada', actualizada = now()
   where id = p_publicacion_id and vendedor_id = v_usuario and estado = 'pendiente_envio';
  if not found then
    raise exception 'Solo puedes cancelar una publicación tuya que todavía no hayas enviado.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.pujar(p_subasta_id bigint, p_monto integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_activo();
  v_sub public.subastas%rowtype;
  v_vendedor uuid;
  v_minima integer;
  v_extension interval;
begin
  -- Bloquea la fila: dos pujas simultáneas a la misma subasta se procesan en orden.
  select * into v_sub from public.subastas where id = p_subasta_id for update;
  if not found then
    raise exception 'La subasta no existe.' using errcode = 'P0002';
  end if;
  if v_sub.estado <> 'activa' or v_sub.fin <= now() then
    raise exception 'La subasta ya cerró.' using errcode = 'P0001';
  end if;

  select p.vendedor_id into v_vendedor from public.publicaciones p where p.id = v_sub.publicacion_id;
  if v_vendedor = v_usuario then
    raise exception 'No puedes pujar por tu propia carta.' using errcode = 'P0001';
  end if;
  if v_sub.lider_id = v_usuario then
    raise exception 'Ya vas ganando esta subasta.' using errcode = 'P0001';
  end if;

  v_minima := public.puja_minima(p_subasta_id);
  if p_monto is null or p_monto < v_minima then
    raise exception 'La puja mínima es de % CLP.', v_minima using errcode = 'P0001';
  end if;

  insert into public.pujas (subasta_id, usuario_id, monto) values (p_subasta_id, v_usuario, p_monto);

  select make_interval(mins => c.antisniping_minutos) into v_extension from public.configuracion c;
  update public.subastas
     set precio_actual = p_monto,
         num_pujas = num_pujas + 1,
         lider_id = v_usuario,
         fin = case when fin - now() < v_extension then now() + v_extension else fin end
   where id = p_subasta_id;

  return p_monto;
end;
$$;

create function public.comprar_ahora(p_subasta_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_activo();
  v_sub public.subastas%rowtype;
  v_vendedor uuid;
  v_precio integer;
begin
  select * into v_sub from public.subastas where id = p_subasta_id for update;
  if not found then
    raise exception 'La subasta no existe.' using errcode = 'P0002';
  end if;
  if v_sub.estado <> 'activa' or v_sub.fin <= now() then
    raise exception 'La subasta ya cerró.' using errcode = 'P0001';
  end if;
  select p.vendedor_id into v_vendedor from public.publicaciones p where p.id = v_sub.publicacion_id;
  if v_vendedor = v_usuario then
    raise exception 'No puedes comprar tu propia carta.' using errcode = 'P0001';
  end if;

  v_precio := public.precio_compra_inmediata(p_subasta_id);
  update public.subastas set estado = 'cerrada', resultado = 'compra_inmediata' where id = p_subasta_id;
  return public.crear_venta(p_subasta_id, v_usuario, v_precio, 'compra_inmediata');
end;
$$;

-- Pago SIMULADO: no se cobra nada real. Lo hace el comprador dentro del plazo.
create function public.simular_pago(p_venta_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_activo();
  v_venta public.ventas%rowtype;
begin
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found or v_venta.comprador_id <> v_usuario then
    raise exception 'Esa compra no es tuya.' using errcode = '42501';
  end if;
  if v_venta.estado <> 'pendiente_pago' or v_venta.limite_pago <= now() then
    raise exception 'Esta compra ya no está esperando pago.' using errcode = 'P0001';
  end if;
  update public.ventas set estado = 'pagada', pagada_en = now() where id = p_venta_id;
  update public.publicaciones set estado = 'vendida', actualizada = now() where id = v_venta.publicacion_id;
end;
$$;

-- El usuario confirma que ya cambió su contraseña temporal (la cambia con Supabase Auth).
create function public.confirmar_cambio_password()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles set debe_cambiar_password = false where id = auth.uid();
$$;

-- Historial público de una subasta, sin exponer quién pujó (solo "Tú" o "Postor N").
create function public.historial_pujas(p_subasta_id bigint)
returns table (monto integer, creada timestamptz, postor text)
language sql
stable
security definer
set search_path = ''
as $$
  with orden as (
    select p.usuario_id, row_number() over (order by min(p.creada)) as n
      from public.pujas p where p.subasta_id = p_subasta_id group by p.usuario_id
  )
  select p.monto, p.creada,
         case when p.usuario_id = auth.uid() then 'Tú' else 'Postor ' || o.n end
    from public.pujas p join orden o on o.usuario_id = p.usuario_id
   where p.subasta_id = p_subasta_id
   order by p.monto desc, p.creada;
$$;

-- ---------------------------------------------------------------------------
-- Acciones de admin
-- ---------------------------------------------------------------------------

create function public.admin_aprobar(p_publicacion_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_precio integer;
begin
  perform public.exigir_admin();
  select p.precio_base into v_precio from public.publicaciones p
   where p.id = p_publicacion_id and p.estado = 'pendiente_envio' for update;
  if not found then
    raise exception 'Solo se aprueban cartas pendientes de envío.' using errcode = 'P0001';
  end if;
  return public.abrir_subasta(p_publicacion_id, v_precio);
end;
$$;

create function public.admin_rechazar(p_publicacion_id bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo del rechazo.' using errcode = 'P0001';
  end if;
  update public.publicaciones
     set estado = 'por_devolver', motivo = left(trim(p_motivo), 300), actualizada = now()
   where id = p_publicacion_id and estado = 'pendiente_envio';
  if not found then
    raise exception 'Solo se rechazan cartas pendientes de envío.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_marcar_devuelta(p_publicacion_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  update public.publicaciones set estado = 'devuelta', actualizada = now()
   where id = p_publicacion_id and estado = 'por_devolver';
  if not found then
    raise exception 'Solo se marcan como devueltas las cartas por devolver.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_avanzar_venta(p_venta_id bigint, p_estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  if p_estado = 'despachada' then
    update public.ventas set estado = 'despachada', despachada_en = now() where id = p_venta_id and estado = 'pagada';
  elsif p_estado = 'liquidada' then
    update public.ventas set estado = 'liquidada', liquidada_en = now() where id = p_venta_id and estado = 'despachada';
  else
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  if not found then
    raise exception 'La venta no está en el paso anterior a "%".', p_estado using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_actualizar_configuracion(
  p_duracion_horas integer,
  p_incremento_pct numeric,
  p_incremento_min_clp integer,
  p_recargo_compra_inmediata numeric,
  p_comision numeric,
  p_descuento_republicacion numeric,
  p_antisniping_minutos integer,
  p_plazo_pago_horas integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  update public.configuracion set
    duracion_horas = p_duracion_horas,
    incremento_pct = p_incremento_pct,
    incremento_min_clp = p_incremento_min_clp,
    recargo_compra_inmediata = p_recargo_compra_inmediata,
    comision = p_comision,
    descuento_republicacion = p_descuento_republicacion,
    antisniping_minutos = p_antisniping_minutos,
    plazo_pago_horas = p_plazo_pago_horas
  where id = 1;
end;
$$;

create function public.admin_listar_usuarios()
returns table (id uuid, nombre text, email text, es_admin boolean, bloqueado boolean, creado timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  return query
    select p.id, p.nombre, u.email::text, p.es_admin, p.bloqueado, p.creado
      from public.perfiles p join auth.users u on u.id = p.id
     order by p.creado;
end;
$$;

create function public.admin_definir_usuario(p_usuario_id uuid, p_es_admin boolean, p_bloqueado boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
begin
  if p_usuario_id = v_admin and (not p_es_admin or p_bloqueado) then
    raise exception 'No puedes quitarte el admin ni bloquearte a ti mismo.' using errcode = 'P0001';
  end if;
  update public.perfiles set es_admin = p_es_admin, bloqueado = p_bloqueado where id = p_usuario_id;
  if not found then
    raise exception 'El usuario no existe.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas de lectura (respetan la RLS de quien consulta)
-- ---------------------------------------------------------------------------

create view public.subastas_publicas
with (security_invoker = true)
as
select s.id, s.publicacion_id, s.ronda, s.precio_base, s.inicio, s.fin, s.estado, s.resultado,
       s.precio_actual, s.num_pujas, s.lider_id,
       p.juego, p.carta_ref, p.nombre, p.imagen, p.conservacion, p.notas,
       public.puja_minima(s.id) as puja_minima,
       public.precio_compra_inmediata(s.id) as precio_compra_inmediata
  from public.subastas s
  join public.publicaciones p on p.id = s.publicacion_id;

-- ---------------------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.publicaciones enable row level security;
alter table public.subastas enable row level security;
alter table public.pujas enable row level security;
alter table public.ventas enable row level security;

-- Solo lectura desde la API; las escrituras van por las funciones de arriba.
revoke all on public.perfiles, public.configuracion, public.publicaciones, public.subastas, public.pujas, public.ventas
  from anon, authenticated;
grant select on public.perfiles, public.configuracion, public.publicaciones, public.subastas, public.pujas, public.ventas
  to anon, authenticated;
grant select on public.subastas_publicas to anon, authenticated;

create policy perfiles_propio_o_admin on public.perfiles
  for select using (id = auth.uid() or public.es_admin());

create policy configuracion_publica on public.configuracion
  for select using (true);

create policy publicaciones_visibles on public.publicaciones
  for select using (
    estado in ('en_subasta', 'adjudicada', 'vendida')
    or vendedor_id = auth.uid()
    or public.es_admin()
  );

create policy subastas_publicas on public.subastas
  for select using (true);

create policy pujas_propias_o_admin on public.pujas
  for select using (usuario_id = auth.uid() or public.es_admin());

create policy ventas_partes_o_admin on public.ventas
  for select using (
    comprador_id = auth.uid()
    or exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.vendedor_id = auth.uid())
    or public.es_admin()
  );

-- Funciones: nadie las ejecuta salvo lo que se concede explícitamente abajo.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.es_admin(),
  public.puja_minima(bigint),
  public.precio_compra_inmediata(bigint),
  public.redondear_clp(numeric),
  public.procesar_vencimientos(),
  public.historial_pujas(bigint)
  to anon, authenticated;

grant execute on function
  public.publicar_carta(text, text, text, text, text, text, integer, integer),
  public.cancelar_publicacion(bigint),
  public.pujar(bigint, integer),
  public.comprar_ahora(bigint),
  public.simular_pago(bigint),
  public.confirmar_cambio_password(),
  public.admin_aprobar(bigint),
  public.admin_rechazar(bigint, text),
  public.admin_marcar_devuelta(bigint),
  public.admin_avanzar_venta(bigint, text),
  public.admin_actualizar_configuracion(integer, numeric, integer, numeric, numeric, numeric, integer, integer),
  public.admin_listar_usuarios(),
  public.admin_definir_usuario(uuid, boolean, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime y cierre automático (solo si existen en este Postgres)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.subastas;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('cambalache-vencimientos', '* * * * *', 'select public.procesar_vencimientos()');
  end if;
end;
$$;
