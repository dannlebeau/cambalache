-- Reglas del mercado de subastas (ver supabase/migrations). Corre con `supabase test db`.
-- Todo ocurre en una transacción que se descarta al final. Para "adelantar el reloj" se
-- mueven `fin` y `limite_pago` al pasado como superusuario y se llama procesar_vencimientos().
begin;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgtap') then
    create extension if not exists pgtap with schema extensions;
  end if;
end;
$$;
select plan(48);

-- Usuarios de prueba: vendedor, dos compradores y un admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'vendedor@test.cl', '{"nombre":"Vendedora"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@test.cl', '{"nombre":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000c', 'beto@test.cl', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@test.cl', '{"nombre":"Admin"}');
update public.perfiles set es_admin = true where id = '00000000-0000-0000-0000-00000000000d';

create function pg_temp.como(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function pg_temp.como_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- ---- Registro ----
select is((select nombre from public.perfiles where id = '00000000-0000-0000-0000-00000000000a'), 'Vendedora',
  'el perfil toma el nombre del registro');
select is((select nombre from public.perfiles where id = '00000000-0000-0000-0000-00000000000c'), 'beto',
  'sin nombre, el perfil usa la parte local del correo');

-- ---- Escritura directa prohibida ----
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select throws_ok($$insert into public.pujas (subasta_id, usuario_id, monto) values (1, auth.uid(), 1)$$, '42501', null,
  'nadie inserta pujas directo en la tabla');
select throws_ok($$update public.perfiles set es_admin = true where id = auth.uid()$$, '42501', null,
  'nadie se hace admin editando su perfil');
select throws_ok($$select public.crear_venta(1, auth.uid(), 1, 'puja')$$, '42501', null,
  'las funciones internas no se pueden llamar desde la API');
select throws_ok($$select public.abrir_subasta(1, 100)$$, '42501', null,
  'nadie abre una subasta sin pasar por la aprobación');

-- ---- Publicar ----
select pg_temp.como_anon();
select throws_ok($$select public.publicar_carta('ygo','ygo-1','Mago Oscuro',null,'buena',null,10000)$$, '42501', null,
  'sin sesión no se puede publicar');

select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.publicar_carta('ygo','ygo-46986414','Mago Oscuro','https://img.test/mago.jpg','buena','Esquinas sanas',10000,8000)$$,
  'el vendedor publica una carta');
select is((select estado from public.publicaciones where carta_ref = 'ygo-46986414'), 'pendiente_envio',
  'la publicación queda pendiente de envío');
select throws_ok($$select public.publicar_carta('ygo','x','X','http://inseguro','buena',null,1000)$$, '23514', null,
  'la imagen debe ser https');
select throws_ok($$select public.publicar_carta('ygo','x','X',null,'buena',null,1000,2000)$$, '23514', null,
  'el precio mínimo no puede superar al base');

-- Otra publicación para probar cancelar y RLS.
select public.publicar_carta('poke','poke-xy1-1','Venusaur',null,'nueva',null,5000);
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.publicaciones), 0,
  'otro usuario no ve publicaciones pendientes ajenas');
select throws_ok($$select public.cancelar_publicacion((select max(id) from public.publicaciones))$$, 'P0001', null,
  'no se cancela una publicación ajena');
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.cancelar_publicacion((select id from public.publicaciones where carta_ref = 'poke-xy1-1'))$$,
  'el vendedor cancela su publicación pendiente');

-- ---- Aprobar ----
select throws_ok($$select public.admin_aprobar((select id from public.publicaciones where carta_ref = 'ygo-46986414'))$$, '42501', null,
  'un usuario común no aprueba');
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select lives_ok($$select public.admin_aprobar((select id from public.publicaciones where carta_ref = 'ygo-46986414'))$$,
  'el admin aprueba la carta recibida');
select is((select estado from public.publicaciones where carta_ref = 'ygo-46986414'), 'en_subasta', 'la carta queda en subasta');
select ok((select fin between now() + interval '71 hours 59 minutes' and now() + interval '72 hours 1 minute'
             from public.subastas where ronda = 1), 'la subasta dura 72 horas');

-- ---- Pujas ----
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select throws_like($$select public.pujar((select id from public.subastas where ronda = 1), 20000)$$, '%propia carta%',
  'el vendedor no puja por su carta');

select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.subastas_publicas where estado = 'activa'), 1, 'la subasta activa es pública');
select throws_like($$select public.pujar((select id from public.subastas where ronda = 1), 9999)$$, '%puja mínima es de 10000%',
  'la primera puja no baja del precio base');
select lives_ok($$select public.pujar((select id from public.subastas where ronda = 1), 10000)$$, 'Ana puja el precio base');
select throws_like($$select public.pujar((select id from public.subastas where ronda = 1), 20000)$$, '%Ya vas ganando%',
  'quien va ganando no se sobrepuja');
select is((select puja_minima from public.subastas_publicas where ronda = 1), 10500,
  'la siguiente puja mínima es +$500 cuando 5% es menor');
select is((select precio_compra_inmediata from public.subastas_publicas where ronda = 1), 12000,
  'compra inmediata = puja más alta + 20%');

select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select throws_like($$select public.pujar((select id from public.subastas where ronda = 1), 10400)$$, '%puja mínima es de 10500%',
  'una puja bajo el mínimo se rechaza');

-- Anti-sniping: a 2 minutos del cierre, una puja lo alarga a 5 minutos.
reset role;
update public.subastas set fin = now() + interval '2 minutes' where ronda = 1;
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select lives_ok($$select public.pujar((select id from public.subastas where ronda = 1), 12000)$$, 'Beto puja 12000');
select is((select fin from public.subastas where ronda = 1), now() + interval '5 minutes',
  'una puja de último minuto alarga el cierre');
select is((select puja_minima from public.subastas_publicas where ronda = 1), 12600,
  'la puja mínima es +5% cuando supera los $500');
select is((select count(*)::int from public.pujas), 1, 'cada usuario ve solo sus propias pujas');
select is((select array_agg(postor order by monto desc) from public.historial_pujas((select id from public.subastas where ronda = 1))),
  array['Tú', 'Postor 1'], 'el historial no revela quién pujó');

-- ---- Cierre con pujas y post-venta ----
reset role;
update public.subastas set fin = now() - interval '1 second' where ronda = 1;
select public.procesar_vencimientos();
select is((select resultado from public.subastas where ronda = 1), 'vendida', 'la subasta cierra vendida');
select results_eq($$select comprador_id, monto, comision, pago_vendedor, estado from public.ventas$$,
  $$values ('00000000-0000-0000-0000-00000000000c'::uuid, 12000, 1200, 10800, 'pendiente_pago')$$,
  'gana la puja más alta: 10% comisión y 90% para el vendedor');

select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select throws_like($$select public.pujar((select id from public.subastas where ronda = 1), 50000)$$, '%ya cerró%',
  'no se puja en una subasta cerrada');

-- Beto no paga en 48 h: queda bloqueado y la carta pasa a Ana por su puja.
reset role;
update public.ventas set limite_pago = now() - interval '1 second';
select public.procesar_vencimientos();
select is((select bloqueado from public.perfiles where id = '00000000-0000-0000-0000-00000000000c'), true,
  'el ganador que no paga queda bloqueado');
select results_eq($$select comprador_id, monto, tipo, estado from public.ventas where estado <> 'impaga'$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 10000, 'segundo_postor', 'pendiente_pago')$$,
  'la carta pasa al segundo mejor postor por su puja');

select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select throws_like($$select public.publicar_carta('ygo','y','Y',null,'buena',null,1000)$$, '%bloqueada%',
  'un usuario bloqueado no puede operar');

select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.simular_pago((select id from public.ventas where estado = 'pendiente_pago'))$$, '42501', null,
  'solo el comprador paga su compra');
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.simular_pago((select id from public.ventas where estado = 'pendiente_pago'))$$,
  'Ana paga (simulado)');

select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select throws_like($$select public.admin_avanzar_venta((select id from public.ventas where estado = 'pagada'), 'liquidada')$$,
  '%paso anterior%', 'no se liquida sin despachar');
select lives_ok($$select public.admin_avanzar_venta((select id from public.ventas where estado = 'pagada'), 'despachada')$$,
  'el admin despacha');
select lives_ok($$select public.admin_avanzar_venta((select id from public.ventas where estado = 'despachada'), 'liquidada')$$,
  'el admin liquida');
select is((select estado from public.publicaciones where carta_ref = 'ygo-46986414'), 'vendida', 'la carta queda vendida');

-- ---- Sin pujas: republicar con −10% y devolver bajo el mínimo ----
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select public.publicar_carta('myl','myl-1','Quetzalcóatl',null,'casi_nueva',null,10000,8500);
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select public.admin_aprobar((select id from public.publicaciones where carta_ref = 'myl-1'));
reset role;
update public.subastas set fin = now() - interval '1 second'
 where publicacion_id = (select id from public.publicaciones where carta_ref = 'myl-1');
select public.procesar_vencimientos();
select results_eq($$select ronda, precio_base, estado from public.subastas
                     where publicacion_id = (select id from public.publicaciones where carta_ref = 'myl-1') order by ronda$$,
  $$values (1, 10000, 'cerrada'), (2, 9000, 'activa')$$,
  'sin pujas se republica sola con −10%');
update public.subastas set fin = now() - interval '1 second' where estado = 'activa';
select public.procesar_vencimientos();
select is((select estado from public.publicaciones where carta_ref = 'myl-1'), 'por_devolver',
  'si el siguiente precio queda bajo el mínimo, la carta se devuelve');

-- ---- Compra inmediata ----
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select public.publicar_carta('ygo','ygo-89631139','Dragón Blanco',null,'nueva',null,20000);
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select public.admin_aprobar((select id from public.publicaciones where carta_ref = 'ygo-89631139'));
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.comprar_ahora((select id from public.subastas_publicas where carta_ref = 'ygo-89631139'))$$,
  'Ana compra de inmediato');
select results_eq($$select v.monto, v.comision, v.tipo from public.ventas v
                     join public.publicaciones p on p.id = v.publicacion_id where p.carta_ref = 'ygo-89631139'$$,
  $$values (24000, 2400, 'compra_inmediata')$$,
  'compra inmediata sin pujas = base + 20%, con 10% de comisión');

-- ---- Mantenedor de usuarios ----
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select throws_like($$select public.admin_definir_usuario(auth.uid(), false, false)$$, '%a ti mismo%',
  'un admin no se quita el admin a sí mismo');

select * from finish();
rollback;
