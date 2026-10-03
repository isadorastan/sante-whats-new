-- Optional seed from the previous fake data.
-- Run AFTER schema.sql. Resets identity sequences after insert.

truncate table public.sessions restart identity cascade;
truncate table public.students restart identity cascade;

-- user_id é o usuário mais antigo de Authentication. Crie a conta antes de rodar.
insert into public.students (id, name, phone, weekly_classes, plan_value, color, user_id)
select v.id, v.name, v.phone, v.weekly_classes, v.plan_value, v.color, owner.id
from (values
  (1,  'Jean Bisogno',       '55999815962', 3, 450, '#2dd4a8'),
  (2,  'Nilo Stangarlin',    '55996636350', 2, 320, '#5b8def'),
  (3,  'Mariusa Stangarlin', '55996067576', 3, 450, '#38bdf8'),
  (4,  'Carla Mendes',       '11954321098', 2, 320, '#f5a524'),
  (5,  'Diego Santos',       '11943210987', 4, 580, '#ef5b7a'),
  (6,  'Elena Rocha',        '11932109876', 3, 450, '#a78bfa'),
  (7,  'Felipe Nunes',       '11921098765', 2, 320, '#34d399'),
  (8,  'Gabriela Alves',     '11910987654', 3, 450, '#fb923c'),
  (9,  'Henrique Dias',      '11909876543', 2, 320, '#38bdf8'),
  (10, 'Isabela Freitas',    '11898765432', 3, 450, '#2dd4a8'),
  (11, 'João Pedro',         '11887654321', 2, 320, '#5b8def'),
  (12, 'Karina Souza',       '11876543210', 3, 450, '#f5a524'),
  (13, 'Lucas Martins',      '11865432109', 4, 580, '#ef5b7a'),
  (14, 'Marina Oliveira',    '11854321098', 2, 320, '#a78bfa'),
  (15, 'Nicolas Barbosa',    '11843210987', 3, 450, '#34d399'),
  (16, 'Olivia Castro',      '11832109876', 1, 180, '#fb923c'),
  (17, 'Pedro Henrique',     '11821098765', 3, 450, '#38bdf8'),
  (18, 'Rafaela Pires',      '11810987654', 2, 320, '#2dd4a8'),
  (19, 'Thiago Moreira',     '11709876543', 2, 320, '#5b8def'),
  (20, 'Vanessa Guimarães',  '11798765432', 3, 450, '#f5a524'),
  (21, 'William Torres',     '11787654321', 1, 180, '#ef5b7a')
) as v(id, name, phone, weekly_classes, plan_value, color)
cross join (select id from auth.users order by created_at limit 1) as owner;

-- Sessions that referenced missing seed students (ana/bruno) were dropped.
insert into public.sessions (student_id, day, time, duration_minutes, user_id)
select v.student_id, v.day, v.time, v.duration_minutes, st.user_id
from (values
  (3,  'seg', '07:00', 45),
  (4,  'seg', '08:30', 45),
  (5,  'seg', '18:00', 45),
  (6,  'ter', '06:30', 45),
  (7,  'ter', '12:00', 45),
  (8,  'ter', '19:00', 45),
  (9,  'qua', '07:00', 45),
  (10, 'qua', '07:00', 45),
  (11, 'qua', '17:30', 45),
  (12, 'qui', '08:00', 45),
  (13, 'qui', '18:00', 45),
  (14, 'qui', '18:00', 45),
  (15, 'sex', '07:30', 45),
  (16, 'sex', '12:00', 45),
  (17, 'sex', '19:30', 45),
  (18, 'sab', '09:00', 45),
  (19, 'sab', '09:00', 45),
  (20, 'sab', '10:30', 45),
  (21, 'dom', '10:00', 45)
) as v(student_id, day, time, duration_minutes)
join public.students as st on st.id = v.student_id;

select setval(
  pg_get_serial_sequence('public.students', 'id'),
  (select coalesce(max(id), 1) from public.students)
);

select setval(
  pg_get_serial_sequence('public.sessions', 'id'),
  (select coalesce(max(id), 1) from public.sessions)
);
