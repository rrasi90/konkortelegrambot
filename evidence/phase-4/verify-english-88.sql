-- §8.8 verification: English skill nodes exist and honestly expose zero content coverage
-- Expected: english_nodes = 10, taxonomy_ids lists all 10 ids, english_questions = 0, non_common = 0

select count(*) as english_nodes
from knowledge_nodes
where id like 'english.%' and course = 'زبان انگلیسی';

select string_agg(id, ',' order by id) as taxonomy_ids
from knowledge_nodes
where id like 'english.%';

select count(*) as english_questions
from questions q
join knowledge_nodes n on n.id = q.node_id
where n.id like 'english.%';

select count(*) as non_common
from knowledge_nodes
where id like 'english.%' and track <> 'common';
